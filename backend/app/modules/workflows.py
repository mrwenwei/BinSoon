"""Transactional citizen reports, verification and work completion."""
from uuid import uuid4
from sqlalchemy import select
from app.models import Bin, BinReading, BinState
from app.services import simulation
from app.modules import views
from app.modules.common import fail, get, now, notify, version
from app.modules.models import (Adoption, Completion, Evidence, Incident, MediaAsset, PointEntry,
                                Report, User, WorkAction, WorkOrder)


def media(db, id_, user, purpose):
    item = get(db, MediaAsset, id_)
    if item.user_id != user.id: fail(404, "NOT_FOUND")
    if item.purpose != purpose: fail(409, "EVIDENCE_REQUIRED", "Photo purpose does not match")
    return item


def adoption_alert(db, bin_id, problem, event_id):
    adoption = views.active_adoption(db, bin_id)
    if adoption and adoption.preferences.get(problem) and get(db, Bin, bin_id).operational_status != "removed":
        notify(db, adoption.user_id, "adoption_alert", "adoption", adoption.id,
               f"alert:{problem}:{event_id}", "認養桶有新狀況", problem)


def create_report(db, user, body):
    bin_ = get(db, Bin, body.bin_id)
    if user.rejected_count >= 3: fail(403, "REPORTING_SUSPENDED")
    if not views.installed(bin_) or bin_.operational_status == "removed": fail(409, "BIN_UNAVAILABLE")
    event = db.scalar(select(Incident).where(Incident.bin_id == bin_.id, Incident.type == body.type, Incident.status == "open"))
    if event:
        old = db.scalar(select(Report).where(Report.event_id == event.id, Report.user_id == user.id))
        if old: return dict(**views.report(db, old), _status=200)
    asset = media(db, body.photo_ids[0], user, "report")
    if db.scalar(select(Report.id).where(Report.photo_id == asset.id)):
        fail(409, "EVIDENCE_REQUIRED", "A new event requires a new photo")
    if views.distance(db, bin_, body.position.model_dump()) > 50:
        fail(422, "PROXIMITY_TOO_FAR")
    adopted = views.active_adoption(db, bin_.id, user.id) is not None
    if body.quick and not adopted: fail(403, "FORBIDDEN", "Active adoption required for quick report")
    if event is None:
        event = Incident(bin_id=bin_.id, type=body.type, status="open")
        db.add(event)
        db.flush()
        if bin_.district == "大安區":
            work = WorkOrder(event_id=event.id, bin_id=bin_.id, type=body.type, district=bin_.district)
            db.add(work)
            db.flush()
            for staff in db.scalars(select(User).where(User.enabled.is_(True))):
                if "staff" in staff.roles and bin_.district in staff.districts:
                    notify(db, staff.id, "work_assigned", "work_order", work.id, f"new-work:{work.id}", "新待辦工單")
        if body.type in {"dirty", "dumping"}:
            adoption_alert(db, bin_.id, body.type, event.id)
    item = Report(bin_id=bin_.id, event_id=event.id, user_id=user.id, type=body.type,
        description=body.description, adopter=adopted, first_reporter=event.first_report_id is None,
        quick=body.quick, photo_id=asset.id)
    db.add(item)
    db.flush()
    if event.first_report_id is None: event.first_report_id = item.id
    db.flush()
    return views.report(db, item)


def staff_access(db, id_, user, assigned=False):
    item = get(db, WorkOrder, id_)
    if item.district not in user.districts: fail(404, "NOT_FOUND")
    if assigned and item.assigned_staff_id != user.id: fail(403, "FORBIDDEN")
    return item


def actor_work(db, id_, user, request, admin=False):
    item = get(db, WorkOrder, id_) if admin else staff_access(db, id_, user)
    version(item, request)
    if item.status in views.CLOSED: fail(409, "INVALID_TRANSITION")
    if get(db, Bin, item.bin_id).operational_status == "removed": fail(409, "BIN_UNAVAILABLE")
    return item


def arrived(item, user=None):
    if item.arrived_at is None: fail(409, "INVALID_TRANSITION", "Arrival required")
    if user and item.assigned_staff_id != user.id: fail(403, "FORBIDDEN")


def finish_if_ready(db, item):
    db.flush()
    if item.status in views.CLOSED or views.requirements(db, item)["missing"]:
        return
    item.status, item.completed_at, item.confirmed_problem = "completed", now(), True
    event = get(db, Incident, item.event_id)
    event.status, event.closed_at = "closed", item.completed_at
    db.add(Completion(work_order_id=item.id, bin_id=item.bin_id, staff_id=item.assigned_staff_id, type=item.type, created_at=item.completed_at))
    for report in db.scalars(select(Report).where(Report.event_id == item.event_id)):
        notify(db, report.user_id, "work_completed", "report", report.id, f"completed:{item.id}:{report.id}", "案件工作已完成")
    db.flush()


