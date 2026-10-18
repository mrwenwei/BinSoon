"""One-time conversion: uv run --with pyshp --with pyproj python scripts/convert_boundaries.py /path/to/download.zip

Conversion-only dependencies are not needed by the API. Official source and license
are recorded in data/BOUNDARIES.md. No simplification or coordinate rounding.
"""
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path
import shapefile
from pyproj import CRS, Transformer


def main():
    raw = Path(sys.argv[1]).read_bytes()
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        def member(ext):
            return z.read(next(n for n in z.namelist() if n.endswith(ext)))
        reader = shapefile.Reader(shp=io.BytesIO(member('.shp')), shx=io.BytesIO(member('.shx')),
                                  dbf=io.BytesIO(member('.dbf')), encoding='utf-8')
        transform = Transformer.from_crs(CRS.from_wkt(member('.prj').decode()), 'EPSG:4326', always_xy=True)
        def coords(value):
            if isinstance(value[0], (int, float)):
                return list(transform.transform(*value[:2]))
            return [coords(v) for v in value]
        features = []
        for row in reader.iterShapeRecords():
            props = row.record.as_dict()
            print(props)
            geometry = row.shape.__geo_interface__
            geometry['coordinates'] = coords(geometry['coordinates'])
            features.append(dict(type='Feature', properties=dict(district=props['TNAME']), geometry=geometry))
    target = Path(__file__).resolve().parents[1] / 'data/taipei_districts.geojson'
    target.write_text(json.dumps(dict(type='FeatureCollection', features=features), ensure_ascii=False))
    print('source SHA256:', hashlib.sha256(raw).hexdigest())


if __name__ == '__main__':
    main()
