"""Import published point inventories and aggregate hotspots, never screening proposals."""
import argparse
import csv
import math
import warnings
from pathlib import Path
from uuid import UUID
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from app.database import get_engine
from app.models import Bin, Hotspot
from app.schemas import District
from typing import get_args


def read_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        return set(reader.fieldnames or []), list(reader)


def prepare_rows(rows, path, model):
    prepared = []
    identities = set()
    ids = set()
    expected_source = "city_bin_inventory" if model is Bin else "scenic_commercial_aggregate"
    for row in rows:
        longitude, latitude = float(row["longitude"]), float(row["latitude"])
        if not (math.isfinite(longitude) and math.isfinite(latitude) and -180 <= longitude <= 180 and -90 <= latitude <= 90):
            raise ValueError(f"Invalid coordinates in {path}")
        if row["district"] not in get_args(District):
            raise ValueError(f"Invalid Taipei district in {path}")
        if row["source_type"] != expected_source:
            raise ValueError(f"Unexpected source_type in {path}")
        row_id = UUID(row["id"])
        if row_id in ids:
            raise ValueError(f"Duplicate id in {path}")
        ids.add(row_id)
        source_row = int(row["source_row"])
        identity = (row["source_type"], source_row)
        if source_row < 1 or not identity[0] or identity in identities:
            raise ValueError(f"Invalid or duplicate source identity in {path}: {identity}")
        identities.add(identity)
        item = dict(id=row_id, district=row["district"],
                    location=f"SRID=4326;POINT({longitude} {latitude})",
                    source_type=row["source_type"], source_row=source_row,
                    source_file=path.name, note=row.get("note", ""),
                    location_precision=row["location_precision"])
        if model is Bin:
            if row["status"] != "existing":
                raise ValueError("Inventory must contain existing bins only")
            item.update(address=row["address"], name=(row["address"] or f"清潔箱 {source_row}")[:200],
                        status=row["status"], bin_type="existing", placement_status="existing")
        else:
            count = int(row["reported_count"])
            if count < 0:
                raise ValueError("reported_count must be nonnegative")
            item.update(name=row["name"], reported_count=count)
        prepared.append(item)
    return prepared


def load_data(directory):
    bin_path = directory / "existing_bins_all_taipei.csv"
    _, bins = read_csv(bin_path)
    hotspot_path = directory / "hotspots_all_taipei.csv"
    fields, hotspots = read_csv(hotspot_path)
    if "proposal_status" in fields and "source_row" not in fields:
        alternative = directory / "daan_hotspot_gap_screening.csv"
        fields, hotspots = read_csv(alternative)
        if not {"id", "source_type", "source_row", "reported_count", "location_precision"} <= fields or "proposal_status" in fields:
            raise ValueError("No valid aggregate hotspot source found")
        warnings.warn("CSV filenames are swapped: using daan_hotspot_gap_screening.csv as the aggregate source; screening rows are excluded.", stacklevel=2)
        hotspot_path = alternative
    required = {"id", "district", "longitude", "latitude", "source_type", "source_row", "location_precision", "reported_count", "name"}
    if not required <= fields or "proposal_status" in fields:
        raise ValueError("Hotspot source must contain aggregate records, not gap screening")
    if len(bins) != 681 or len(hotspots) != 130:
        raise ValueError("Expected 681 bins and 130 aggregate hotspots")
    if sum(r["district"] == "大安區" for r in bins) != 47 or sum(r["district"] == "大安區" for r in hotspots) != 18:
        raise ValueError("Unexpected Daan district counts")
    return [(Bin, prepare_rows(bins, bin_path, Bin)), (Hotspot, prepare_rows(hotspots, hotspot_path, Hotspot))]


def import_data(directory: Path, session: Session):
    datasets = load_data(directory)  # Validate both datasets before writing anything.
    for model, rows in datasets:
        statement = insert(model).values(rows)
        updates = {key: getattr(statement.excluded, key) for key in rows[0] if key != "id"}
        updates["updated_at"] = func.now()
        session.execute(statement.on_conflict_do_update(index_elements=["source_type", "source_row"], set_=updates))
    from app.services.simulation import initialize
    initialize(session)
    return {model.__tablename__: len(rows) for model, rows in datasets}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    args = parser.parse_args()
    with Session(get_engine()) as session, session.begin():
        result = import_data(args.data_dir, session)
    print(result)


if __name__ == "__main__":
    main()