def action(db, item, user, name, payload):
    item.version += 1
    db.add(WorkAction(work_order_id=item.id, actor=str(user.id) if user else "maintenance-admin", action=name, payload=payload))
    db.flush()


def work_command(db, id_, user, request, command, body):
    item = actor_work(db, id_, user, request)
    if command == "accept":
        if item.status != "pending": fail(409, "INVALID_TRANSITION")
        item.status, item.accepted_at, item.assigned_staff_id = "processing", now(), user.id
    elif command == "arrive":
        if item.status != "processing" or item.assigned_staff_id != user.id: fail(409, "INVALID_TRANSITION")
        item.status, item.arrived_at = "arrived", now()
    else:
        arrived(item, user)
        if command == "evidence":
            asset = media(db, body.media_id, user, body.purpose)
            if asset.created_at < item.arrived_at: fail(409, "EVIDENCE_REQUIRED", "Upload a new photo after arrival")
            old = db.scalar(select(Evidence).where(Evidence.work_order_id == item.id, Evidence.purpose == body.purpose))
            if old and old.media_id != asset.id: fail(409, "EVIDENCE_REQUIRED", "Evidence already submitted")
            if not old:
                if db.scalar(select(Evidence.id).where(Evidence.media_id == asset.id)): fail(409, "EVIDENCE_REQUIRED")
                db.add(Evidence(work_order_id=item.id, media_id=asset.id, purpose=body.purpose))
                if body.purpose == "completion": item.photo_at = now()
        elif command == "repair":
            if item.type != "broken": fail(409, "INVALID_TRANSITION")
            item.status, item.reason = "repair", body.reason
        elif command in {"finish", "dismiss"}:
            pending = db.scalar(select(Report.id).where(Report.event_id == item.event_id, Report.settled_at.is_(None)).limit(1))
            purpose = "site" if command == "dismiss" else "completion"
            proof = db.scalar(select(Evidence.id).where(Evidence.work_order_id == item.id, Evidence.purpose == purpose))
            if pending or not proof: fail(409, "EVIDENCE_REQUIRED")
            item.reason = body.reason
            if command == "dismiss":
                item.status, item.completed_at, item.confirmed_problem = "dismissed", now(), False
                event = get(db, Incident, item.event_id)
                event.status, event.closed_at = "closed", item.completed_at
            else:
                item.submitted_at = now()
                if item.type == "full" and not item.clear_reading_id: item.status = "waiting_sensor"
        finish_if_ready(db, item)
    action(db, item, user, command, body.model_dump(mode="json"))
    return views.work_detail(db, item) if command == "evidence" else views.work(db, item)


def review_report(db, id_, report_id, user, request, body):
    item = actor_work(db, id_, user, request)
    arrived(item, user)
    report = get(db, Report, report_id)
    if report.event_id != item.event_id: fail(404, "NOT_FOUND")
    if report.settled_at: fail(409, "INVALID_TRANSITION", "Review already final")
    owner = get(db, User, report.user_id)
    report.status, report.reviewed_at, report.settled_at = body.decision, now(), now()
    report.rejection_reason = body.reason if body.decision == "rejected" else None
    if body.decision == "rejected":
        owner.rejected_count += 1
    else:
        amount = (2 if report.adopter else 1) if report.first_reporter else 0
        report.awarded_points = amount
        owner.available_points += amount
        owner.cumulative_points += amount
        # Zero-point approvals also receive an immutable settlement entry.
        db.add(PointEntry(user_id=owner.id, type="report_award", amount=amount,
            balance_after=owner.available_points, report_id=report.id))
    notify(db, owner.id, "report_reviewed", "report", report.id, f"review:{report.id}", "回報查證完成", body.decision)
    finish_if_ready(db, item)
    action(db, item, user, "review", dict(report_id=str(report_id), **body.model_dump()))
    return dict(report=views.report(db, report), work_order=views.work(db, item))


def demo_clear(db, id_, user, request, body):
    from app.config import get_settings
    if not get_settings().demo_auth_enabled: fail(503, "DEMO_AUTH_DISABLED")
    item = actor_work(db, id_, user, request, admin=True)
    arrived(item)
    if item.type != "full" or item.clear_reading_id or db.get(BinReading, body.reading_id):
        fail(409, "INVALID_TRANSITION")
    state = simulation.collect(db, item.bin_id)
    reading = db.scalar(select(BinReading).where(BinReading.bin_id == item.bin_id).order_by(BinReading.observation_sequence.desc()).limit(1))
    # collect creates one new reading under the shared simulation advisory lock.
    reading.id = body.reading_id
    reading.observed_at = reading.received_at = now()
    state.observed_at, state.received_at = reading.observed_at, reading.received_at
    db.flush()
    item.clear_reading_id = reading.id
    finish_if_ready(db, item)
    action(db, item, user, "demo_clear", body.model_dump(mode="json"))
    return dict(reading=views.task_reading(db, item), work_order=views.work(db, item))
