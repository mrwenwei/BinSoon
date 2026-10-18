from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_session
from app.security import require_admin
from app.simulation_schemas import AdvanceRead, AdvanceRequest, ClockRead
from app.services import simulation

router = APIRouter(prefix="/api/v1/simulation", tags=["Simulation controls"])
DB = Annotated[Session, Depends(get_session)]
ADMIN = [Depends(require_admin)]


@router.get("/status", response_model=ClockRead)
def status(db: DB):
    return simulation.status(simulation.get_clock(db))


@router.post("/seed", response_model=ClockRead, dependencies=ADMIN)
def seed(db: DB):
    result = simulation.status(simulation.seed(db))
    db.commit()
    return result


@router.post("/advance", response_model=AdvanceRead, dependencies=ADMIN)
def advance(body: AdvanceRequest, db: DB):
    result = simulation.advance(db, body)
    db.commit()
    return result


@router.post("/reset", response_model=ClockRead, dependencies=ADMIN)
def reset(db: DB):
    result = simulation.status(simulation.reset(db))
    db.commit()
    return result


@router.post("/pause", response_model=ClockRead, dependencies=ADMIN)
def pause(db: DB):
    result = simulation.status(simulation.set_status(db, "paused"))
    db.commit()
    return result


@router.post("/resume", response_model=ClockRead, dependencies=ADMIN)
def resume(db: DB):
    result = simulation.status(simulation.set_status(db, "running"))
    db.commit()
    return result
