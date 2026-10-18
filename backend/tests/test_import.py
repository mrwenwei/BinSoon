from pathlib import Path
import pytest
from sqlalchemy import select, func
from app.models import Bin, BinState, BinReading, Hotspot
from scripts.import_data import import_data, load_data, prepare_rows


def test_csv_sources():
    datasets = load_data(Path('data'))
    assert [len(rows) for _,rows in datasets] == [681,130]
    assert all(row['source_row'] and row['source_type'] for _,rows in datasets for row in rows)


def test_idempotent_import_and_state_creation(db):
    import_data(Path('data'),db)
    state_count = db.scalar(select(func.count()).select_from(BinState))
    history_count = db.scalar(select(func.count()).select_from(BinReading))
    proposed = db.scalar(select(func.count()).select_from(Bin).where(Bin.bin_type=='proposed'))
    import_data(Path('data'),db)
    assert db.scalar(select(func.count()).select_from(Bin).where(Bin.bin_type=='existing')) == 681
    assert db.scalar(select(func.count()).select_from(Bin).where(Bin.bin_type=='proposed')) == proposed
    assert db.scalar(select(func.count()).select_from(BinState)) == state_count
    assert db.scalar(select(func.count()).select_from(BinReading)) == history_count
    assert db.scalar(select(func.count()).select_from(Hotspot)) == 130
    assert db.scalar(select(func.count()).select_from(Bin).where(Bin.district=='大安區', Bin.bin_type=='existing')) == 47
    assert db.scalar(select(func.ST_SRID(Bin.location)).limit(1)) == 4326


def test_bad_csv_coordinates():
    with pytest.raises(ValueError,match='coordinates'):
        prepare_rows([{'longitude':'nan','latitude':'25'}],Path('bad.csv'),Bin)
