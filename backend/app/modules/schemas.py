from datetime import datetime
from typing import Generic, Literal, TypeVar
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.waste import WasteType

Problem = Literal["full", "dirty", "dumping", "broken", "other"]
WorkStatus = Literal["pending", "processing", "arrived", "waiting_sensor", "repair", "completed", "dismissed"]
AdoptionRole = Literal["居民", "店家", "學校", "社區團體"]
T = TypeVar("T")


class Body(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class Empty(Body):
    pass


class Position(Body):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class Login(Body):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    account: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200, json_schema_extra={"format":"password", "writeOnly":True})

    @field_validator("account")
    @classmethod
    def account_trim(cls, value):
        if not value.strip(): raise ValueError("Account is required")
        return value.strip()


class ReportCreate(Body):
    bin_id: UUID
    waste_type: WasteType = "general"
    type: Problem
    description: str = Field(default="", max_length=500)
    photo_ids: list[UUID] = Field(min_length=1, max_length=1)
    position: Position
    quick: bool = False

    @model_validator(mode="after")
    def explanation(self):
        if self.type == "other" and not self.description:
            raise ValueError("Other requires a description")
        return self


class Review(Body):
    decision: Literal["approved", "rejected"]
    reason: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def rejection(self):
        if self.decision == "rejected" and not self.reason:
            raise ValueError("Rejection requires a reason")
        return self


class Reason(Body):
    reason: str | None = Field(default=None, max_length=500)


class RequiredReason(Body):
    reason: str = Field(min_length=1, max_length=500)


class EvidenceCreate(Body):
    media_id: UUID
    purpose: Literal["completion", "site"]


class ClearCreate(Body):
    reading_id: UUID


class Redeem(Body):
    reward_id: UUID


class ProposalCreate(Position):
    name: str = Field(min_length=1, max_length=200)
    reason: str = Field(min_length=1, max_length=500)
    confirmed_nearby: bool = False


class VoteCreate(Body):
    vote: Literal["support", "oppose"] | None


class ProposalReview(Reason):
    action: Literal["village_approve", "evaluation_approve", "survey_approve", "decline"]


class NameCreate(Body):
    name: str = Field(min_length=1, max_length=30)


class NameReview(Reason):
    approve: bool


class Preferences(Body):
    full: bool
    dumping: bool
    dirty: bool


class AdoptionCreate(Body):
    bin_id: UUID
    role: AdoptionRole
    display_name: str = Field(min_length=1, max_length=50)
    intro: str = Field(default="", max_length=120)
    preferences: Preferences

    @model_validator(mode="after")
    def store_intro(self):
        if self.role != "店家" and self.intro:
            raise ValueError("Only stores may provide an introduction")
        return self


class AdoptionReview(Reason):
    decision: Literal["active", "rejected"]


class Remove(RequiredReason):
    action: Literal["remove"]


class PageInfo(BaseModel):
    limit: int
    offset: int
    total: int


class Page(BaseModel, Generic[T]):
    items: list[T]
    page: PageInfo


class UserRead(BaseModel):
    id: UUID
    display_name: str
    roles: list[Literal["citizen", "staff", "admin"]]
    districts: list[str]
    auth_source: Literal["demo"]


class SessionRead(BaseModel):
    access_token: str
    token_type: Literal["bearer"]
    expires_at: datetime
    user: UserRead


class MediaRead(BaseModel):
    id: UUID
    purpose: Literal["report", "completion", "site"]
    content_type: str
    size_bytes: int
    status: Literal["ready"]
    created_at: datetime


class AccessRead(BaseModel):
    url: str
    expires_at: datetime


class BinStatus(BaseModel):
    waste_type: WasteType = "general"
    classification_source: str = "legacy_assumed_general"
    fill_level_pct: float | None
    capacity_liters: float | None
    estimated_used_liters: float | None
    fill_status: Literal["hungry", "half", "full", "unknown"]
    operational_status: Literal["normal", "repair", "removed"]
    is_usable: bool
    unavailable_reasons: list[str]
    is_new: bool
    installed_at: datetime | None
    removed_at: datetime | None
    reading_source_type: Literal["simulated", "iot_sensor"] | None
    observed_at: datetime | None
    received_at: datetime | None
    last_emptied_at: datetime | None
    risk_priority: Literal["critical", "high", "medium", "low"] | None
    estimated_hours_to_90_pct: float | None


