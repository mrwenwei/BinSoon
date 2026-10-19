"""A/B/D endpoints. Legacy routers retain their wire formats and auth."""
import hashlib
from datetime import timedelta
from typing import Annotated, Literal
from uuid import UUID, uuid4
from fastapi import APIRouter, Query, Request, Response
from sqlalchemy import func, select
from app.config import get_settings
from app.models import Bin, BinState, Hotspot
from app.services import bins as bin_service
from app.schemas import District, DistrictFilter
from app.modules import schemas as s, views as v, participation as p, workflows as w, membership as economy
from app.modules.common import DB, etag, fail, get, now, page, product_lock, write
from app.modules.identity import (Admin, Citizen, CurrentUser, OptionalUser, Staff, UserOrAdmin, new_session,
                                  password_hash, password_matches, user_view)
from app.modules.models import (Adoption, AuthSession, Completion, CompletionLike, LoginAttempt,
    Notification, PointEntry, Proposal, Redemption, Report, Reward, User, Vote, WorkOrder)

router = APIRouter(prefix="/api/v1", tags=["product"], responses=s.ERROR_RESPONSES)
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]
Latitude = Annotated[float | None, Query(ge=-90, le=90, allow_inf_nan=False)]
Longitude = Annotated[float | None, Query(ge=-180, le=180, allow_inf_nan=False)]


def position(latitude, longitude, required=False):
    if (latitude is None) != (longitude is None) or required and latitude is None:
        fail(422, "VALIDATION_ERROR", "Provide both latitude and longitude")
    return dict(latitude=latitude, longitude=longitude) if latitude is not None else None


def paged(db, model, render, limit, offset, *conditions):
    query = select(model).where(*conditions).order_by(model.created_at.desc(), model.id)
    total = db.scalar(select(func.count()).select_from(model).where(*conditions))
    return dict(items=[render(item) for item in db.scalars(query.limit(limit).offset(offset))], page=dict(limit=limit, offset=offset, total=total))


@router.post("/auth/demo/login", response_model=s.SessionRead)
def login(body: s.Login, db: DB, request: Request):
    if not get_settings().demo_auth_enabled: fail(503, "DEMO_AUTH_DISABLED")
    product_lock(db)
    # Fixed-length hashes avoid persisting account/IP in attempt keys or logs.
    keys = [hashlib.sha256(value.encode()).hexdigest() for value in ("account:"+body.account, "source:"+(request.client.host if request.client else "unknown"))]
    attempts = []
    for key in keys:
        item = db.get(LoginAttempt, key)
        if item is None:
            item = LoginAttempt(key=key, attempts=0, started_at=now())
            db.add(item)
        if item.started_at < now()-timedelta(minutes=5): item.started_at, item.attempts = now(), 0
        if item.attempts >= (20 if key == keys[0] else 100):
            db.commit()
            fail(429, "RATE_LIMITED")
        item.attempts += 1
        attempts.append(item)
    user = db.scalar(select(User).where(User.account == body.account))
    # Scrypt performed for unknown accounts too, to avoid a cheap account oracle.
    valid = password_matches(body.password, user.password_hash) if user else password_matches(body.password, password_hash("unknown-account"))
    if user is None or not valid or not user.enabled:
        db.commit()
        fail(401, "UNAUTHENTICATED")
    attempts[0].attempts = 0
    result = new_session(db, user)
    db.commit()
    return result


@router.delete("/auth/session", status_code=204)
def logout(db: DB, user: CurrentUser, request: Request):
    get(db, AuthSession, request.state.auth_session_id).revoked = True
    db.commit()


@router.get("/me", response_model=s.UserRead)
def me(user: CurrentUser):
    return user_view(user)


