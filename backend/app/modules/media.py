"""Private normalized photos, with local and GCS storage adapters."""
import hashlib
import hmac
import io
import os
import warnings
from threading import BoundedSemaphore
from datetime import timedelta
from pathlib import Path
from uuid import UUID, uuid4
from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from app.config import get_settings
from app.models import Bin
from app.modules.common import DB, fail, get, now, product_lock
from app.modules.identity import CurrentUser
from app.modules.models import AuthSession, Evidence, MediaAsset, Report, WorkOrder
from app.modules.schemas import AccessRead, MediaRead, ERROR_RESPONSES

router = APIRouter(prefix="/api/v1", tags=["media"], responses=ERROR_RESPONSES)
MAX_SIZE = 5 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 20_000_000
IMAGE_PROCESSING = BoundedSemaphore(1)


def local_path(key):
    # Only generated object names are accepted, never client paths.
    if Path(key).name != key: fail(404, "NOT_FOUND")
    return Path(get_settings().media_directory) / key


def store(key, data):
    settings = get_settings()
    try:
        if settings.media_backend == "gcs":
            if not settings.media_bucket: raise ValueError("Bucket not configured")
            from google.cloud import storage
            storage.Client().bucket(settings.media_bucket).blob(key).upload_from_string(data, content_type="image/jpeg", if_generation_match=0, timeout=30)
        elif settings.media_backend == "local":
            if os.environ.get("K_SERVICE"): raise ValueError("Cloud Run requires GCS")
            path = local_path(key)
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(".tmp")
            temporary.write_bytes(data)
            temporary.replace(path)
        else: raise ValueError("Unknown media backend")
    except Exception:
        fail(503, "STORAGE_UNAVAILABLE")


def allowed(db, asset, user):
    if asset.user_id == user.id or "admin" in user.roles: return
    if "staff" in user.roles:
        report = db.scalar(select(Report).where(Report.photo_id == asset.id))
        proof = db.scalar(select(Evidence).where(Evidence.media_id == asset.id))
        bin_ = db.get(Bin, report.bin_id) if report else None
        if proof:
            task = db.get(WorkOrder, proof.work_order_id)
            bin_ = db.get(Bin, task.bin_id)
        if bin_ and bin_.district in user.districts: return
    fail(404, "NOT_FOUND")


@router.post("/media", response_model=MediaRead, status_code=201)
def upload(db: DB, user: CurrentUser, file: UploadFile = File(), purpose: str = Form()):
    if purpose not in {"report", "completion", "site"}: fail(422, "VALIDATION_ERROR")
    if (purpose == "report" and "citizen" not in user.roles) or (purpose != "report" and "staff" not in user.roles): fail(403, "FORBIDDEN")
    data = file.file.read(MAX_SIZE + 1)
    if len(data) > MAX_SIZE: fail(413, "FILE_TOO_LARGE")
    try:
        # Bound peak decoded-pixel memory on the 512 MiB Cloud Run instance.
        with IMAGE_PROCESSING, warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"} or getattr(image, "n_frames", 1) != 1:
                    fail(415, "UNSUPPORTED_MEDIA_TYPE")
                image.load()
                clean = Image.new("RGB", image.size)
                clean.paste(image.convert("RGB"))
                output = io.BytesIO()
                clean.save(output, "JPEG", quality=85, exif=b"", icc_profile=None)
                normalized = output.getvalue()
                clean.close()
                output.close()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        fail(415, "UNSUPPORTED_MEDIA_TYPE")
    if len(normalized) > MAX_SIZE: fail(413, "FILE_TOO_LARGE")
    product_lock(db)
    id_ = uuid4()
    key = f"binsoon-{id_}.jpg"
    store(key, normalized)
    asset = MediaAsset(id=id_, user_id=user.id, purpose=purpose, content_type="image/jpeg",
        size_bytes=len(normalized), storage_key=key, sha256=hashlib.sha256(normalized).hexdigest())
    db.add(asset)
    db.commit()
    return dict(id=asset.id, purpose=asset.purpose, content_type=asset.content_type, size_bytes=asset.size_bytes, status="ready", created_at=asset.created_at)


@router.get("/media/{media_id}/access", response_model=AccessRead)
def access(media_id: UUID, db: DB, user: CurrentUser, request: Request):
    asset = get(db, MediaAsset, media_id)
    allowed(db, asset, user)
    expires = now() + timedelta(minutes=5)
    settings = get_settings()
    if settings.media_backend == "gcs":
        try:
            import google.auth
            from google.auth.transport.requests import Request as GoogleRequest
            from google.cloud import storage
            credentials, project = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
            credentials.refresh(GoogleRequest())
            email = settings.media_signing_service_account or getattr(credentials, "service_account_email", None)
            if not email: raise ValueError("Signing account not configured")
            blob = storage.Client(project=project, credentials=credentials).bucket(settings.media_bucket).blob(asset.storage_key)
            url = blob.generate_signed_url(version="v4", expiration=expires, method="GET",
                service_account_email=email, access_token=credentials.token)
        except Exception:
            fail(503, "STORAGE_UNAVAILABLE")
    else:
        session = get(db, AuthSession, request.state.auth_session_id)
        expires = min(expires, session.expires_at)
        payload = f"{session.id}:{asset.id}:{int(expires.timestamp())}"
        signature = hmac.new(session.token_hash.encode(), payload.encode(), hashlib.sha256).hexdigest()
        url = str(request.url_for("media_content", media_id=asset.id)) + f"?ticket={payload}:{signature}"
    return dict(url=url, expires_at=expires)


@router.get("/media/{media_id}/content", name="media_content", include_in_schema=False)
def content(media_id: UUID, ticket: str, db: DB):
    try:
        session_id, asset_id, expiry, signature = ticket.split(":")
        session = db.get(AuthSession, UUID(session_id))
        if not session or session.revoked or session.expires_at <= now() or int(expiry) <= now().timestamp() or UUID(asset_id) != media_id:
            fail(404, "NOT_FOUND")
        payload = f"{session_id}:{asset_id}:{expiry}"
        if not hmac.compare_digest(signature, hmac.new(session.token_hash.encode(), payload.encode(), hashlib.sha256).hexdigest()): fail(404, "NOT_FOUND")
        from app.modules.models import User
        user = get(db, User, session.user_id)
        if not user.enabled: fail(404, "NOT_FOUND")
        asset = get(db, MediaAsset, media_id)
        allowed(db, asset, user)
        if get_settings().media_backend != "local" or not local_path(asset.storage_key).is_file(): fail(404, "NOT_FOUND")
        return FileResponse(local_path(asset.storage_key), media_type=asset.content_type, headers={"Cache-Control":"no-store", "X-Content-Type-Options":"nosniff"})
    except (ValueError, TypeError): fail(404, "NOT_FOUND")
