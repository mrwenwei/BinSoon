import uuid
from datetime import datetime
from geoalchemy2 import Geography
from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class LocationMixin:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    district: Mapped[str] = mapped_column(String(20), index=True)
    location = mapped_column(Geography(geometry_type="POINT", srid=4326, spatial_index=True), nullable=False)
    source_type: Mapped[str] = mapped_column(String(100))
    source_row: Mapped[int | None] = mapped_column(Integer)
    source_file: Mapped[str | None] = mapped_column(String(255))
    note: Mapped[str] = mapped_column(Text, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TrashBin(LocationMixin, Base):
    __tablename__ = "trash_bins"
    __table_args__ = (UniqueConstraint("source_type", "source_row"),)
    address: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="existing")
    location_precision: Mapped[str] = mapped_column(String(100))


class Hotspot(LocationMixin, Base):
    __tablename__ = "hotspots"
    __table_args__ = (UniqueConstraint("source_type", "source_row"), CheckConstraint("reported_count >= 0"))
    name: Mapped[str] = mapped_column(Text)
    reported_count: Mapped[int] = mapped_column(Integer)
    location_precision: Mapped[str] = mapped_column(String(100))


class CandidateLocation(LocationMixin, Base):
    __tablename__ = "candidate_locations"
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(40), default="needs_field_validation", server_default="needs_field_validation")
