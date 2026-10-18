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


@pytest.fixture
def isolated_engine():
    """Real independent transactions, confined to a uniquely named local schema."""
    from uuid import uuid4
    from sqlalchemy import create_engine, text
    schema = 'test_bins_' + uuid4().hex
    base = get_engine()
    engine = create_engine(base.url, connect_args={'options': f'-csearch_path={schema},public -c timezone=UTC'}, pool_size=4)
    with base.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA {schema}'))
    try:
        yield engine
    finally:
        engine.dispose()
        with base.begin() as conn:
            conn.execute(text(f'DROP SCHEMA {schema} CASCADE'))
