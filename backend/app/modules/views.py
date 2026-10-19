"""Read projections shared by map, citizen and staff APIs; no write side effects."""
import calendar
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import func, select
from app.models import Bin, BinState, BinReading, Hotspot
from app.services import bins, simulation
from app.waste import WASTE_TYPES
from app.modules.models import (Adoption, Completion, CompletionLike, Evidence, Incident, Notification,
                                PointEntry, Proposal, Redemption, Report, Reward, User, Vote, WorkOrder)
from app.modules.common import RULE, fail, get, now

TAIPEI = ZoneInfo("Asia/Taipei")
ORIGIN = dict(latitude=25.033, longitude=121.5358)
CLOSED = {"completed", "dismissed"}
_UNSET = object()


def fields(item, *names):
    return {name: getattr(item, name) for name in names}


def installed(bin_):
    return bin_.placement_status in {"existing", "installed"}


def distance(db, bin_, position):
    return float(db.scalar(select(func.ST_Distance(bin_.location,
        func.ST_SetSRID(func.ST_MakePoint(position["longitude"], position["latitude"]), 4326)))))


def status(db, bin_, state=_UNSET, repair_ids=None, waste_type="general"):
    if state is _UNSET: state = db.get(BinState, (bin_.id, waste_type))
    fill = state.fill_level_pct if state else None
    operational = bin_.operational_status
    repairs = (bin_.id, waste_type) in repair_ids if repair_ids is not None else db.scalar(select(WorkOrder.id).where(WorkOrder.bin_id == bin_.id, WorkOrder.waste_type == waste_type, WorkOrder.type == "broken",
        WorkOrder.arrived_at.is_not(None), WorkOrder.status.not_in(CLOSED)).limit(1))
    if operational != "removed" and repairs:
        operational = "repair"
    reasons = []
    if not installed(bin_): reasons.append("not_installed")
    if operational != "normal": reasons.append(operational)
    if fill is None: reasons.append("unknown")
    elif fill >= 80: reasons.append("full")
    fill_status = "unknown" if fill is None or operational != "normal" else "full" if fill >= 80 else "half" if fill >= 50 else "hungry"
    risk = simulation.priority(state) if state else {}
    return dict(waste_type=waste_type, classification_source=state.classification_source if state else "demo_assumption",
        fill_level_pct=fill, capacity_liters=state.capacity_liters if state else None,
        estimated_used_liters=state.capacity_liters * fill / 100 if state else None,
        fill_status=fill_status, operational_status=operational, is_usable=not reasons,
        unavailable_reasons=reasons, is_new=bool(bin_.installed_at and timedelta(0) <= now()-bin_.installed_at < timedelta(days=30) and operational != "removed"),
        installed_at=bin_.installed_at, removed_at=bin_.removed_at, reading_source_type=state.source_type if state else None,
        observed_at=(state.observed_at or state.last_updated_at) if state else None,
        received_at=state.received_at if state else None, last_emptied_at=state.last_emptied_at if state else None,
        risk_priority=risk.get("priority"), estimated_hours_to_90_pct=risk.get("estimated_hours_to_90_pct"))


def location(db, item, position=None, coordinates=None, repair_ids=None, known_distance=_UNSET, waste_type="general", states=None):
    if coordinates is None:
        coords = db.execute(bins.location_query(type(item)).where(type(item).id == item.id)).one()
        coordinates = (coords.longitude, coords.latitude)
    is_bin = isinstance(item, Bin)
    if is_bin and states is None:
        states = {(s.bin_id,s.waste_type):s for s in db.scalars(select(BinState).where(BinState.bin_id == item.id))}
    compartments = [status(db, item, states.get((item.id,t)), repair_ids, t) for t in WASTE_TYPES] if is_bin else []
    dist = (distance(db, item, position) if position else None) if known_distance is _UNSET else known_distance
    return dict(**fields(item, "id", "district", "note", "source_type", "source_row", "source_file", "location_precision"),
        kind="bin" if is_bin else "place", label=item.name, address=item.address if is_bin else None,
        longitude=coordinates[0], latitude=coordinates[1],
        reported_count=None if is_bin else item.reported_count,
        bin_type=item.bin_type if is_bin else None, placement_status=item.placement_status if is_bin else None,
        distance_m=dist, walking_estimate_seconds=math.ceil(dist*1.3/1.25) if dist is not None else None,
        bin_status=next(s for s in compartments if s["waste_type"] == waste_type) if is_bin else None,
        compartments=compartments)


def latest_cleanup(db, bin_id, waste_type="general"):
    return db.scalar(select(Completion).where(Completion.bin_id == bin_id,
        Completion.waste_type == waste_type, Completion.type.in_(["full", "dirty", "dumping"])).order_by(Completion.created_at.desc(), Completion.id).limit(1))


