import pytest
from sqlalchemy import select, func, delete
from app.models import TrashBin


def test_lists_and_health(client):
    assert client.get("/health").json() == {"status": "ok"}
    for endpoint, count in [("bins", 47), ("hotspots", 18)]:
        response = client.get(f"/api/v1/{endpoint}")
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == count
        assert isinstance(rows[0]["longitude"], float)
        assert isinstance(rows[0]["latitude"], float)
        assert rows[0]["created_at"].endswith("Z")
    assert len(client.get("/api/v1/bins?district=士林區").json()) == 142
    assert len(client.get("/api/v1/hotspots?district=信義區").json()) == 18
    assert client.get("/api/v1/bins?district=invalid").status_code == 422
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_create_and_distance(client, seeded):
    point = client.get("/api/v1/bins").json()[0]
    payload = dict(name="測試候選點", longitude=point["longitude"], latitude=point["latitude"])
    response = client.post("/api/v1/candidates", json=payload)
    assert response.status_code == 201
    candidate = response.json()
    assert candidate["nearest_bin_distance_m"] == pytest.approx(0, abs=0.001)
    assert candidate["source_type"] == "manual_candidate"
    assert candidate["source_row"] is None
    assert candidate["id"] in [r["id"] for r in client.get("/api/v1/candidates").json()]
    payload.update(longitude=121.54, latitude=25.03)
    other = client.post("/api/v1/candidates", json=payload).json()
    expected = seeded.scalar(select(func.min(func.ST_Distance(TrashBin.location, func.ST_GeogFromText("SRID=4326;POINT(121.54 25.03)")))))
    assert other["nearest_bin_distance_m"] == pytest.approx(expected)
    seeded.execute(delete(TrashBin))
    assert client.post("/api/v1/candidates", json=payload).json()["nearest_bin_distance_m"] is None


@pytest.mark.parametrize("field,value", [("longitude", 181), ("longitude", -181), ("latitude", 91), ("latitude", -91), ("longitude", "NaN"), ("latitude", "Infinity"), ("district", "台中市"), ("name", " ")])
def test_candidate_validation(client, field, value):
    payload = dict(name="候選點", longitude=121.54, latitude=25.03)
    payload[field] = value
    assert client.post("/api/v1/candidates", json=payload).status_code == 422
