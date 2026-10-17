from typing import Annotated
from fastapi import APIRouter, Depends
from geoalchemy2 import Geometry
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session
from app.database import get_session
from app.models import TrashBin, Hotspot, CandidateLocation
from app.schemas import BinRead, HotspotRead, CandidateRead, CandidateCreate, District

router = APIRouter(prefix="/api/v1")
DB = Annotated[Session, Depends(get_session)]


def location_query(model):
    geometry = cast(model.location, Geometry("POINT", srid=4326))
    return select(model, func.ST_X(geometry).label("longitude"), func.ST_Y(geometry).label("latitude"))


def serialize(row):
    obj = row[0]
    result = {column.name: getattr(obj, column.name) for column in obj.__table__.columns if column.name != "location"}
    result.update(longitude=row.longitude, latitude=row.latitude)
    if isinstance(obj, CandidateLocation):
        result["nearest_bin_distance_m"] = row.nearest_bin_distance_m
    return result


def candidate_query():
    distance = select(func.min(func.ST_Distance(CandidateLocation.location, TrashBin.location))).correlate(CandidateLocation).scalar_subquery()
    return location_query(CandidateLocation).add_columns(distance.label("nearest_bin_distance_m"))


@router.get("/bins", response_model=list[BinRead])
def bins(db: DB, district: District = "大安區"):
    return [serialize(row) for row in db.execute(location_query(TrashBin).where(TrashBin.district == district).order_by(TrashBin.id))]


@router.get("/hotspots", response_model=list[HotspotRead])
def hotspots(db: DB, district: District = "大安區"):
    return [serialize(row) for row in db.execute(location_query(Hotspot).where(Hotspot.district == district).order_by(Hotspot.id))]


@router.get("/candidates", response_model=list[CandidateRead])
def candidates(db: DB, district: District = "大安區"):
    return [serialize(row) for row in db.execute(candidate_query().where(CandidateLocation.district == district).order_by(CandidateLocation.id))]


@router.post("/candidates", response_model=CandidateRead, status_code=201)
def create_candidate(body: CandidateCreate, db: DB):
    candidate = CandidateLocation(name=body.name, district=body.district, note=body.note,
                                  source_type="manual_candidate", source_row=None,
                                  location=func.ST_SetSRID(func.ST_MakePoint(body.longitude, body.latitude), 4326))
    db.add(candidate)
    db.flush()
    result = serialize(db.execute(candidate_query().where(CandidateLocation.id == candidate.id)).one())
    db.commit()
    return result