class Location(BaseModel):
    id: UUID
    kind: Literal["bin", "place"]
    district: str
    label: str
    address: str | None
    longitude: float
    latitude: float
    note: str
    source_type: str
    source_row: int | None
    source_file: str | None
    location_precision: str | None
    reported_count: int | None
    bin_type: Literal["existing", "proposed"] | None
    placement_status: Literal["existing", "proposed", "installed"] | None
    distance_m: float | None
    walking_estimate_seconds: int | None
    bin_status: BinStatus | None
    compartments: list[BinStatus] = Field(default_factory=list)


class Locations(BaseModel):
    items: list[Location]


class Cleanup(BaseModel):
    waste_type: WasteType = "general"
    classification_source: str = "legacy_assumed_general"
    id: UUID
    work_order_id: UUID
    bin_id: UUID
    completed_at: datetime
    like_count: int
    liked_by_me: bool
    can_like: bool


class AdoptionPublic(BaseModel):
    display_name: str
    role: AdoptionRole
    intro: str


class BinView(BaseModel):
    location: Location
    status: BinStatus
    compartments: list[BinStatus]
    adopter: AdoptionPublic | None
    latest_cleanup: Cleanup | None
    my_adoption_id: UUID | None
    can_apply_adoption: bool
    can_report: bool
    report_block_reason: str | None


class Lifecycle(BaseModel):
    bin_id: UUID
    version: int
    operational_status: str
    placement_status: str
    installed_at: datetime | None
    removed_at: datetime | None
    reason: str | None


class ReportRead(BaseModel):
    waste_type: WasteType = "general"
    classification_source: str = "legacy_assumed_general"
    id: UUID
    bin_id: UUID
    event_id: UUID
    work_order_id: UUID | None
    type: Problem
    description: str
    created_at: datetime
    status: Literal["pending", "processing", "approved", "rejected"]
    adopter: bool
    first_reporter: bool
    quick: bool
    photo_ids: list[UUID]
    accepted_at: datetime | None
    reviewed_at: datetime | None
    rejection_reason: str | None
    pending_points: int
    awarded_points: int
    settled_at: datetime | None
    rule_version: str
    event_status: Literal["open", "closed"]
    work_status: WorkStatus | None
    assignment_status: Literal["assigned", "unassigned"]


class WorkRead(BaseModel):
    waste_type: WasteType = "general"
    classification_source: str = "legacy_assumed_general"
    id: UUID
    version: int
    event_id: UUID
    bin_id: UUID
    type: Problem
    source: Literal["citizen", "sensor", "inspection"]
    status: WorkStatus
    district: str
    assigned_staff_id: UUID | None
    created_at: datetime
    accepted_at: datetime | None
    arrived_at: datetime | None
    photo_at: datetime | None
    submitted_at: datetime | None
    completed_at: datetime | None
    clear_reading_id: UUID | None
    reason: str | None
    confirmed_problem: bool | None
    priority: Literal["immediate", "high", "normal", "inspection"]
    target_at: datetime | None
    is_overdue: bool
    distance_m: float | None
    source_type: Literal["demo", "operational"]
    is_fixture: bool
    completion_id: UUID | None
    blocked_by_removed_bin: bool


class EvidenceRead(BaseModel):
    id: UUID
    media_id: UUID
    purpose: Literal["completion", "site"]
    created_at: datetime


class TaskReading(BaseModel):
    waste_type: WasteType | None = None
    classification_source: str = "legacy_unclassified"
    id: UUID
    bin_id: UUID
    work_order_id: UUID
    fill_level_pct: float
    observed_at: datetime
    received_at: datetime
    source_type: str
    event_type: Literal["collection"]


class Requirements(BaseModel):
    arrived: bool
    reports_reviewed: bool
    completion_photo: bool
    work_submitted: bool
    fresh_clear_reading: bool
    missing: list[str]


class WorkDetail(BaseModel):
    work_order: WorkRead
    location: Location
    reports: list[ReportRead]
    evidence: list[EvidenceRead]
    latest_reading: TaskReading | None
    completion_requirements: Requirements


class ReviewResult(BaseModel):
    report: ReportRead
    work_order: WorkRead


class ClearResult(BaseModel):
    reading: TaskReading
    work_order: WorkRead


class Tier(BaseModel):
    code: str
    name: str
    threshold: int


class Membership(BaseModel):
    cumulative_points: int
    available_points: int
    pending_points: int
    approved_report_count: int
    rejected_report_count: int
    reporting_suspended: bool
    current_tier: Tier
    next_tier: Tier | None
    points_to_next_tier: int | None
    rule_version: str


