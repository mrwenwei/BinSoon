from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator


class AdvanceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    request_id: UUID
    generation: int = Field(ge=0, strict=True)
    minutes: int | None = Field(default=None, ge=1, le=10080, strict=True)
    real_seconds: float | None = Field(default=None, gt=0, le=604800)

    @model_validator(mode="after")
    def exactly_one_duration(self):
        if (self.minutes is None) == (self.real_seconds is None):
            raise ValueError("Provide exactly one of minutes or real_seconds")
        return self


class ClockRead(BaseModel):
    clock_id: str
    simulated_at: datetime
    simulation_status: Literal["running", "paused"]
    seed: int
    generation: int
    time_multiplier: float
    data_version: str
    clock_mode: Literal["manual"]
    source_type: Literal["simulated"]


class AdvanceRead(BaseModel):
    request_id: UUID
    generation: int
    simulated_at: datetime
    replayed: bool
