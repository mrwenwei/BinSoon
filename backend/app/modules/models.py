"""Persistent product entities. Geography and monitoring remain in app.models."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Entity:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), server_default=func.now())


class Version:
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")


class User(Entity, Base):
    __tablename__ = "users"
    account: Mapped[str] = mapped_column(String(100), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    display_name: Mapped[str] = mapped_column(String(100))
    roles: Mapped[list] = mapped_column(JSONB)
    districts: Mapped[list] = mapped_column(JSONB)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    available_points: Mapped[int] = mapped_column(Integer, default=0)
    cumulative_points: Mapped[int] = mapped_column(Integer, default=0)
    rejected_count: Mapped[int] = mapped_column(Integer, default=0)
    __table_args__ = (CheckConstraint("available_points >= 0 AND cumulative_points >= 0 AND rejected_count >= 0"),)


class AuthSession(Entity, Base):
    __tablename__ = "auth_sessions"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer)


class Idempotency(Entity, Base):
    __tablename__ = "idempotency_records"
    actor: Mapped[str] = mapped_column(String(64))
    key: Mapped[uuid.UUID] = mapped_column()
    path: Mapped[str] = mapped_column(String(255))
    body_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSONB)
    status_code: Mapped[int] = mapped_column(Integer)
    etag: Mapped[str | None] = mapped_column(String(30))
    __table_args__ = (UniqueConstraint("actor", "key", "path"),)


class MediaAsset(Entity, Base):
    __tablename__ = "media_assets"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    purpose: Mapped[str] = mapped_column(String(20))
    content_type: Mapped[str] = mapped_column(String(40))
    size_bytes: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(String(150), unique=True)
    sha256: Mapped[str] = mapped_column(String(64))


class Incident(Entity, Base):
    __tablename__ = "incidents"
    bin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bins.id"), index=True)
    type: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="open")
    first_report_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("reports.id", use_alter=True,
        name="fk_incident_first_report", deferrable=True, initially="DEFERRED"))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (Index("uq_incident_open", "bin_id", "type", unique=True, postgresql_where=text("status = 'open'")),)


class Report(Entity, Base):
    __tablename__ = "reports"
    bin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bins.id"))
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidents.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    adopter: Mapped[bool] = mapped_column(Boolean)
    first_reporter: Mapped[bool] = mapped_column(Boolean)
    quick: Mapped[bool] = mapped_column(Boolean)
    photo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("media_assets.id"), unique=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(String(500))
    awarded_points: Mapped[int] = mapped_column(Integer, default=0)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rule_version: Mapped[str] = mapped_column(String(40), default="phase1-2026-10-19")
    __table_args__ = (UniqueConstraint("event_id", "user_id"),)


class WorkOrder(Entity, Version, Base):
    __tablename__ = "work_orders"
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidents.id"), unique=True)
    bin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bins.id"), index=True)
    type: Mapped[str] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(20), default="citizen")
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    district: Mapped[str] = mapped_column(String(20))
    assigned_staff_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    photo_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    clear_reading_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("bin_readings.id"), unique=True)
    reason: Mapped[str | None] = mapped_column(String(500))
    confirmed_problem: Mapped[bool | None] = mapped_column(Boolean)
    is_fixture: Mapped[bool] = mapped_column(Boolean, default=False)


class Evidence(Entity, Base):
    __tablename__ = "work_order_evidence"
    work_order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("work_orders.id"))
    media_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("media_assets.id"), unique=True)
    purpose: Mapped[str] = mapped_column(String(20))
    __table_args__ = (UniqueConstraint("work_order_id", "purpose"),)


class Completion(Entity, Base):
    __tablename__ = "completions"
    work_order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("work_orders.id"), unique=True)
    bin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bins.id"), index=True)
    staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    type: Mapped[str] = mapped_column(String(20))


class WorkAction(Entity, Base):
    __tablename__ = "work_order_actions"
    work_order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("work_orders.id"))
    actor: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict] = mapped_column(JSONB)


class PointEntry(Entity, Base):
    __tablename__ = "point_entries"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(20))
    amount: Mapped[int] = mapped_column(Integer)
    balance_after: Mapped[int] = mapped_column(Integer)
    report_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("reports.id"), unique=True)
    redemption_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("redemptions.id"), unique=True)
    source_type: Mapped[str] = mapped_column(String(20), default="demo")
    __table_args__ = (CheckConstraint("balance_after >= 0"),)


class Reward(Entity, Base):
    __tablename__ = "rewards"
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(20))
    cost: Mapped[int] = mapped_column(Integer)
    stock: Mapped[int] = mapped_column(Integer)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (CheckConstraint("stock >= 0 AND cost > 0"),)


class Redemption(Entity, Base):
    __tablename__ = "redemptions"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    reward_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rewards.id"))
    cost: Mapped[int] = mapped_column(Integer)
    voucher_code: Mapped[str] = mapped_column(String(80), unique=True)


class Proposal(Entity, Version, Base):
    __tablename__ = "proposals"
    bin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bins.id"), unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    reason: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="collecting")
    outcome_reason: Mapped[str | None] = mapped_column(String(500))
    voting_closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pending_name: Mapped[str | None] = mapped_column(String(30))
    approved_name: Mapped[str | None] = mapped_column(String(30))
    name_status: Mapped[str | None] = mapped_column(String(20))
    rule_version: Mapped[str] = mapped_column(String(40), default="phase1-2026-10-19")


class Vote(Entity, Base):
    __tablename__ = "proposal_votes"
    proposal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("proposals.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    vote: Mapped[str | None] = mapped_column(String(20))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("proposal_id", "user_id"), CheckConstraint("vote IS NULL OR vote IN ('support','oppose')"))


class ProposalReview(Entity, Base):
    __tablename__ = "proposal_reviews"
    proposal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("proposals.id"))
    actor: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(40))
    reason: Mapped[str | None] = mapped_column(String(500))
    name: Mapped[str | None] = mapped_column(String(30))


class Adoption(Entity, Version, Base):
    __tablename__ = "adoptions"
    bin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bins.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    display_name: Mapped[str] = mapped_column(String(50))
    intro: Mapped[str] = mapped_column(String(120))
    preferences: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(String(500), default="")
    __table_args__ = (
        Index("uq_adoption_active", "bin_id", unique=True, postgresql_where=text("status = 'active'")),
        Index("uq_adoption_pending_user", "bin_id", "user_id", unique=True, postgresql_where=text("status IN ('pending','active')")),)


class Notification(Entity, Base):
    __tablename__ = "notifications"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(100))
    message: Mapped[str] = mapped_column(String(500))
    target_kind: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[uuid.UUID] = mapped_column()
    dedup_key: Mapped[str] = mapped_column(String(150))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (UniqueConstraint("user_id", "dedup_key"),)


class CompletionLike(Entity, Base):
    __tablename__ = "completion_likes"
    completion_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("completions.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    __table_args__ = (UniqueConstraint("completion_id", "user_id"),)