def map_items(db, district, kind, q, filter_, include_proposed, include_removed, pos):
    items = []
    states = {s.bin_id:s for s in db.scalars(select(BinState))} if kind != "place" else {}
    repair_ids = set(db.scalars(select(WorkOrder.bin_id).where(WorkOrder.type == "broken", WorkOrder.arrived_at.is_not(None), WorkOrder.status.not_in(v.CLOSED)))) if kind != "place" else set()
    for model in ([Bin] if kind == "bin" else [Hotspot] if kind == "place" else [Bin, Hotspot]):
        query = bin_service.location_query(model)
        if pos:
            point = func.ST_SetSRID(func.ST_MakePoint(pos["longitude"], pos["latitude"]), 4326)
            query = query.add_columns(func.ST_Distance(model.location, point).label("distance_m"))
        if district != "all": query = query.where(model.district == district)
        for row in db.execute(query.order_by(model.id)):
            item = row[0]
            if q and q not in f"{item.name} {item.district} {getattr(item, 'address', '') or ''}": continue
            if isinstance(item, Bin):
                if not include_proposed and not v.installed(item): continue
                if item.removed_at and not include_removed and now()-item.removed_at > timedelta(days=7): continue
            loc = v.location(db, item, pos, coordinates=(row.longitude,row.latitude), state=states.get(item.id), repair_ids=repair_ids,
                             known_distance=float(row.distance_m) if pos else None)
            st = loc["bin_status"]
            if st:
                if filter_ == "hungry" and (st["fill_status"] != "hungry" or not st["is_usable"]): continue
                if filter_ == "can_fit" and not st["is_usable"]: continue
                if filter_ == "new" and not st["is_new"]: continue
            items.append(loc)
    return sorted(items, key=lambda item: (item["distance_m"] if pos else 0, str(item["id"])))


@router.get("/map/locations", response_model=s.Page[s.Location])
def map_locations(db: DB, user: OptionalUser, district: DistrictFilter="大安區", kind: Literal["bin", "place", "all"]="bin",
    q: Annotated[str, Query(max_length=200)]="", filter: Literal["all", "hungry", "can_fit", "new"]="all",
    include_proposed: bool=False, include_removed: bool=False, latitude: Latitude=None, longitude: Longitude=None,
    limit: Limit=20, offset: Offset=0):
    return page(map_items(db, district, kind, q.strip(), filter, include_proposed, include_removed, position(latitude, longitude)), limit, offset)


@router.get("/map/nearest-usable", response_model=s.Locations)
def nearest(db: DB, district: DistrictFilter="大安區", q: Annotated[str, Query(max_length=200)]="",
    latitude: Latitude=None, longitude: Longitude=None, limit: Annotated[int, Query(ge=1, le=10)]=3):
    items = map_items(db, district, "bin", q.strip(), "can_fit", False, False, position(latitude, longitude, True))
    return dict(items=items[:limit])


@router.get("/map/availability", response_model=s.Nearby)
def availability(db: DB, user: OptionalUser, latitude: Latitude=None, longitude: Longitude=None,
    radius_m: Annotated[int, Query(ge=300, le=300)]=300):
    pos = position(latitude, longitude, True)
    candidates = [b for b in map_items(db, "all", "bin", "", "all", False, True, pos) if b["bin_status"]["operational_status"] != "removed"]
    nearby_proposals = [v.proposal(db, prop, user) for prop in db.scalars(select(Proposal).where(Proposal.status != "declined"))
                        if v.distance(db, get(db, Bin, prop.bin_id), pos) <= radius_m]
    within = [b for b in candidates if b["distance_m"] <= radius_m]
    return dict(has_existing_bin_within_radius=bool(within), radius_m=radius_m,
        nearest_installed_bin=candidates[0] if candidates else None, bins=within, proposals=nearby_proposals)


@router.get("/bins/{bin_id}/view", response_model=s.BinView)
def bin_view(bin_id: UUID, db: DB, user: OptionalUser):
    return v.bin_view(db, get(db, Bin, bin_id), user)


@router.get("/bins/{bin_id}/lifecycle", response_model=s.Lifecycle)
def lifecycle(bin_id: UUID, db: DB, user: Admin, response: Response):
    item = get(db, Bin, bin_id)
    response.headers["ETag"] = etag(item)
    return v.lifecycle(item)


@router.post("/admin/bins/{bin_id}/lifecycle", response_model=s.Lifecycle)
def remove(bin_id: UUID, body: s.Remove, db: DB, user: Admin, request: Request, response: Response):
    return write(db, request, response, user, body.model_dump(), lambda: p.remove_bin(db, bin_id, request, body))


@router.post("/reports", response_model=s.ReportRead, status_code=201)
def create_report(body: s.ReportCreate, db: DB, user: Citizen, request: Request, response: Response):
    return write(db, request, response, user, body.model_dump(), lambda: w.create_report(db, user, body), 201)


