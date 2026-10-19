from uuid import uuid4
import pytest
from pydantic import SecretStr
from app.config import get_settings
from app.models import Bin, BinReading, BinState

AUTH = {"Authorization": "Bearer test-admin"}


@pytest.fixture
def admin_client(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "admin_token", SecretStr("test-admin"))
    return client


def test_lists_health_and_geojson(client):
    assert client.get('/health').json() == {'status': 'ok'}
    assert len(client.get('/api/v1/bins?bin_type=existing').json()) == 47
    assert len(client.get('/api/v1/bins?district=all&bin_type=existing').json()) == 681
    assert len(client.get('/api/v1/hotspots').json()) == 18
    assert len(client.get('/api/v1/hotspots?district=信義區').json()) == 18
    assert client.get('/api/v1/bins?district=invalid').status_code == 422
    assert client.get('/api/v1/bins?bin_type=invalid').status_code == 422
    rows = client.get('/api/v1/bins').json()
    geo = client.get('/api/v1/bins?format=geojson').json()
    assert len(geo['features']) == len(rows)
    assert geo['features'][0]['geometry']['coordinates'] == [rows[0]['longitude'], rows[0]['latitude']]
    assert rows[0]['created_at'].endswith('Z')
    assert rows[0]['current_usage']['source_type'] == 'simulated'
    assert client.get('/docs').status_code == 200
    paths = client.get('/openapi.json').json()['paths']
    assert '/api/v1/bins/{bin_id}/history' in paths
    assert '/api/v1/demo/bins' not in paths


def test_new_bin_has_shared_identity_and_history(admin_client, seeded):
    existing = admin_client.get('/api/v1/bins?bin_type=existing').json()[0]
    payload = dict(name='新點', longitude=existing['longitude'], latitude=existing['latitude'])
    response = admin_client.post('/api/v1/bins', headers=AUTH, json=payload)
    assert response.status_code == 201
    item = response.json()
    assert item['bin_type'] == 'proposed' and item['placement_status'] == 'proposed'
    assert item['current_usage']['fill_level_pct'] == 0
    id_ = item['id']
    assert id_ in {r['id'] for r in admin_client.get('/api/v1/bins').json()}
    assert admin_client.get('/api/v1/bins/'+id_).json() == item
    history = admin_client.get('/api/v1/bins/'+id_+'/history').json()
    assert len(history) == 1 and history[0]['event_type'] == 'reset'
    assert history[0]['bin_id'] == id_
    assert len(admin_client.get('/api/v1/bins?bin_type=existing').json()) == 47


def test_candidate_routes_removed(admin_client):
    contract = admin_client.get('/openapi.json').json()
    assert '/api/v1/candidates' not in contract['paths']
    assert 'CandidateRead' not in contract['components']['schemas']
    for headers in ({}, AUTH):
        assert admin_client.get('/api/v1/candidates', headers=headers).status_code == 404
        assert admin_client.post('/api/v1/candidates', headers=headers, json={}).status_code == 404


@pytest.mark.parametrize('field,value', [('longitude',181),('longitude',-181),('latitude',91),('latitude',-91),('longitude','NaN'),('latitude','Infinity'),('district','台中市'),('name',' ')])
def test_bin_validation(admin_client, field, value):
    payload = dict(name='bin', longitude=121.54, latitude=25.03)
    payload[field] = value
    assert admin_client.post('/api/v1/bins', headers=AUTH, json=payload).status_code == 422


def test_empty_and_unknown_history(client, seeded):
    bin_ = Bin(name='無讀值', bin_type='proposed', district='大安區', location='SRID=4326;POINT(121.54 25.03)',
        source_type='manual_candidate', status='needs_field_validation', placement_status='proposed', feasibility_status='pending_review')
    seeded.add(bin_)
    seeded.flush()
    assert client.get(f'/api/v1/bins/{bin_.id}').json()['current_usage'] is None
    assert client.get(f'/api/v1/bins/{bin_.id}/history').json() == []
    for suffix in ('','/history'):
        assert client.get(f'/api/v1/bins/{uuid4()}{suffix}').status_code == 404
    assert seeded.get(BinState, bin_.id) is None
