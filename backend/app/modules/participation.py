"""Proposals, votes, adoption and related transactions."""
import json
from functools import lru_cache
from pathlib import Path
from uuid import uuid4
from sqlalchemy import func, select
from app.models import Bin
from app.services import bins, simulation
from app.modules import views
from app.modules.common import fail, get, now, notify, version
from app.modules.models import Adoption, Proposal, ProposalReview, Report, Vote


@lru_cache
def boundaries():
    return json.loads((Path(__file__).resolve().parents[2] / "data/taipei_districts.geojson").read_text())["features"]


def validate_daan(db, body):
    point = func.ST_SetSRID(func.ST_MakePoint(body.longitude, body.latitude), 4326)
    matches = []
    for feature in boundaries():
        polygon = func.ST_SetSRID(func.ST_GeomFromGeoJSON(json.dumps(feature["geometry"])), 4326)
        if db.scalar(select(func.ST_Covers(polygon, point))): matches.append(feature["properties"]["district"])
    if matches != ["大安區"]: fail(422, "OUTSIDE_SUPPORTED_BOUNDARY", "Point must be unambiguously inside 大安區")


def create_proposal(db, user, body):
    if views.quota(db, user)["remaining"] == 0: fail(409, "MONTHLY_QUOTA_EXCEEDED")
    validate_daan(db, body)
    position = body.model_dump()
    for proposal in db.scalars(select(Proposal)):
        if views.distance(db, get(db, Bin, proposal.bin_id), position) <= 50 and not body.confirmed_nearby:
            fail(409, "NEARBY_PROPOSAL", "Review nearby proposals and confirm this is a different need",
                 [dict(field="confirmed_nearby", code="confirmation_required", message="Review nearby proposals")])
    warnings = []
    for bin_ in db.scalars(select(Bin).where(Bin.placement_status.in_(["existing", "installed"]), Bin.operational_status != "removed")):
        distance = views.distance(db, bin_, position)
        if distance <= 150: warnings.append(dict(code="NEAR_EXISTING_BIN", distance_m=distance, bin_id=bin_.id))
    bin_ = Bin(name=body.name, district="大安區", note="市民提案，尚未現勘設置", bin_type="proposed",
        source_type="user_proposal", status="needs_field_validation", placement_status="proposed", feasibility_status="pending_review",
        location=func.ST_SetSRID(func.ST_MakePoint(body.longitude, body.latitude), 4326))
    db.add(bin_)
    db.flush()
    simulation.initialize(db)
    proposal = Proposal(bin_id=bin_.id, user_id=user.id, name=body.name, reason=body.reason)
    db.add(proposal)
    db.flush()
    db.add(Vote(proposal_id=proposal.id, user_id=user.id, vote="support"))
    db.flush()
    return dict(proposal=views.proposal(db, proposal, user), quota=views.quota(db, user), warnings=warnings)


def vote(db, id_, user, body):
    item = get(db, Proposal, id_)
    if item.status != "collecting": fail(409, "VOTING_CLOSED")
    old = db.scalar(select(Vote).where(Vote.proposal_id == id_, Vote.user_id == user.id))
    if old is not None and old.vote == body.vote or old is None and body.vote is None:
        return views.proposal(db, item, user)
    if old is None:
        db.add(Vote(proposal_id=id_, user_id=user.id, vote=body.vote))
    else:
        old.vote, old.updated_at = body.vote, now()
    db.flush()
    totals = views.proposal(db, item, user)
    if totals["total_votes"] >= 60:
        item.status = "evaluation" if totals["support"] * 100 >= totals["total_votes"] * 60 else "village"
        item.voting_closed_at = now()
        notify(db, item.user_id, "proposal_updated", "proposal", item.id, f"vote-closed:{item.id}", "投票已達門檻", item.status)
    item.version += 1
    db.flush()
    return views.proposal(db, item, user)


