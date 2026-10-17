"""Run once per release as a Cloud Run Job, before deploying the API."""
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_engine
from scripts.import_data import import_data

# Session-level lock serializes release jobs using this initializer.
INITIALIZATION_LOCK = 2068101701


def main():
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    with get_engine().connect() as connection:
        connection.execute(text("SELECT pg_advisory_lock(:key)"), {"key": INITIALIZATION_LOCK})
        connection.commit()
        try:
            command.upgrade(config, "head")
            # Reuse the lock connection: the two-connection pool also serves Alembic.
            with Session(bind=connection) as session, session.begin():
                result = import_data(root / "data", session)
            print(result)
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": INITIALIZATION_LOCK})
            connection.commit()


if __name__ == "__main__":
    main()
