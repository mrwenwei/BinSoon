"""One persisted clock and one state/history path for every bin.

All rates and noise are synthetic assumptions. Reads never advance the clock.
"""
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import and_, or_, func, select, text
from app.config import get_settings
from app.models import Bin, BinState, BinReading, SimulationClock, SimulationAdvance
from app.waste import WASTE_TYPES

CLOCK = "city_bins"
RECOMMENDATIONS = "daan_phase1_10bins"
VERSION = "waste-streams-v2"
START = datetime(2026, 1, 5, tzinfo=timezone.utc)
DATA = Path(__file__).resolve().parents[2] / "data"


def lock(db):
    db.execute(text("SELECT pg_advisory_xact_lock(2068101702)"))


def get_clock(db):
    clock = db.get(SimulationClock, CLOCK, populate_existing=True)
    if clock is None:
        raise HTTPException(409, "Initialize simulation first")
    return clock


def record(db, state, event, clock):
    previous = db.scalar(select(BinReading).where(BinReading.bin_id == state.bin_id)
        .where(or_(BinReading.waste_type == state.waste_type,
            and_(state.waste_type == "general", BinReading.waste_type.is_(None))))
        .order_by(BinReading.observation_sequence.desc(), BinReading.recorded_at.desc()).limit(1))
    state.observation_sequence = (state.observation_sequence or 0) + 1
    state.observed_at, state.received_at = state.last_updated_at, datetime.now(timezone.utc)
    reading = BinReading(bin_id=state.bin_id, waste_type=state.waste_type,
        classification_source=state.classification_source, fill_level_pct=state.fill_level_pct,
        recorded_at=state.last_updated_at, source_type="simulated", event_type=event, generation=clock.generation,
        observed_at=state.observed_at, received_at=state.received_at, observation_sequence=state.observation_sequence)
    db.add(reading)
    if event == "measurement" and state.fill_level_pct >= 80 and (previous is None or previous.fill_level_pct < 80):
        from app.modules.workflows import adoption_alert
        adoption_alert(db, state.bin_id, "full", f"{state.bin_id}:{state.waste_type}:{clock.generation}:{state.observation_sequence}", state.waste_type)
    return reading


def initialize(db):
    """Called in the same transaction as import/create; never rewrites existing states."""
    lock(db)
    clock = db.get(SimulationClock, CLOCK)
    if clock is None:
        settings = get_settings()
        clock = SimulationClock(id=CLOCK, simulated_at=START, simulation_status="running", random_seed=42,
            time_multiplier=settings.simulation_time_multiplier, data_version=VERSION, generation=0)
        db.add(clock)
        db.flush()
    clock.data_version = VERSION
    existing = {(s.bin_id, s.waste_type) for s in db.scalars(select(BinState))}
    for bin_ in db.scalars(select(Bin).order_by(Bin.id)):
        # No measured rate exists: deterministic synthetic rates for all points.
        rate = bin_.demand_score / 10 + (11 - bin_.rank) * 0.03 if bin_.demand_score is not None and bin_.rank else 4 + (bin_.id.int % 401) / 100
        settings = get_settings()
        for waste_type in WASTE_TYPES:
            if (bin_.id, waste_type) in existing: continue
            state = BinState(bin_id=bin_.id, waste_type=waste_type, classification_source="demo_assumption",
                fill_level_pct=0, capacity_liters=settings.simulation_capacity_liters if waste_type == "general" else settings.simulation_recycling_capacity_liters,
                fill_rate_pct_per_hour=rate if waste_type == "general" else rate * settings.simulation_recycling_rate_multiplier,
                last_updated_at=clock.simulated_at, source_type="simulated")
            db.add(state)
            record(db, state, "reset", clock)
    db.flush()
    return clock


def seed(db):
    """Import the ten fixed recommendations as ordinary proposed bins."""
    lock(db)
    boundaries = json.loads((DATA / "taipei_districts.geojson").read_text())
    for rank, name, lat, lon, score, reason in json.loads((DATA / f"{RECOMMENDATIONS}.json").read_text()):
        external = f"DAAN-PROP-{rank:03}"
        id_ = uuid5(NAMESPACE_URL, f"binsoon:{RECOMMENDATIONS}:{external}")
        existing = db.scalar(select(Bin).where(Bin.external_id == external))
        if existing:
            if existing.id != id_ or existing.source_type != "model_recommendation":
                raise HTTPException(409, "Recommendation external ID conflict")
            continue
        if db.get(Bin, id_) is not None:
            raise HTTPException(409, "Recommendation UUID conflict")
        districts = []
        point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        for feature in boundaries["features"]:
            polygon = func.ST_SetSRID(func.ST_GeomFromGeoJSON(json.dumps(feature["geometry"])), 4326)
            if db.scalar(select(func.ST_Covers(polygon, point))):
                districts.append(feature["properties"]["district"])
        warning = None if districts == ["大安區"] else f"區界檢查結果：{','.join(districts) or '無匹配'}；非明確位於大安區內，須人工確認"
        db.add(Bin(id=id_, bin_type="proposed", external_id=external, scenario_id=RECOMMENDATIONS,
            rank=rank, name=name, demand_score=score, reason=reason, placement_status="proposed",
            feasibility_status="pending_review", boundary_warning=warning, district=districts[0] if districts else "大安區",
            location=point, source_type="model_recommendation", source_row=rank,
            source_file=f"{RECOMMENDATIONS}.json", status="needs_field_validation",
            note="既有分析推薦，尚未會勘或設置；分數非實測人流或垃圾量"))
    db.flush()
    return initialize(db)


