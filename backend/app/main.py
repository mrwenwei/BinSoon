from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from app.api import router
from app.simulation_api import router as simulation_router
from app.database import get_session

app = FastAPI(title="台北市智慧垃圾桶 MVP", version="0.1.0")
app.include_router(router)
app.include_router(simulation_router)

from app.modules.application import install
install(app)


@app.get("/health")
def health(db: Session = Depends(get_session)):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Database unavailable") from None
    return {"status": "ok"}
