"""HTTP smoke checks; --create-bin explicitly leaves one labeled proposed Bin."""
import argparse
import json
import os
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError



def check(base_url: str, create_bin: bool = False):
    base_url = base_url.rstrip("/")

    def request(path, payload=None, authenticate=True):
        data = None if payload is None else json.dumps(payload).encode()
        headers = {"Content-Type": "application/json"}
        if data is not None and authenticate:
            token = os.environ.get("ADMIN_TOKEN") or os.environ.get("DEMO_ADMIN_TOKEN")
            if not token:
                raise ValueError("Set ADMIN_TOKEN for authenticated creation checks")
            headers["Authorization"] = "Bearer " + token
        req = Request(base_url + path, data=data, headers=headers)
        with urlopen(req, timeout=60) as response:
            status = response.status
            raw = response.read()
        return status, raw

    def get(path):
        status, raw = request(path)
        assert status == 200, (path, status)
        return json.loads(raw)

    assert get("/health") == {"status": "ok"}
    assert request("/docs")[0] == 200
    openapi = get("/openapi.json")
    assert "/api/v1/candidates" not in openapi["paths"]
    assert "/api/v1/bins/{bin_id}/history" in openapi["paths"]
    for payload in (None, {}):
        try:
            request('/api/v1/candidates', payload, authenticate=False)
        except HTTPError as error:
            assert error.code == 404
        else:
            raise AssertionError('Removed candidates route is still available')
    district_parameter = next(param for param in openapi["paths"]["/api/v1/bins"]["get"]["parameters"] if param["name"] == "district")
    schema = district_parameter["schema"]
    districts = schema.get("enum") or [v for part in schema["anyOf"] for v in part.get("enum", [part.get("const")]) if v is not None]
    districts = [d for d in districts if d != "all"]
    assert len(districts) == 12 and "大安區" in districts
    bins = get("/api/v1/bins?bin_type=existing")
    hotspots = get("/api/v1/hotspots")
    assert len(bins) == 47 and len(hotspots) == 18
    for item in bins + hotspots:
        assert isinstance(item["longitude"], (float, int))
        assert isinstance(item["latitude"], (float, int))

    from urllib.parse import urlencode
    counts = {"bins": 0, "hotspots": 0}
    for district in districts:
        for endpoint in counts:
            params = {"district": district}
            if endpoint == "bins":
                params["bin_type"] = "existing"
            counts[endpoint] += len(get(f"/api/v1/{endpoint}?{urlencode(params)}"))
    assert counts == {"bins": 681, "hotspots": 130}, counts
    result = {"health": "ok", "all_taipei": counts, "daan": {"bins": len(bins), "hotspots": len(hotspots)}}
    if create_bin:
        point = bins[0]
        status, raw = request("/api/v1/bins", {
            "name": "部署驗收候選點（非實際提案）",
            "district": "大安區", "longitude": point["longitude"], "latitude": point["latitude"],
            "note": "HTTP deployment smoke check at " + datetime.now(timezone.utc).isoformat() + "; not a proposed real-world site.",
        })
        assert status == 201
        bin_ = json.loads(raw)
        assert bin_["bin_type"] == "proposed" and bin_["placement_status"] == "proposed"
        assert bin_["longitude"] == point["longitude"] and bin_["latitude"] == point["latitude"]
        assert bin_["current_usage"]["fill_level_pct"] == 0
        assert get('/api/v1/bins/'+bin_['id']) == bin_
        readings = get('/api/v1/bins/'+bin_['id']+'/history')
        assert len(readings) == 1 and readings[0]['event_type'] == 'reset'
        assert len(get("/api/v1/bins?bin_type=existing")) == 47
        result["created_test_bin_id"] = bin_["id"]
    print(json.dumps(result, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base_url")
    parser.add_argument("--create-bin", action="store_true")
    args = parser.parse_args()
    check(args.base_url, args.create_bin)


if __name__ == "__main__":
    main()
