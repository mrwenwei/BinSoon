import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Annotated
from fastapi import Depends, Header, Request, Response
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from app.database import get_session
from app.modules.models import Idempotency, Notification

DB = Annotated[Session, Depends(get_session)]
RULE = "phase1-2026-10-19"


def now():
    return datetime.now(timezone.utc)


class ProductError(Exception):
    def __init__(self, status, code, message=None, fields=None):
        self.status, self.code = status, code
        self.message = message or code.replace("_", " ").capitalize()
        self.fields = fields or []


def fail(status, code, message=None, fields=None):
    raise ProductError(status, code, message, fields)


def get(db, model, id_):
    item = db.get(model, id_)
    if item is None:
        fail(404, "NOT_FOUND")
    return item


def product_lock(db):
    # Low-volume MVP: serializes cross-module writes in one documented lock order.
    db.execute(text("SELECT pg_advisory_xact_lock(2068101901)"))


def page(items, limit=20, offset=0):
    return dict(items=items[offset:offset + limit], page=dict(limit=limit, offset=offset, total=len(items)))


def etag(item):
    return f'"v{item.version}"'


def version(item, request):
    value = request.headers.get("if-match")
    if value is None:
        fail(428, "VERSION_REQUIRED")
    if value != etag(item):
        fail(412, "VERSION_CONFLICT")


def notify(db, user_id, type_, target_kind, target_id, dedup, title, message="", waste_type=None):
    if not db.scalar(select(Notification.id).where(Notification.user_id == user_id, Notification.dedup_key == dedup)):
        db.add(Notification(user_id=user_id, type=type_, target_kind=target_kind, target_id=target_id,
                            dedup_key=dedup, title=title, message=message, waste_type=waste_type))


def write(db, request: Request, response: Response, actor, body, operation, status=200):
    key = request.headers.get("idempotency-key")
    try:
        key = uuid.UUID(key)
    except (ValueError, TypeError, AttributeError):
        fail(422, "VALIDATION_ERROR", "Idempotency-Key must be a UUID")
    product_lock(db)
    # Auth queries may have loaded rows before waiting for the lock.
    db.expire_all()
    if actor and not actor.enabled:
        fail(401, "UNAUTHENTICATED")
    if actor and "/staff/work-orders/" in request.url.path:
        from app.modules.models import WorkOrder
        target = request.url.path.split("/staff/work-orders/", 1)[1].split("/", 1)[0]
        task = get(db, WorkOrder, uuid.UUID(target))
        if task.district not in actor.districts:
            fail(404, "NOT_FOUND")
    actor_key = str(actor.id) if actor else "maintenance-admin"
    path = f"{request.method} {request.url.path}"
    digest = hashlib.sha256(json.dumps(jsonable_encoder(body), sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    old = db.scalar(select(Idempotency).where(Idempotency.actor == actor_key, Idempotency.key == key, Idempotency.path == path))
    if old:
        # Before 0006 report bodies had no waste_type. Preserve retry keys for
        # those exact old commands; never allow a recycling payload to replay it.
        legacy_digest = None
        if path == "POST /api/v1/reports" and body.get("waste_type") == "general" and "waste_type" not in old.response:
            legacy_body = {k:v for k,v in body.items() if k != "waste_type"}
            legacy_digest = hashlib.sha256(json.dumps(jsonable_encoder(legacy_body), sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        if old.body_hash != digest and old.body_hash != legacy_digest:
            fail(409, "IDEMPOTENCY_CONFLICT")
        response.status_code = old.status_code
        response.headers["Idempotency-Replayed"] = "true"
        if old.etag:
            response.headers["ETag"] = old.etag
        return old.response
    try:
        result = operation()
    except Exception:
        db.rollback()
        raise
    db.flush()
    data = jsonable_encoder(result)
    response.status_code = status
    # Duplicate report creation returns an existing resource without new evidence.
    if isinstance(data, dict) and "_status" in data:
        response.status_code = data.pop("_status")
    version_number = data.get("version") if isinstance(data, dict) else None
    if version_number is None and isinstance(data, dict):
        version_number = (data.get("work_order") or {}).get("version")
    result_etag = f'"v{version_number}"' if version_number is not None else None
    if result_etag:
        response.headers["ETag"] = result_etag
    db.add(Idempotency(actor=actor_key, key=key, path=path, body_hash=digest,
                       response=data, status_code=response.status_code, etag=result_etag))
    db.commit()
    return data
