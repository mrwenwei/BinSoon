"""Bin queries and creation share one model, regardless of point origin."""
from fastapi import HTTPException
from geoalchemy2 import Geometry
from sqlalchemy import and_, cast, func, select
from app.models import Bin, BinState, BinReading
from app.services import simulation
from app.waste import WASTE_TYPES


def location_query(model):
    geometry = cast(model.location, Geometry("POINT", srid=4326))
    return select(model, func.ST_X(geometry).label("longitude"), func.ST_Y(geometry).label("latitude"))


def query(waste_type="general"):
    # One row per location, independent of the number of streams.
    statement = location_query(Bin)
    for kind in (waste_type, *[t for t in WASTE_TYPES if t != waste_type]):
        from sqlalchemy.orm import aliased
        state = aliased(BinState)
        statement = statement.add_columns(state).outerjoin(state, and_(state.bin_id == Bin.id, state.waste_type == kind))
    return statement


def filtered(statement, district="大安區", bin_type=None, scenario_id=None):
    if district != "all":
        statement = statement.where(Bin.district == district)
    if bin_type:
        statement = statement.where(Bin.bin_type == bin_type)
    if scenario_id:
        statement = statement.where(Bin.scenario_id == scenario_id)
    return statement


def usage(state):
    if state is None:
        return None
    return dict(waste_type=state.waste_type, classification_source=state.classification_source,
        fill_level_pct=state.fill_level_pct, capacity_liters=state.capacity_liters,
        estimated_used_liters=state.capacity_liters * state.fill_level_pct / 100,
        fill_rate_pct_per_hour=state.fill_rate_pct_per_hour, source_type=state.source_type,
        recorded_at=state.last_updated_at, last_emptied_at=state.last_emptied_at, **simulation.priority(state))


def serialize(row):
    bin_ = row[0]
    result = {col.name: getattr(bin_, col.name) for col in Bin.__table__.columns if col.name != "location"}
    states = {s.waste_type:s for s in row[3:] if s is not None}
    result.update(longitude=row.longitude, latitude=row.latitude, current_usage=usage(row[3]),
        compartments=[dict(waste_type=t, classification_source=states[t].classification_source if t in states else "demo_assumption",
            current_usage=usage(states.get(t))) for t in WASTE_TYPES])
    return result


def get(db, bin_id, waste_type="general"):
    row = db.execute(query(waste_type).where(Bin.id == bin_id)).one_or_none()
    if row is None:
        raise HTTPException(404, "Bin not found")
    return serialize(row)


def create(db, body):
    simulation.lock(db)
    bin_ = Bin(name=body.name, district=body.district, note=body.note, bin_type="proposed",
        source_type="manual_candidate", status="needs_field_validation", placement_status="proposed",
        feasibility_status="pending_review",
        location=func.ST_SetSRID(func.ST_MakePoint(body.longitude, body.latitude), 4326))
    db.add(bin_)
    db.flush()
    simulation.initialize(db)
    return get(db, bin_.id)


def history(db, bin_id, limit, offset, start=None, end=None, generation=None, source_type=None, waste_type=None):
    if db.get(Bin, bin_id) is None:
        raise HTTPException(404, "Bin not found")
    if start and end and start > end:
        raise HTTPException(422, "start must not be after end")
    statement = select(BinReading).where(BinReading.bin_id == bin_id)
    if start:
        statement = statement.where(BinReading.recorded_at >= start)
    if end:
        statement = statement.where(BinReading.recorded_at <= end)
    if generation is not None:
        statement = statement.where(BinReading.generation == generation)
    if source_type:
        statement = statement.where(BinReading.source_type == source_type)
    if waste_type:
        statement = statement.where(BinReading.waste_type.is_(None) if waste_type == "legacy_unknown" else BinReading.waste_type == waste_type)
    rows = db.scalars(statement.order_by(BinReading.generation.desc().nulls_last(), BinReading.recorded_at.desc(),
                         BinReading.event_type, BinReading.id.desc()).limit(limit).offset(offset))
    return [{col.name: getattr(row, col.name) for col in BinReading.__table__.columns} for row in rows]