@router.get("/me/reports", response_model=s.Page[s.ReportRead])
def my_reports(db: DB, user: Citizen, status: Literal["pending", "processing", "approved", "rejected"]|None=None,
    bin_id: UUID|None=None, limit: Limit=20, offset: Offset=0):
    query = select(Report).where(Report.user_id == user.id).order_by(Report.created_at.desc(), Report.id)
    if bin_id: query = query.where(Report.bin_id == bin_id)
    items = [v.report(db, r) for r in db.scalars(query)]
    if status: items = [r for r in items if r["status"] == status]
    return page(items, limit, offset)


@router.get("/reports/{report_id}", response_model=s.ReportRead)
def report_detail(report_id: UUID, db: DB, user: UserOrAdmin):
    item = get(db, Report, report_id)
    bin_ = get(db, Bin, item.bin_id)
    if user is not None and item.user_id != user.id and "admin" not in user.roles and not ("staff" in user.roles and bin_.district in user.districts): fail(404, "NOT_FOUND")
    return v.report(db, item)


@router.get("/staff/work-orders", response_model=s.Page[s.WorkRead])
def work_orders(db: DB, user: Staff, bucket: Literal["pending", "processing", "completed", "all"]="all",
    district: District|None=None, type: s.Problem|None=None, source: Literal["citizen", "sensor", "inspection"]|None=None,
    limit: Limit=20, offset: Offset=0):
    if district and district not in user.districts: fail(403, "FORBIDDEN")
    query = select(WorkOrder).where(WorkOrder.district.in_([district] if district else user.districts))
    if type: query = query.where(WorkOrder.type == type)
    if source: query = query.where(WorkOrder.source == source)
    if bucket != "all":
        statuses = {"pending":["pending"], "processing":["processing", "arrived", "waiting_sensor", "repair"], "completed":["completed", "dismissed"]}
        query = query.where(WorkOrder.status.in_(statuses[bucket]))
    return page(sorted([v.work(db, item) for item in db.scalars(query)], key=v.work_sort), limit, offset)


@router.get("/staff/work-orders/{id}", response_model=s.WorkDetail)
def work_detail(id: UUID, db: DB, user: Staff, response: Response):
    item = w.staff_access(db, id, user)
    response.headers["ETag"] = etag(item)
    return v.work_detail(db, item)


def register_work(path, command, body_type, result_type):
    def endpoint(id: UUID, body, db: DB, user: Staff, request: Request, response: Response):
        return write(db, request, response, user, body.model_dump(), lambda: w.work_command(db, id, user, request, command, body))
    endpoint.__annotations__["body"] = body_type
    router.add_api_route("/staff/work-orders/{id}/"+path, endpoint, methods=["POST"], response_model=result_type, name="work_"+command)


for _path, _command, _body, _result in [
    ("accept", "accept", s.Empty, s.WorkRead), ("arrive", "arrive", s.Empty, s.WorkRead),
    ("evidence", "evidence", s.EvidenceCreate, s.WorkDetail), ("finish", "finish", s.Reason, s.WorkRead),
    ("defer-repair", "repair", s.RequiredReason, s.WorkRead), ("dismiss", "dismiss", s.RequiredReason, s.WorkRead)]:
    register_work(_path, _command, _body, _result)


@router.post("/staff/work-orders/{id}/reports/{report_id}/review", response_model=s.ReviewResult)
def review(id: UUID, report_id: UUID, body: s.Review, db: DB, user: Staff, request: Request, response: Response):
    return write(db, request, response, user, body.model_dump(), lambda: w.review_report(db, id, report_id, user, request, body))


@router.get("/admin/work-orders/{id}", response_model=s.WorkDetail)
def admin_work(id: UUID, db: DB, user: Admin, response: Response):
    item = get(db, WorkOrder, id)
    response.headers["ETag"] = etag(item)
    return v.work_detail(db, item)


@router.post("/admin/work-orders/{id}/demo-clear", response_model=s.ClearResult)
def clear(id: UUID, body: s.ClearCreate, db: DB, user: Admin, request: Request, response: Response):
    return write(db, request, response, user, body.model_dump(), lambda: w.demo_clear(db, id, user, request, body))


@router.get("/me/membership", response_model=s.Membership)
def membership(db: DB, user: Citizen): return v.membership(db, user)


@router.get("/me/point-entries", response_model=s.Page[s.PointRead])
def points(db: DB, user: Citizen, limit: Limit=20, offset: Offset=0):
    return paged(db, PointEntry, lambda r:v.fields(r, "id", "type", "amount", "balance_after", "report_id", "redemption_id", "created_at", "source_type"), limit, offset, PointEntry.user_id == user.id)