def cleanup(db, completion, user=None):
    count = db.scalar(select(func.count()).select_from(CompletionLike).where(CompletionLike.completion_id == completion.id))
    liked = bool(user and db.scalar(select(CompletionLike.id).where(CompletionLike.completion_id == completion.id, CompletionLike.user_id == user.id)))
    latest = latest_cleanup(db, completion.bin_id, completion.waste_type)
    return dict(**fields(completion, "id", "work_order_id", "bin_id", "waste_type", "classification_source"), completed_at=completion.created_at,
        like_count=count, liked_by_me=liked, can_like=bool(user and "citizen" in user.roles and latest and latest.id == completion.id and not liked))


def active_adoption(db, bin_id, user_id=None):
    query = select(Adoption).where(Adoption.bin_id == bin_id, Adoption.status == "active")
    if user_id: query = query.where(Adoption.user_id == user_id)
    return db.scalar(query)


def bin_view(db, bin_, user=None, waste_type="general"):
    loc = location(db, bin_, waste_type=waste_type)
    st = loc["bin_status"]
    adoption = active_adoption(db, bin_.id)
    completion = latest_cleanup(db, bin_.id, waste_type)
    citizen = user and "citizen" in user.roles
    reason = "not_installed" if not installed(bin_) else "removed" if bin_.operational_status == "removed" else "login_required" if not citizen else "suspended" if user.rejected_count >= 3 else None
    mine = db.scalar(select(Adoption).where(Adoption.user_id == user.id, Adoption.bin_id == bin_.id,
        Adoption.status.in_(["pending", "active"]))) if citizen else None
    return dict(location=loc, status=st, compartments=loc["compartments"], adopter=fields(adoption, "display_name", "role", "intro") if adoption else None,
        latest_cleanup=cleanup(db, completion, user) if completion else None,
        my_adoption_id=mine.id if mine else None, can_apply_adoption=bool(citizen and installed(bin_) and bin_.operational_status != "removed" and not adoption and not mine),
        can_report=reason is None, report_block_reason=reason)


def lifecycle(bin_):
    return dict(bin_id=bin_.id, **fields(bin_, "version", "operational_status", "placement_status", "installed_at", "removed_at"), reason=bin_.lifecycle_reason)


def report(db, item):
    work = db.scalar(select(WorkOrder).where(WorkOrder.event_id == item.event_id))
    incident = get(db, Incident, item.event_id)
    state = item.status if item.status in {"approved", "rejected"} else "processing" if work and work.accepted_at else "pending"
    award = (2 if item.adopter else 1) if item.first_reporter else 0
    return dict(**fields(item, "id", "bin_id", "event_id", "waste_type", "classification_source", "type", "description", "created_at", "adopter", "first_reporter", "quick", "reviewed_at", "rejection_reason", "awarded_points", "settled_at", "rule_version"),
        work_order_id=work.id if work else None, status=state, photo_ids=[item.photo_id],
        accepted_at=work.accepted_at if work else None, pending_points=award if item.settled_at is None else 0,
        event_status=incident.status, work_status=work.status if work else None,
        assignment_status="assigned" if work else "unassigned")


def priority(db, work):
    state = db.get(BinState, (work.bin_id, work.waste_type))
    fill = state.fill_level_pct if state else None
    if work.type == "dumping" or fill is not None and fill >= 90: return "immediate"
    quick = db.scalar(select(Report.id).where(Report.event_id == work.event_id, Report.quick.is_(True)).limit(1))
    if work.type == "full" or fill is not None and fill >= 80 or quick: return "high"
    return "inspection" if work.source == "inspection" else "normal"


def work(db, item):
    pri = priority(db, item)
    target = item.created_at + timedelta(minutes=30) if pri == "immediate" else None
    bin_ = get(db, Bin, item.bin_id)
    completion = db.scalar(select(Completion).where(Completion.work_order_id == item.id))
    return dict(**fields(item, "id", "version", "event_id", "bin_id", "waste_type", "classification_source", "type", "source", "status", "district", "assigned_staff_id",
        "created_at", "accepted_at", "arrived_at", "photo_at", "submitted_at", "completed_at", "clear_reading_id", "reason", "confirmed_problem", "is_fixture"),
        priority=pri, target_at=target, is_overdue=bool(target and item.status not in CLOSED and now() > target),
        distance_m=distance(db, bin_, ORIGIN), source_type="demo", completion_id=completion.id if completion else None,
        blocked_by_removed_bin=bin_.operational_status == "removed")


def work_sort(item):
    return ({"immediate":0, "high":1, "normal":2, "inspection":3}[item["priority"]], item["created_at"], str(item["id"]))


def task_reading(db, item):
    if not item.clear_reading_id: return None
    reading = get(db, BinReading, item.clear_reading_id)
    return dict(**fields(reading, "id", "bin_id", "waste_type", "classification_source", "fill_level_pct", "observed_at", "received_at", "source_type", "event_type"), work_order_id=item.id)