def multiplier(at):
    local = at.astimezone(ZoneInfo("Asia/Taipei"))
    hour = local.hour
    return (1.2 if local.weekday() >= 5 else 1.0) * (1.3 if 7 <= hour < 10 or 17 <= hour < 21 else 1.1 if 11 <= hour < 14 else 0.6)


def noise(seed, bin_id, tick):
    value = hashlib.blake2b(f"{seed}:{bin_id}:{tick}".encode(), digest_size=8).digest()
    return (int.from_bytes(value, "big") / (2**64 - 1) * 2 - 1) * 0.02


def advance(db, body):
    lock(db)
    clock = get_clock(db)
    minutes = body.minutes
    if minutes is None:
        duration = body.real_seconds * clock.time_multiplier / 60
        if not 1 <= duration <= 10080 or abs(duration - round(duration)) > 1e-8:
            raise HTTPException(422, "Duration must map to 1..10080 whole simulated minutes")
        minutes = round(duration)
    previous = db.get(SimulationAdvance, body.request_id)
    if previous:
        if previous.minutes != minutes or previous.generation != body.generation:
            raise HTTPException(409, "Request ID reused with different parameters")
        return dict(request_id=body.request_id, generation=previous.generation, simulated_at=previous.simulated_at, replayed=True)
    if body.generation != clock.generation:
        raise HTTPException(409, "Stale generation; read status after reset")
    if clock.simulation_status != "running":
        raise HTTPException(409, "Simulation is paused")
    start_tick = int((clock.simulated_at - START).total_seconds() // 60)
    factors = [multiplier(clock.simulated_at + timedelta(minutes=i)) / 60 for i in range(minutes)]
    for state in db.scalars(select(BinState).where(BinState.source_type == "simulated").order_by(BinState.bin_id, BinState.waste_type)):
        if state.fill_rate_pct_per_hour:
            for minute, factor in enumerate(factors):
                if state.fill_level_pct >= 100:
                    break
                stream_seed = state.bin_id if state.waste_type == "general" else f"{state.bin_id}:recycling"
                delta = state.fill_rate_pct_per_hour * factor + noise(clock.random_seed, stream_seed, start_tick + minute)
                state.fill_level_pct = min(100.0, max(0.0, state.fill_level_pct + max(0, delta)))
        state.last_updated_at = clock.simulated_at + timedelta(minutes=minutes)
        record(db, state, "measurement", clock)
    clock.simulated_at += timedelta(minutes=minutes)
    db.add(SimulationAdvance(request_id=body.request_id, generation=clock.generation,
                            minutes=minutes, simulated_at=clock.simulated_at))
    db.flush()
    return dict(request_id=body.request_id, generation=clock.generation, simulated_at=clock.simulated_at, replayed=False)


def reset(db):
    lock(db)
    clock = get_clock(db)
    clock.simulated_at, clock.simulation_status, clock.random_seed = START, "running", 42
    clock.generation += 1
    for state in db.scalars(select(BinState).where(BinState.source_type == "simulated")):
        state.fill_level_pct, state.last_updated_at, state.last_emptied_at = 0, START, None
        record(db, state, "reset", clock)
    db.flush()
    return clock


def collect(db, bin_id, waste_type="general"):
    lock(db)
    clock = get_clock(db)
    if db.get(Bin, bin_id) is None:
        raise HTTPException(404, "Bin not found")
    state = db.get(BinState, (bin_id, waste_type))
    if state is None or state.source_type != "simulated":
        raise HTTPException(409, "No simulated state for this bin")
    state.fill_level_pct = 0
    state.last_updated_at = state.last_emptied_at = clock.simulated_at
    record(db, state, "collection", clock)
    db.flush()
    return state


def set_status(db, value):
    lock(db)
    clock = get_clock(db)
    clock.simulation_status = value
    return clock


def status(clock):
    return dict(clock_id=clock.id, simulated_at=clock.simulated_at, simulation_status=clock.simulation_status,
        seed=clock.random_seed, generation=clock.generation, time_multiplier=clock.time_multiplier,
        data_version=clock.data_version, clock_mode="manual", source_type="simulated")


def priority(state):
    fill, rate = state.fill_level_pct, state.fill_rate_pct_per_hour
    # Base-rate estimate; does not claim to predict future time-of-day effects.
    return dict(priority="critical" if fill >= 90 else "high" if fill >= 80 else "medium" if fill >= 50 else "low",
        estimated_hours_to_90_pct=0 if fill >= 90 else (90 - fill) / rate if rate else None)
