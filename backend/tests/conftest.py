import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from app.database import get_engine, get_session
from app.main import app
from scripts.import_data import import_data
from pathlib import Path


@pytest.fixture
def db():
    # Real PostGIS, outer transaction rolls back all test mutations.
    with get_engine().connect() as connection:
        transaction = connection.begin()
        with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
            yield session
        transaction.rollback()


@pytest.fixture
def seeded(db):
    import_data(Path("data"), db)
    db.flush()
    return db


@pytest.fixture
def client(seeded):
    app.dependency_overrides[get_session] = lambda: seeded
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
