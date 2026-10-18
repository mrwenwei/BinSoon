from typing import Annotated, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from pydantic import AwareDatetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_session
from app.models import Bin, BinState, Hotspot
from app.schemas import (BinCreate, BinRead, BinGeoJSON, BinType, District, DistrictFilter,
                         HotspotRead, CandidateRead, ReadingRead, PriorityRead)
from app.security import require_admin
from app.services import bins as service, simulation

router = APIRouter(prefix="/api/v1")
DB = Annotated[Session, Depends(get_session)]
ADMIN = [Depends(require_admin)]


@router.get("/bins", response_model=list[BinRead] | BinGeoJSON)
def bins(db: DB, district: DistrictFilter = "大安區", bin_type: BinType | None = None,
         scenario_id: str | None = None, format: Literal["json", "geojson"] = "json"):
    rows = db.execute(service.filtered(service.query(), district, bin_type, scenario_id).order_by(Bin.id))
    items = [service.serialize(row) for row in rows]
    if format == "json":
        return items
    return dict(type="FeatureCollection", features=[dict(type="Feature", id=item["id"],
        geometry=dict(type="Point", coordinates=[item["longitude"], item["latitude"]]), properties=item) for item in items])


@router.post("/bins", response_model=BinRead, status_code=201, dependencies=ADMIN)
def create_bin(body: BinCreate, db: DB):
    result = service.create(db, body)
    db.commit()
    return result


@router.get("/bins/collection-priorities", response_model=list[PriorityRead])
def priorities(db: DB, district: DistrictFilter = "大安區", bin_type: BinType | None = None):
    rows = db.execute(service.filtered(select(Bin, BinState).join(BinState, BinState.bin_id == Bin.id), district, bin_type))
    items = [dict(bin_id=b.id, name=b.name, bin_type=b.bin_type, fill_level_pct=s.fill_level_pct,
                  source_type=s.source_type, last_updated_at=s.last_updated_at, **simulation.priority(s)) for b, s in rows]
    items.sort(key=lambda i: (-i["fill_level_pct"], i["estimated_hours_to_90_pct"] if i["estimated_hours_to_90_pct"] is not None else float("inf"), str(i["bin_id"])))
    return items


@router.get("/bins/{bin_id}", response_model=BinRead)
def bin_detail(bin_id: UUID, db: DB):
    return service.get(db, bin_id)


@router.get("/bins/{bin_id}/history", response_model=list[ReadingRead])
def history(bin_id: UUID, db: DB, limit: Annotated[int, Query(ge=1, le=1000)] = 100,
            offset: Annotated[int, Query(ge=0)] = 0, start: AwareDatetime | None = None,
            end: AwareDatetime | None = None, generation: Annotated[int | None, Query(ge=0)] = None,
            source_type: Literal["simulated", "iot_sensor"] | None = None):
    return service.history(db, bin_id, limit, offset, start, end, generation, source_type)


@router.post("/bins/{bin_id}/collect", response_model=BinRead, dependencies=ADMIN)
def collect(bin_id: UUID, db: DB):
    simulation.collect(db, bin_id)
    result = service.get(db, bin_id)
    db.commit()
    return result


@router.get("/hotspots", response_model=list[HotspotRead])
def hotspots(db: DB, district: District = "大安區"):
    rows = db.execute(service.location_query(Hotspot).where(Hotspot.district == district).order_by(Hotspot.id))
    return [dict({col.name: getattr(row[0], col.name) for col in Hotspot.__table__.columns if col.name != "location"},
                 longitude=row.longitude, latitude=row.latitude) for row in rows]


@router.get("/candidates", response_model=list[CandidateRead], deprecated=True)
def candidates(db: DB, district: District = "大安區"):
    rows = db.execute(service.candidate_query().where(Bin.district == district).order_by(Bin.id))
    return [service.serialize_candidate(row) for row in rows]


@router.post("/candidates", response_model=CandidateRead, status_code=201, deprecated=True, dependencies=ADMIN)
def create_candidate(body: BinCreate, db: DB):
    result = service.create(db, body)
    legacy = service.legacy_candidate(db, result["id"])
    db.commit()
    return legacy
