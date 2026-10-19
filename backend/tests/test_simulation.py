import json
from datetime import timedelta
from pathlib import Path
from uuid import uuid4
import pytest
from pydantic import SecretStr
from sqlalchemy import func, select
from app.config import get_settings
from app.models import Bin, BinReading, BinState
from app.services import simulation as sim

AUTH={'Authorization':'Bearer test-admin'}


@pytest.fixture
def admin(client,monkeypatch):
    monkeypatch.setattr(get_settings(),'admin_token',SecretStr('test-admin'))
    return client


def status(client):
    return client.get('/api/v1/simulation/status').json()


def advance(client,minutes=60,rid=None,generation=None):
    return client.post('/api/v1/simulation/advance',headers=AUTH,json=dict(request_id=str(rid or uuid4()),
        generation=status(client)['generation'] if generation is None else generation,minutes=minutes))


def levels(client):
    return {b['id']:b['current_usage']['fill_level_pct'] for b in client.get('/api/v1/bins?district=all').json()}


def test_seed_preserves_original_ten_and_all_bins(admin,seeded):
    assert admin.post('/api/v1/simulation/seed',headers=AUTH).status_code == 200
    before=admin.get('/api/v1/bins?district=all').json()
    assert admin.post('/api/v1/simulation/seed',headers=AUTH).status_code == 200
    assert admin.get('/api/v1/bins?district=all').json()==before
    proposals=sorted([b for b in before if b['scenario_id']==sim.RECOMMENDATIONS],key=lambda b:b['rank'])
    assert len(proposals)==10
    for b,(rank,name,lat,lon,score,reason) in zip(proposals,json.loads(Path('data/daan_phase1_10bins.json').read_text())):
        assert (b['rank'],b['name'],b['latitude'],b['longitude'],b['demand_score'],b['reason'])==(rank,name,lat,lon,score,reason)
        assert b['source_type']=='model_recommendation' and b['bin_type']=='proposed'
        assert b['current_usage']['source_type']=='simulated'
    assert [b['rank'] for b in proposals if b['boundary_warning']]==[4,7]
    assert all(b['current_usage'] is not None for b in before)
    assert len({b['current_usage']['fill_rate_pct_per_hour'] for b in proposals})==10


def test_deterministic_chunking_and_reset_keeps_history(admin):
    admin.post('/api/v1/simulation/reset',headers=AUTH)
    generation=status(admin)['generation']
    assert advance(admin,120).status_code==200
    original=levels(admin)
    assert all(x>0 for x in original.values())
    assert levels(admin)==original
    id_=next(iter(original))
    before=admin.get(f'/api/v1/bins/{id_}/history?generation={generation}').json()
    admin.post('/api/v1/simulation/reset',headers=AUTH)
    assert all(x==0 for x in levels(admin).values())
    assert admin.get(f'/api/v1/bins/{id_}/history?generation={generation}').json()==before
    assert advance(admin,60).status_code==200
    assert advance(admin,60).status_code==200
    assert levels(admin)==original


def test_both_existing_and_new_bin_collect_history(admin):
    existing=admin.get('/api/v1/bins?bin_type=existing').json()[0]
    created=admin.post('/api/v1/bins',headers=AUTH,json=dict(name='new',longitude=121.54,latitude=25.03)).json()
    assert advance(admin).status_code==200
    for b in (existing,created):
        id_=b['id']
        assert admin.get('/api/v1/bins/'+id_).json()['current_usage']['fill_level_pct']>0
        result=admin.post(f'/api/v1/bins/{id_}/collect',headers=AUTH)
        assert result.status_code==200
        assert result.json()['current_usage']['fill_level_pct']==0
        history=admin.get(f'/api/v1/bins/{id_}/history').json()
        assert any(h['event_type']=='collection' and h['fill_level_pct']==0 for h in history)
        assert all(h['source_type']=='simulated' and h['bin_id']==id_ and h['recorded_at'].endswith('Z') for h in history)
        assert len(admin.get(f'/api/v1/bins/{id_}/history?limit=1').json())==1
        assert admin.get(f'/api/v1/bins/{id_}/history?source_type=iot_sensor').json()==[]
    assert admin.get(f'/api/v1/bins/{created["id"]}/history?start=2026-01-01T00:00:00').status_code==422
    assert admin.get(f'/api/v1/bins/{created["id"]}/history?start=2027-01-01T00:00:00Z&end=2026-01-01T00:00:00Z').status_code==422


