from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

District = Literal["中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"]
DistrictFilter = District | Literal["all"]
BinType = Literal["existing", "proposed"]


class BinCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)
    name: str = Field(min_length=1, max_length=200)
    district: District = "大安區"
    longitude: float = Field(ge=-180, le=180)
    latitude: float = Field(ge=-90, le=90)
    note: str = Field(default="", max_length=5000)


class LocationRead(BaseModel):
    id: UUID
    district: str
    longitude: float
    latitude: float
    source_type: str
    source_row: int | None
    source_file: str | None
    note: str
    created_at: datetime
    updated_at: datetime


class UsageRead(BaseModel):
    fill_level_pct: float
    capacity_liters: float
    estimated_used_liters: float
    fill_rate_pct_per_hour: float
    source_type: str
    recorded_at: datetime
    last_emptied_at: datetime | None
    priority: Literal["critical", "high", "medium", "low"]
    estimated_hours_to_90_pct: float | None


class BinRead(LocationRead):
    bin_type: BinType
    name: str
    address: str | None
    status: str
    location_precision: str | None
    placement_status: str
    feasibility_status: str | None
    external_id: str | None
    scenario_id: str | None
    rank: int | None
    demand_score: float | None
    reason: str | None
    boundary_warning: str | None
    current_usage: UsageRead | None


class HotspotRead(LocationRead):
    name: str
    reported_count: int
    location_precision: str


class CandidateRead(LocationRead):
    """Deprecated wire format; proposed bins have no independent model/table."""
    name: str
    status: str
    nearest_bin_distance_m: float | None


class ReadingRead(BaseModel):
    id: UUID
    bin_id: UUID
    fill_level_pct: float
    recorded_at: datetime
    source_type: str
    event_type: Literal["measurement", "collection", "reset"]
    generation: int | None


class PriorityRead(BaseModel):
    bin_id: UUID
    name: str
    bin_type: BinType
    fill_level_pct: float
    source_type: str
    last_updated_at: datetime
    priority: Literal["critical", "high", "medium", "low"]
    estimated_hours_to_90_pct: float | None


class BinGeometry(BaseModel):
    type: Literal["Point"]
    coordinates: tuple[float, float]


class BinFeature(BaseModel):
    type: Literal["Feature"]
    id: UUID
    geometry: BinGeometry
    properties: BinRead


class BinGeoJSON(BaseModel):
    type: Literal["FeatureCollection"]
    features: list[BinFeature]
