from datetime import datetime
from uuid import UUID
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

District = Literal["中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"]


class CandidateCreate(BaseModel):
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


class BinRead(LocationRead):
    address: str
    status: str
    location_precision: str


class HotspotRead(LocationRead):
    name: str
    reported_count: int
    location_precision: str


class CandidateRead(LocationRead):
    name: str
    status: str
    nearest_bin_distance_m: float | None