def test_bounds_zero_rate_and_priorities(admin,seeded):
    # This legacy endpoint defaults to general; recycling bounds have their own
    # independent coverage. Do not rely on row order between two states per bin.
    states=list(seeded.scalars(select(BinState).where(BinState.waste_type == 'general').order_by(BinState.bin_id)))
    states[0].fill_rate_pct_per_hour=0
    states[0].fill_level_pct=0
    for s in states[1:]:
        s.fill_level_pct=99.9
    seeded.flush()
    assert advance(admin,120).status_code==200
    fills=list(levels(admin).values())
    assert all(0<=v<=100 for v in fills) and 0 in fills and 100 in fills
    rows=admin.get('/api/v1/bins/collection-priorities?district=all').json()
    assert rows[0]['priority']=='critical' and rows[0]['estimated_hours_to_90_pct']==0
    assert rows[-1]['estimated_hours_to_90_pct'] is None


@pytest.mark.parametrize('path',['bins',f'bins/{uuid4()}/collect','simulation/seed','simulation/advance','simulation/reset','simulation/pause','simulation/resume'])
def test_mutation_auth(client,monkeypatch,path):
    monkeypatch.setattr(get_settings(),'admin_token',SecretStr('test-admin'))
    assert client.post('/api/v1/'+path,json={}).status_code==401
    assert client.post('/api/v1/'+path,json={},headers={'Authorization':'Bearer wrong'}).status_code==401
    monkeypatch.setattr(get_settings(),'admin_token',None)
    assert client.post('/api/v1/'+path,json={},headers=AUTH).status_code==503


def test_retry_pause_resume_stale_generation_and_speed(admin):
    rid=uuid4()
    generation=status(admin)['generation']
    first=advance(admin,rid=rid).json()
    snapshot=levels(admin)
    second=advance(admin,rid=rid).json()
    assert second['replayed'] and second['simulated_at']==first['simulated_at']
    assert levels(admin)==snapshot
    assert advance(admin,61,rid).status_code==409
    admin.post('/api/v1/simulation/pause',headers=AUTH)
    assert advance(admin).status_code==409
    admin.post('/api/v1/simulation/resume',headers=AUTH)
    assert advance(admin).status_code==200
    admin.post('/api/v1/simulation/reset',headers=AUTH)
    assert advance(admin,generation=generation).status_code==409
    result=admin.post('/api/v1/simulation/advance',headers=AUTH,json=dict(request_id=str(uuid4()),generation=status(admin)['generation'],real_seconds=6))
    assert result.status_code==200
    assert result.json()['simulated_at']=='2026-01-05T01:00:00Z'
    for invalid in (0,-1,1.5):
        assert advance(admin,invalid).status_code==422


def test_inventory_fields_unchanged_by_simulation(admin,seeded):
    before=[(b.id,b.bin_type,b.source_type,b.source_row,b.name,b.district,b.note,b.updated_at) for b in seeded.scalars(select(Bin).order_by(Bin.id))]
    advance(admin)
    admin.post('/api/v1/simulation/reset',headers=AUTH)
    after=[(b.id,b.bin_type,b.source_type,b.source_row,b.name,b.district,b.note,b.updated_at) for b in seeded.scalars(select(Bin).order_by(Bin.id))]
    assert before==after


def test_new_bin_joins_current_clock(admin):
    advance(admin,60)
    b=admin.post('/api/v1/bins',headers=AUTH,json=dict(name='later',longitude=121.54,latitude=25.03)).json()
    assert b['current_usage']['recorded_at']==status(admin)['simulated_at']
    assert b['current_usage']['fill_level_pct']==0
    advance(admin,60)
    assert admin.get('/api/v1/bins/'+b['id']).json()['current_usage']['fill_level_pct']>0
