"""Read the seed's district assignments in a rolled-back transaction (local DB only)."""
import json
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_engine
from app.models import Bin
from app.services.simulation import seed, RECOMMENDATIONS


def main():
    with get_engine().connect() as connection:
        transaction = connection.begin()
        try:
            with Session(bind=connection) as db:
                seed(db)
                print(json.dumps([dict(rank=c.rank, district=c.district, warning=c.boundary_warning)
                    for c in db.scalars(select(Bin).where(Bin.scenario_id == RECOMMENDATIONS)
                        .order_by(Bin.rank))], ensure_ascii=False, indent=2))
        finally:
            transaction.rollback()


if __name__ == '__main__':
    main()