@router.get("/rewards", response_model=s.Page[s.RewardRead])
def rewards(db: DB, category: Literal["all", "coupon", "grand"]="all", limit: Limit=20, offset: Offset=0):
    return paged(db, Reward, v.reward, limit, offset, *([Reward.category == category] if category != "all" else []))


@router.post("/redemptions", response_model=s.RedeemResult, status_code=201)
def redeem(body: s.Redeem, db: DB, user: Citizen, request: Request, response: Response):
    return write(db, request, response, user, body.model_dump(), lambda:economy.redeem(db, user, body), 201)


@router.get("/me/redemptions", response_model=s.Page[s.RedemptionRead])
def my_redemptions(db: DB, user: Citizen, limit: Limit=20, offset: Offset=0):
    return paged(db, Redemption, v.redemption, limit, offset, Redemption.user_id == user.id)


@router.get("/redemptions/{id}", response_model=s.RedemptionRead)
def redemption_detail(id: UUID, db: DB, user: Citizen):
    item = get(db, Redemption, id)
    if item.user_id != user.id: fail(404, "NOT_FOUND")
    return v.redemption(item)


@router.get("/proposals", response_model=s.Page[s.ProposalRead])
def proposals(db: DB, user: OptionalUser, district: District="大安區", status: Literal["collecting", "village", "evaluation", "survey", "installed", "declined"]|None=None,
    limit: Limit=20, offset: Offset=0):
    query = select(Proposal).join(Bin).where(Bin.district == district).order_by(Proposal.created_at.desc(), Proposal.id)
    if status: query = query.where(Proposal.status == status)
    return page([v.proposal(db, item, user) for item in db.scalars(query)], limit, offset)


@router.get("/proposals/{id}", response_model=s.ProposalRead)
def proposal_detail(id: UUID, db: DB, user: OptionalUser, response: Response):
    item = get(db, Proposal, id)
    response.headers["ETag"] = etag(item)
    return v.proposal(db, item, user)


@router.get("/me/proposals", response_model=s.Page[s.ProposalRead])
def my_proposals(db: DB, user: Citizen, limit: Limit=20, offset: Offset=0):
    return paged(db, Proposal, lambda item:v.proposal(db, item, user), limit, offset, Proposal.user_id == user.id)


@router.get("/me/votes", response_model=s.Page[s.ProposalRead])
def my_votes(db: DB, user: Citizen, limit: Limit=20, offset: Offset=0):
    votes = db.scalars(select(Vote).where(Vote.user_id == user.id, Vote.vote.is_not(None)).order_by(Vote.updated_at.desc(), Vote.id))
    return page([v.proposal(db, get(db, Proposal, vote.proposal_id), user) for vote in votes], limit, offset)


@router.get("/me/proposal-quota", response_model=s.Quota)
def proposal_quota(db: DB, user: Citizen): return v.quota(db, user)


@router.post("/proposals", response_model=s.ProposalCreated, status_code=201)
def create_proposal(body: s.ProposalCreate, db: DB, user: Citizen, request: Request, response: Response):
    return write(db, request, response, user, body.model_dump(), lambda:p.create_proposal(db, user, body), 201)


@router.post("/proposals/{id}/vote", response_model=s.ProposalRead)
def vote(id: UUID, body: s.VoteCreate, db: DB, user: Citizen, request: Request, response: Response):
    return write(db, request, response, user, body.model_dump(), lambda:p.vote(db, id, user, body))


def register_proposal(path, command, body_type, admin):
    def endpoint(id: UUID, body, db: DB, user, request: Request, response: Response):
        return write(db, request, response, user, body.model_dump(), lambda:p.proposal_command(db, id, user, request, command, body))
    endpoint.__annotations__.update(body=body_type, user=Admin if admin else Citizen)
    router.add_api_route(path, endpoint, methods=["POST"], response_model=s.ProposalRead, name="proposal_"+command)


register_proposal("/admin/proposals/{id}/review", "review", s.ProposalReview, True)
register_proposal("/proposals/{id}/name-requests", "name", s.NameCreate, False)
register_proposal("/admin/proposals/{id}/name-review", "name_review", s.NameReview, True)