class PointRead(BaseModel):
    id: UUID
    type: str
    amount: int
    balance_after: int
    report_id: UUID | None
    redemption_id: UUID | None
    created_at: datetime
    source_type: str


class RewardRead(BaseModel):
    id: UUID
    code: str
    name: str
    category: Literal["coupon", "grand"]
    cost: int
    stock: int
    is_demo: bool
    available: bool


class RedemptionRead(BaseModel):
    id: UUID
    reward_id: UUID
    cost: int
    created_at: datetime
    status: Literal["demo_issued"]
    voucher_code: str
    is_demo: Literal[True]


class RedeemResult(BaseModel):
    redemption: RedemptionRead
    membership: Membership
    reward: RewardRead


class ProposalRead(BaseModel):
    id: UUID
    version: int
    bin_id: UUID
    name: str
    reason: str
    latitude: float
    longitude: float
    district: str
    created_at: datetime
    mine: bool
    support: int
    oppose: int
    total_votes: int
    support_ratio: float | None
    my_vote: Literal["support", "oppose"] | None
    status: Literal["collecting", "village", "evaluation", "survey", "installed", "declined"]
    outcome_reason: str | None
    voting_closed_at: datetime | None
    pending_name: str | None
    approved_name: str | None
    name_status: Literal["pending", "approved", "returned"] | None
    is_demo: bool
    rule_version: str


class Quota(BaseModel):
    month: str
    timezone: Literal["Asia/Taipei"]
    limit: int
    used: int
    remaining: int


class ProposalWarning(BaseModel):
    code: Literal["NEAR_EXISTING_BIN"]
    distance_m: float
    bin_id: UUID


class ProposalCreated(BaseModel):
    proposal: ProposalRead
    quota: Quota
    warnings: list[ProposalWarning]


class Nearby(BaseModel):
    has_existing_bin_within_radius: bool
    radius_m: int
    nearest_installed_bin: Location | None
    bins: list[Location]
    proposals: list[ProposalRead]


class AdoptionRead(BaseModel):
    id: UUID
    version: int
    bin_id: UUID
    role: AdoptionRole
    display_name: str
    intro: str
    preferences: Preferences
    status: Literal["pending", "active", "rejected", "withdrawn", "ended"]
    created_at: datetime
    updated_at: datetime
    reason: str


class AdoptionMonth(BaseModel):
    adoption_id: UUID
    month: str
    timezone: Literal["Asia/Taipei"]
    reports_submitted: int
    reports_approved: int
    points_awarded: int
    is_partial_month: bool
    source_type: str


class Target(BaseModel):
    kind: Literal["report", "work_order", "proposal", "adoption"]
    id: UUID


class NotificationRead(BaseModel):
    waste_type: WasteType | None = None
    id: UUID
    type: str
    title: str
    message: str
    created_at: datetime
    read_at: datetime | None
    target: Target


class Origin(Position):
    source: Literal["demo_fixed"]


class Stop(Position):
    bin_id: UUID
    label: str
    work_order_ids: list[UUID]
    waste_types: list[WasteType]
    priority: str


class RouteStops(BaseModel):
    origin: Origin
    stops: list[Stop]
    generated_at: datetime


class Rank(BaseModel):
    rank: int
    staff_id: UUID
    display_name: str
    completed_count: int
    average_processing_seconds: float | None
    like_count: int


class PublicOutcomes(BaseModel):
    waste_type: WasteType | None = None
    month: str
    timezone: Literal["Asia/Taipei"]
    district: str
    completed_count: int
    like_count: int


class StaffMonth(PublicOutcomes):
    average_processing_seconds: float | None
    bonus_display_only: Literal[True]
    ranking: list[Rank]


class ErrorField(BaseModel):
    field: str
    code: str
    message: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    fields: list[ErrorField]
    request_id: UUID


class ApiError(BaseModel):
    detail: ErrorDetail


ERROR_RESPONSES = {code:{"model":ApiError, "description":description} for code,description in {
    401:"Login required or session expired",403:"Insufficient role or reporting suspended",404:"Resource not found",
    409:"State, quota, stock, evidence or idempotency conflict",411:"Content-Length required for upload",
    412:"Refresh resource after version conflict",413:"Photo too large",415:"Unsupported photo",
    422:"Invalid fields",428:"If-Match required",429:"Retry after rate limit",503:"Demo login or storage unavailable",
}.items()}