def requirements(db, item):
    reviewed = not db.scalar(select(Report.id).where(Report.event_id == item.event_id, Report.settled_at.is_(None)).limit(1))
    req = dict(arrived=item.arrived_at is not None, reports_reviewed=reviewed,
        completion_photo=item.photo_at is not None, work_submitted=item.submitted_at is not None,
        fresh_clear_reading=item.clear_reading_id is not None)
    mandatory = ["arrived", "reports_reviewed", "completion_photo", "work_submitted"]
    if item.type == "full": mandatory.append("fresh_clear_reading")
    return dict(**req, missing=[] if item.status == "dismissed" else [name for name in mandatory if not req[name]])


def work_detail(db, item):
    reports = db.scalars(select(Report).where(Report.event_id == item.event_id).order_by(Report.created_at, Report.id))
    evidence = db.scalars(select(Evidence).where(Evidence.work_order_id == item.id).order_by(Evidence.created_at, Evidence.id))
    return dict(work_order=work(db, item), location=location(db, get(db, Bin, item.bin_id), waste_type=item.waste_type),
        reports=[report(db, r) for r in reports], evidence=[fields(e, "id", "media_id", "purpose", "created_at") for e in evidence],
        latest_reading=task_reading(db, item), completion_requirements=requirements(db, item))


TIERS = [("apprentice", "見習生", 0), ("rookie", "新手", 10), ("independent", "獨當一面", 50),
         ("skilled", "高手", 150), ("expert", "專家", 500), ("professor", "教授", 1000)]


def membership(db, user):
    points = user.cumulative_points
    index = max(i for i, (_, _, threshold) in enumerate(TIERS) if points >= threshold)
    tier = lambda t: dict(code=t[0], name=t[1], threshold=t[2])
    pending = db.scalars(select(Report).where(Report.user_id == user.id, Report.settled_at.is_(None))).all()
    approved = db.scalar(select(func.count()).select_from(Report).where(Report.user_id == user.id, Report.status == "approved"))
    next_ = TIERS[index+1] if index+1 < len(TIERS) else None
    return dict(cumulative_points=points, available_points=user.available_points,
        pending_points=sum((2 if r.adopter else 1) if r.first_reporter else 0 for r in pending),
        approved_report_count=approved, rejected_report_count=user.rejected_count, reporting_suspended=user.rejected_count >= 3,
        current_tier=tier(TIERS[index]), next_tier=tier(next_) if next_ else None,
        points_to_next_tier=next_[2]-points if next_ else None, rule_version=RULE)


def reward(item):
    return dict(**fields(item, "id", "code", "name", "category", "cost", "stock", "is_demo"), available=item.stock > 0)


def redemption(item):
    return dict(**fields(item, "id", "reward_id", "cost", "created_at", "voucher_code"), status="demo_issued", is_demo=True)


def proposal(db, item, user=None):
    votes = db.scalars(select(Vote).where(Vote.proposal_id == item.id)).all()
    support = sum(v.vote == "support" for v in votes)
    oppose = sum(v.vote == "oppose" for v in votes)
    coords = location(db, get(db, Bin, item.bin_id))
    mine = next((v.vote for v in votes if user and v.user_id == user.id), None)
    return dict(**fields(item, "id", "version", "bin_id", "name", "reason", "created_at", "status", "outcome_reason", "voting_closed_at", "pending_name", "approved_name", "name_status", "rule_version"),
        longitude=coords["longitude"], latitude=coords["latitude"], district=coords["district"],
        mine=bool(user and user.id == item.user_id), my_vote=mine,
        support=support, oppose=oppose, total_votes=support+oppose,
        support_ratio=support/(support+oppose) if support+oppose else None, is_demo=True)


def month_bounds(month=None):
    try:
        value = month or now().astimezone(TAIPEI).strftime("%Y-%m")
        dt = datetime.strptime(value, "%Y-%m").replace(tzinfo=TAIPEI)
        if dt.strftime("%Y-%m") != value: raise ValueError()
        end = (dt.replace(day=28) + timedelta(days=4)).replace(day=1)
        return value, dt.astimezone(timezone.utc), end.astimezone(timezone.utc)
    except (ValueError, OverflowError):
        fail(422, "VALIDATION_ERROR", "month must be YYYY-MM")


def quota(db, user):
    month, start, end = month_bounds()
    used = db.scalar(select(func.count()).select_from(Proposal).where(Proposal.user_id == user.id, Proposal.created_at >= start, Proposal.created_at < end))
    return dict(month=month, timezone="Asia/Taipei", limit=3, used=used, remaining=max(0, 3-used))


def adoption(item):
    return fields(item, "id", "version", "bin_id", "role", "display_name", "intro", "preferences", "status", "created_at", "updated_at", "reason")


def notification(item):
    return dict(**fields(item, "id", "type", "waste_type", "title", "message", "created_at", "read_at"), target=dict(kind=item.target_kind, id=item.target_id))
