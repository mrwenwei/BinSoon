import uuid
from datetime import datetime
from geoalchemy2 import Geography
from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class LocationMixin:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    district: Mapped[str] = mapped_column(String(20), index=True)
    location = mapped_column(Geography("POINT", srid=4326, spatial_index=True), nullable=False)
    source_type: Mapped[str] = mapped_column(String(100))
    source_row: Mapped[int | None] = mapped_column(Integer)
    source_file: Mapped[str | None] = mapped_column(String(255))
    note: Mapped[str] = mapped_column(Text, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Bin(LocationMixin, Base):
    """One identity for official inventory and newly proposed bins."""
    __tablename__ = "bins"
    __table_args__ = (UniqueConstraint("source_type", "source_row"),
                     CheckConstraint("bin_type IN ('existing', 'proposed')"))
    bin_type: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40))
    location_precision: Mapped[str | None] = mapped_column(String(100))
    external_id: Mapped[str | None] = mapped_column(String(40), unique=True)
    scenario_id: Mapped[str | None] = mapped_column(String(60))
    rank: Mapped[int | None] = mapped_column(Integer)
    demand_score: Mapped[float | None] = mapped_column(Float)
    reason: Mapped[str | None] = mapped_column(Text)
    placement_status: Mapped[str] = mapped_column(String(30))
    feasibility_status: Mapped[str | None] = mapped_column(String(30))
    boundary_warning: Mapped[str | None] = mapped_column(Text)
    operational_status: Mapped[str] = mapped_column(String(20), default="normal", server_default="normal")
    installed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lifecycle_reason: Mapped[str | None] = mapped_column(String(500))
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")


class Hotspot(LocationMixin, Base):
    __tablename__ = "hotspots"
    __table_args__ = (UniqueConstraint("source_type", "source_row"), CheckConstraint("reported_count >= 0"))
    name: Mapped[str] = mapped_column(Text)
    reported_count: Mapped[int] = mapped_column(Integer)
    location_precision: Mapped[str] = mapped_column(String(100))


class SimulationClock(Base):
    __tablename__ = "simulation_clocks"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    simulated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    simulation_status: Mapped[str] = mapped_column(String(20))
    random_seed: Mapped[int] = mapped_column(Integer)
    time_multiplier: Mapped[float] = mapped_column(Float)
    data_version: Mapped[str] = mapped_column(String(40))
    generation: Mapped[int] = mapped_column(Integer, default=0)


class BinState(Base):
    __tablename__ = "bin_states"
    __table_args__ = (CheckConstraint("fill_level_pct >= 0 AND fill_level_pct <= 100"),
                     CheckConstraint("capacity_liters > 0 AND fill_rate_pct_per_hour >= 0"),
                     CheckConstraint("waste_type IN ('general','recycling')", name="ck_bin_state_waste_type"))
    bin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bins.id"), primary_key=True)
    waste_type: Mapped[str] = mapped_column(String(20), primary_key=True, default="general", server_default="general")
    classification_source: Mapped[str] = mapped_column(String(40), default="demo_assumption", server_default="demo_assumption")
    fill_level_pct: Mapped[float] = mapped_column(Float)
    capacity_liters: Mapped[float] = mapped_column(Float)
    fill_rate_pct_per_hour: Mapped[float] = mapped_column(Float)
    last_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_emptied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_type: Mapped[str] = mapped_column(String(30))

    observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    observation_sequence: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class BinReading(Base):
    __tablename__ = "bin_readings"
    __table_args__ = (CheckConstraint("fill_level_pct >= 0 AND fill_level_pct <= 100"),
                     Index("ix_bin_readings_observation", "bin_id", "waste_type", "observation_sequence"),
                     CheckConstraint("waste_type IS NULL OR waste_type IN ('general','recycling')", name="ck_bin_reading_waste_type"))
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    bin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bins.id"), index=True)
    waste_type: Mapped[str | None] = mapped_column(String(20))
    classification_source: Mapped[str] = mapped_column(String(40), default="legacy_unclassified", server_default="legacy_unclassified")
    fill_level_pct: Mapped[float] = mapped_column(Float)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    source_type: Mapped[str] = mapped_column(String(30))
    event_type: Mapped[str] = mapped_column(String(30))
    generation: Mapped[int | None] = mapped_column(Integer)
    observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    observation_sequence: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class SimulationAdvance(Base):
    __tablename__ = "simulation_advances"
    request_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    generation: Mapped[int] = mapped_column(Integer)
    minutes: Mapped[int] = mapped_column(Integer)
    simulated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


from app.modules import models as product_models  # noqa: E402,F401 -- register Alembic metadata