def proposal_command(db, id_, user, request, command, body):
    item = get(db, Proposal, id_)
    version(item, request)
    bin_ = get(db, Bin, item.bin_id)
    action = command
    name = None
    reason = getattr(body, "reason", None)
    if command == "review":
        allowed = {"village_approve":("village", "evaluation"), "evaluation_approve":("evaluation", "survey"), "survey_approve":("survey", "installed")}
        action = body.action
        if action == "decline":
            if item.status not in {"village", "evaluation", "survey"} or not reason: fail(409, "INVALID_TRANSITION")
            item.status, item.outcome_reason = "declined", reason
            bin_.feasibility_status = "rejected"
        else:
            before, after = allowed[action]
            if item.status != before: fail(409, "INVALID_TRANSITION")
            item.status = after
            if after == "installed":
                bin_.placement_status, bin_.installed_at, bin_.feasibility_status = "installed", now(), "approved"
                bin_.version += 1
    elif command == "name":
        if item.user_id != user.id: fail(404, "NOT_FOUND")
        if item.status != "installed" or item.name_status == "pending": fail(409, "INVALID_TRANSITION")
        item.pending_name, item.name_status, name = body.name, "pending", body.name
    elif command == "name_review":
        if item.name_status != "pending": fail(409, "INVALID_TRANSITION")
        if not body.approve and not reason: fail(422, "VALIDATION_ERROR", "Rejection requires a reason")
        name = item.pending_name
        item.name_status = "approved" if body.approve else "returned"
        if body.approve:
            item.approved_name, bin_.name = item.pending_name, item.pending_name
            bin_.version += 1
    item.version += 1
    db.add(ProposalReview(proposal_id=item.id, actor=str(user.id) if user else "maintenance-admin", action=action, reason=reason, name=name))
    notify(db, item.user_id, "proposal_updated", "proposal", item.id, f"proposal:{item.id}:v{item.version}", "提案進度更新", item.status)
    db.flush()
    return views.proposal(db, item, user)


def create_adoption(db, user, body):
    bin_ = get(db, Bin, body.bin_id)
    if not views.installed(bin_) or bin_.operational_status == "removed": fail(409, "BIN_UNAVAILABLE")
    if views.active_adoption(db, bin_.id) or db.scalar(select(Adoption.id).where(Adoption.user_id == user.id,
        Adoption.bin_id == bin_.id, Adoption.status.in_(["pending", "active"]))): fail(409, "ADOPTION_CONFLICT")
    item = Adoption(user_id=user.id, **body.model_dump())
    db.add(item)
    db.flush()
    return views.adoption(item)


def adoption_command(db, id_, user, request, command, body):
    item = get(db, Adoption, id_)
    if command != "review" and item.user_id != user.id: fail(404, "NOT_FOUND")
    version(item, request)
    if command == "preferences":
        if item.status != "active": fail(409, "INVALID_TRANSITION")
        item.preferences = body.model_dump()
    elif command == "review":
        if item.status != "pending": fail(409, "INVALID_TRANSITION")
        if body.decision == "rejected" and not body.reason: fail(422, "VALIDATION_ERROR", "Rejection requires a reason")
        bin_ = get(db, Bin, item.bin_id)
        if body.decision == "active":
            if views.active_adoption(db, item.bin_id): fail(409, "ADOPTION_CONFLICT")
            if not views.installed(bin_) or bin_.operational_status == "removed": fail(409, "BIN_UNAVAILABLE")
            item.activated_at = now()
        item.status, item.reason = body.decision, body.reason or ""
    elif command == "withdraw":
        if item.status != "pending": fail(409, "INVALID_TRANSITION")
        item.status = "withdrawn"
    elif command == "end":
        if item.status != "active": fail(409, "INVALID_TRANSITION")
        item.status, item.ended_at, item.reason = "ended", now(), body.reason or ""
        item.preferences = dict(full=False, dirty=False, dumping=False)
    item.version += 1
    item.updated_at = now()
    notify(db, item.user_id, "adoption_updated", "adoption", item.id, f"adoption:{item.id}:v{item.version}", "認養資料更新", item.status)
    db.flush()
    return views.adoption(item)


def remove_bin(db, id_, request, body):
    item = get(db, Bin, id_)
    version(item, request)
    if item.operational_status == "removed": fail(409, "INVALID_TRANSITION")
    item.operational_status, item.removed_at, item.lifecycle_reason = "removed", now(), body.reason
    item.version += 1
    for adoption in db.scalars(select(Adoption).where(Adoption.bin_id == id_, Adoption.status.in_(["pending", "active"]))):
        adoption.status, adoption.ended_at, adoption.updated_at = "ended", now(), now()
        adoption.reason, adoption.preferences = body.reason, dict(full=False, dumping=False, dirty=False)
        adoption.version += 1
        notify(db, adoption.user_id, "adoption_updated", "adoption", adoption.id, f"removed:{adoption.id}", "桶已撤除，認養結束")
    db.flush()
    return views.lifecycle(item)