@router.post("/adoptions", response_model=s.AdoptionRead, status_code=201)
def create_adoption(body: s.AdoptionCreate, db: DB, user: Citizen, request: Request, response: Response):
    return write(db, request, response, user, body.model_dump(), lambda:p.create_adoption(db, user, body), 201)


@router.get("/me/adoptions", response_model=s.Page[s.AdoptionRead])
def my_adoptions(db: DB, user: Citizen, status: Literal["pending", "active", "rejected", "withdrawn", "ended"]|None=None,
    limit: Limit=20, offset: Offset=0):
    conditions = [Adoption.user_id == user.id]
    if status: conditions.append(Adoption.status == status)
    return paged(db, Adoption, v.adoption, limit, offset, *conditions)


@router.get("/admin/adoptions", response_model=s.Page[s.AdoptionRead])
def admin_adoptions(db: DB, user: Admin, status: Literal["pending", "active", "rejected", "withdrawn", "ended"]|None=None,
    district: District|None=None, limit: Limit=20, offset: Offset=0):
    query = select(Adoption).join(Bin).order_by(Adoption.created_at.desc(), Adoption.id)
    if status: query = query.where(Adoption.status == status)
    if district: query = query.where(Bin.district == district)
    return page([v.adoption(item) for item in db.scalars(query)], limit, offset)


@router.get("/adoptions/{id}", response_model=s.AdoptionRead)
def adoption_detail(id: UUID, db: DB, user: UserOrAdmin, response: Response):
    item = get(db, Adoption, id)
    if user is not None and item.user_id != user.id and "admin" not in user.roles: fail(404, "NOT_FOUND")
    response.headers["ETag"] = etag(item)
    return v.adoption(item)


def register_adoption(path, command, body_type, admin=False, method="POST"):
    def endpoint(id: UUID, body, db: DB, user, request: Request, response: Response):
        return write(db, request, response, user, body.model_dump(), lambda:p.adoption_command(db, id, user, request, command, body))
    endpoint.__annotations__.update(body=body_type, user=Admin if admin else Citizen)
    router.add_api_route(path, endpoint, methods=[method], response_model=s.AdoptionRead, name="adoption_"+command)


register_adoption("/adoptions/{id}/withdraw", "withdraw", s.Empty)
register_adoption("/adoptions/{id}/end", "end", s.Reason)
register_adoption("/adoptions/{id}/preferences", "preferences", s.Preferences, method="PATCH")
register_adoption("/admin/adoptions/{id}/review", "review", s.AdoptionReview, admin=True)


@router.get("/adoptions/{id}/monthly-summary", response_model=s.AdoptionMonth)
def adoption_month(id: UUID, db: DB, user: Citizen, month: str|None=None):
    item = get(db, Adoption, id)
    if item.user_id != user.id: fail(404, "NOT_FOUND")
    value, start, end = v.month_bounds(month)
    reports = db.scalars(select(Report).where(Report.bin_id == item.bin_id, Report.user_id == user.id, Report.adopter.is_(True))).all()
    # A later reapplication cannot claim reports from an earlier adoption period.
    reports = [r for r in reports if item.activated_at and r.created_at >= item.activated_at and (item.ended_at is None or r.created_at < item.ended_at)]
    return dict(adoption_id=id, month=value, timezone="Asia/Taipei",
        reports_submitted=sum(start <= r.created_at < end for r in reports),
        reports_approved=sum(start <= r.created_at < end and r.status == "approved" for r in reports),
        points_awarded=sum(r.awarded_points for r in reports if r.settled_at and start <= r.settled_at < end),
        is_partial_month=bool(item.activated_at and item.activated_at > start or item.ended_at and item.ended_at < end), source_type="demo")


@router.get("/me/notifications", response_model=s.Page[s.NotificationRead])
def notifications(db: DB, user: CurrentUser, unread_only: bool=False, limit: Limit=20, offset: Offset=0):
    conditions = [Notification.user_id == user.id]
    if unread_only: conditions.append(Notification.read_at.is_(None))
    return paged(db, Notification, v.notification, limit, offset, *conditions)


@router.post("/me/notifications/{id}/read", response_model=s.NotificationRead)
def read_notification(id: UUID, body: s.Empty, db: DB, user: CurrentUser, request: Request, response: Response):
    def operation():
        item = get(db, Notification, id)
        if item.user_id != user.id: fail(404, "NOT_FOUND")
        if item.read_at is None: item.read_at = now()
        return v.notification(item)
    return write(db, request, response, user, {}, operation)


