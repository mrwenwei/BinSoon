"""Temporary HTTP surface used only during a coordinated schema cutover.

Run this entry point before database backup/migration, then switch back to main.
It imports no database modules and rejects every request, including writes.
"""
from fastapi import FastAPI
from starlette.responses import JSONResponse

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def maintenance(request, call_next):
    return JSONResponse(status_code=503, content={"detail": "Service temporarily unavailable for database migration"},
                        headers={"Retry-After": "60", "Cache-Control": "no-store"})
