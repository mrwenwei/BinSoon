from pathlib import Path
from sqlalchemy import select, func
from app.models import TrashBin, Hotspot, CandidateLocation
from scripts.import_data import import_data, load_data, prepare_rows
import pytest


def test_csv_sources():
    datasets = load_data(Path("data"))
    assert [len(rows) for _, rows in datasets] == [681, 130]
    assert all(row["source_row"] and row["source_type"] for _, rows in datasets for row in rows)


def test_idempotent_import(db):
    before_candidates = db.scalar(select(func.count()).select_from(CandidateLocation))
    for _ in range(2):
        import_data(Path("data"), db)
    assert db.scalar(select(func.count()).select_from(TrashBin)) == 681
    assert db.scalar(select(func.count()).select_from(Hotspot)) == 130
    assert db.scalar(select(func.count()).select_from(CandidateLocation)) == before_candidates
    assert db.scalar(select(func.count()).select_from(TrashBin).where(TrashBin.district == "大安區")) == 47
    assert db.scalar(select(func.ST_SRID(TrashBin.location)).limit(1)) == 4326


def test_bad_csv_coordinates():
    with pytest.raises(ValueError, match="coordinates"):
        prepare_rows([{"longitude": "nan", "latitude": "25"}], Path("bad.csv"), TrashBin)