@router.post("/completions/{id}/like", response_model=s.Cleanup)
def like(id: UUID, body: s.Empty, db: DB, user: Citizen, request: Request, response: Response):
    def operation():
        item = get(db, Completion, id)
        latest = v.latest_cleanup(db, item.bin_id)
        if not latest or latest.id != item.id: fail(409, "INVALID_TRANSITION")
        if not db.scalar(select(CompletionLike.id).where(CompletionLike.completion_id == id, CompletionLike.user_id == user.id)):
            db.add(CompletionLike(completion_id=id, user_id=user.id))
            db.flush()
        return v.cleanup(db, item, user)
    return write(db, request, response, user, {}, operation)


@router.get("/staff/route-stops", response_model=s.RouteStops)
def route_stops(db: DB, user: Staff):
    items = [v.work(db, item) for item in db.scalars(select(WorkOrder).where(WorkOrder.district.in_(user.districts), WorkOrder.status.in_(["pending", "processing", "arrived"]),
        (WorkOrder.assigned_staff_id.is_(None)) | (WorkOrder.assigned_staff_id == user.id)))]
    stops = {}
    for item in sorted(items, key=v.work_sort):
        bin_ = get(db, Bin, item["bin_id"])
        if bin_.operational_status == "removed" or not v.installed(bin_): continue
        if bin_.id not in stops:
            loc = v.location(db, bin_)
            stops[bin_.id] = dict(bin_id=bin_.id, label=loc["label"], latitude=loc["latitude"], longitude=loc["longitude"], work_order_ids=[], priority=item["priority"])
        stops[bin_.id]["work_order_ids"].append(item["id"])
    return dict(origin=dict(**v.ORIGIN, source="demo_fixed"), stops=list(stops.values()), generated_at=now())


def outcome_data(db, district, month):
    value, start, end = v.month_bounds(month)
    completed = db.scalars(select(Completion).join(WorkOrder).where(WorkOrder.district == district,
        Completion.created_at >= start, Completion.created_at < end)).all()
    likes = db.scalar(select(func.count()).select_from(CompletionLike).where(CompletionLike.completion_id.in_([c.id for c in completed]))) if completed else 0
    return value, completed, likes


@router.get("/public/outcomes", response_model=s.PublicOutcomes)
def outcomes(db: DB, district: District="大安區", month: str|None=None):
    value, completed, likes = outcome_data(db, district, month)
    return dict(month=value, timezone="Asia/Taipei", district=district, completed_count=len(completed), like_count=likes)


@router.get("/staff/statistics", response_model=s.StaffMonth)
def statistics(db: DB, user: Staff, district: District|None=None, month: str|None=None):
    district = district or (user.districts[0] if user.districts else "大安區")
    if district not in user.districts: fail(403, "FORBIDDEN")
    value, completed, likes = outcome_data(db, district, month)
    ranking = []
    for staff in db.scalars(select(User).where(User.enabled.is_(True))):
        if "staff" not in staff.roles or district not in staff.districts: continue
        own = [c for c in completed if c.staff_id == staff.id]
        durations = []
        for completion in own:
            task = get(db, WorkOrder, completion.work_order_id)
            if task.accepted_at and task.completed_at and task.completed_at >= task.accepted_at:
                durations.append((task.completed_at-task.accepted_at).total_seconds())
        own_likes = db.scalar(select(func.count()).select_from(CompletionLike).where(CompletionLike.completion_id.in_([c.id for c in own]))) if own else 0
        ranking.append(dict(rank=0, staff_id=staff.id, display_name=staff.display_name, completed_count=len(own),
            average_processing_seconds=sum(durations)/len(durations) if durations else None, like_count=own_likes))
    ranking.sort(key=lambda item:(-item["completed_count"], str(item["staff_id"])))
    rank, previous = 0, None
    for item in ranking:
        if item["completed_count"] != previous: rank += 1
        item["rank"], previous = rank, item["completed_count"]
    mine = next((r for r in ranking if r["staff_id"] == user.id), {})
    return dict(month=value, timezone="Asia/Taipei", district=district, completed_count=mine.get("completed_count", 0),
        average_processing_seconds=mine.get("average_processing_seconds"), like_count=mine.get("like_count", 0), bonus_display_only=True, ranking=ranking)
