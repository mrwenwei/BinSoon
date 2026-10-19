"""Independent streams, migration provenance, work evidence and compatibility."""
import hashlib
import json
from uuid import UUID, uuid4
from datetime import timedelta
from pydantic import SecretStr
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from app.config import get_settings
from app.models import Bin, BinState, BinReading
from app.modules.models import Idempotency, Incident, Notification, WorkOrder
from app.services import simulation as sim
from app.simulation_schemas import AdvanceRequest
from test_migration import revision
from test_product import db, product, headers, report_body, arrive, verify, evidence, command, upload  # noqa: F401 -- fixtures
from test_product_concurrency import concurrent_product, run  # noqa: F401 -- fixture


def states(p):
    id_=UUID(p['bin']['id'])
    return {t:p['db'].get(BinState,(id_,t)) for t in ('general','recycling')}


def submit(p, kind, problem='full'):
    body=report_body(p,problem)
    body['waste_type']=kind
    response=p['client'].post('/api/v1/reports',json=body,headers=headers(p))
    assert response.status_code==201,response.text
    return response.json()


def test_both_streams_for_existing_new_and_proposals(product):
    p=product; c=p['client']; db=p['db']
    count=db.scalar(select(func.count()).select_from(Bin))
    assert db.scalar(select(func.count()).select_from(BinState))==2*count
    item=c.get('/api/v1/bins/'+p['bin']['id']).json()
    assert len(item['compartments'])==2
    assert item['current_usage']['waste_type']=='general'
    pair=states(p)
    assert pair['general'].capacity_liters==120 and pair['recycling'].capacity_liters==80
    assert pair['recycling'].fill_rate_pct_per_hour==pair['general'].fill_rate_pct_per_hour*.65
    before=db.scalar(select(func.count()).select_from(BinReading))
    sim.initialize(db); sim.initialize(db)
    assert db.scalar(select(func.count()).select_from(BinReading))==before
    proposal=c.post('/api/v1/proposals',json=dict(name='雙槽展示提案',reason='待會勘',latitude=25.033,longitude=121.5358),headers=headers(p))
    assert proposal.status_code==201,proposal.text
    new_id=proposal.json()['proposal']['bin_id']
    assert len(c.get('/api/v1/bins/'+new_id).json()['compartments'])==2
    assert {r['waste_type'] for r in c.get('/api/v1/bins/'+new_id+'/history').json()}=={'general','recycling'}


def test_recycling_usable_when_general_full_and_repair_is_scoped(product):
    p=product; c=p['client']; pair=states(p)
    pair['general'].fill_level_pct=95; pair['recycling'].fill_level_pct=20; p['db'].flush()
    id_=p['bin']['id']; point=p['bin']
    query=f"latitude={point['latitude']}&longitude={point['longitude']}"
    general=c.get(f'/api/v1/bins/{id_}/view').json()
    recycle=c.get(f'/api/v1/bins/{id_}/view?waste_type=recycling').json()
    assert not general['status']['is_usable'] and recycle['status']['is_usable']
    assert general['status']['fill_level_pct']==95 and recycle['status']['fill_level_pct']==20
    assert recycle['status']==next(s for s in recycle['compartments'] if s['waste_type']=='recycling')
    assert c.get('/api/v1/map/nearest-usable?'+query).json()['items'][0]['id']!=id_
    assert c.get('/api/v1/map/nearest-usable?'+query+'&waste_type=recycling').json()['items'][0]['id']==id_
    broken=submit(p,'general','broken'); arrive(p,broken['work_order_id'])
    assert c.get(f'/api/v1/bins/{id_}/view').json()['status']['operational_status']=='repair'
    assert c.get(f'/api/v1/bins/{id_}/view?waste_type=recycling').json()['status']['operational_status']=='normal'
    assert c.get('/api/v1/map/availability?'+query+'&waste_type=recycling').json()['has_existing_bin_within_radius']


def test_clear_scopes_history_readings_and_priorities(product,monkeypatch):
    p=product; c=p['client']; pair=states(p); id_=p['bin']['id']
    monkeypatch.setattr(get_settings(),'admin_token',SecretStr('stream-admin'))
    pair['general'].fill_level_pct=96; pair['recycling'].fill_level_pct=75; p['db'].flush()
    response=c.post(f'/api/v1/bins/{id_}/collect?waste_type=recycling',headers={'Authorization':'Bearer stream-admin'})
    assert response.status_code==200
    assert response.json()['current_usage']['waste_type']=='recycling'
    assert pair['recycling'].fill_level_pct==0 and pair['general'].fill_level_pct==96
    assert c.get(f'/api/v1/bins/{id_}/history?waste_type=general').json()[0]['event_type']=='reset'
    assert any(r['event_type']=='collection' for r in c.get(f'/api/v1/bins/{id_}/history?waste_type=recycling').json())
    assert all(r['waste_type']=='recycling' for r in c.get(f'/api/v1/bins/{id_}/history?waste_type=recycling').json())
    rows=c.get('/api/v1/bins/collection-priorities?waste_type=recycling').json()
    assert all(r['waste_type']=='recycling' for r in rows)
    assert next(r for r in rows if r['bin_id']==id_)['priority']=='low'


def test_independent_events_work_clear_likes_and_stats(product):
    p=product; c=p['client']; pair=states(p)
    general=submit(p,'general'); recycling=submit(p,'recycling')
    assert general['event_id']!=recycling['event_id']
    assert general['work_order_id']!=recycling['work_order_id']
    assert general['first_reporter'] and recycling['first_reporter']
    assert c.get('/api/v1/me/reports?waste_type=recycling',headers=headers(p)).json()['page']['total']==1
    assert c.get('/api/v1/staff/work-orders?waste_type=recycling',headers=headers(p,'staff')).json()['page']['total']==1
    for r in (general,recycling):
        arrive(p,r['work_order_id']); assert verify(p,r).status_code==200
        assert evidence(p,r['work_order_id']).status_code==200
        assert command(p,r['work_order_id'],'finish').json()['status']=='waiting_sensor'
    pair['general'].fill_level_pct=97; pair['recycling'].fill_level_pct=88; p['db'].flush()
    result=command(p,recycling['work_order_id'],'demo-clear',{'reading_id':str(uuid4())},role='admin')
    assert result.status_code==200,result.text
    assert result.json()['reading']['waste_type']=='recycling'
    assert result.json()['work_order']['status']=='completed'
    assert pair['general'].fill_level_pct==97 and pair['recycling'].fill_level_pct==0
    assert c.get('/api/v1/staff/work-orders/'+general['work_order_id'],headers=headers(p,'staff')).json()['work_order']['status']=='waiting_sensor'
    comp=c.get('/api/v1/bins/'+p['bin']['id']+'/view?waste_type=recycling',headers=headers(p)).json()['latest_cleanup']
    assert comp['waste_type']=='recycling'
    assert c.post('/api/v1/completions/'+comp['id']+'/like',json={},headers=headers(p)).status_code==200
    assert c.get('/api/v1/staff/statistics?waste_type=recycling',headers=headers(p,'staff')).json()['completed_count']==1
    assert c.get('/api/v1/public/outcomes?waste_type=general').json()['completed_count']==0


def test_seed_reset_reproducible_for_both_streams_and_reads_inert(product):
    p=product; db=p['db']; id_=p['bin']['id']; c=p['client']
    def advance(minutes): sim.advance(db,AdvanceRequest(request_id=uuid4(),generation=sim.get_clock(db).generation,minutes=minutes))
    sim.reset(db); advance(120)
    values={t:s.fill_level_pct for t,s in states(p).items()}
    assert values['general']!=values['recycling']
    n=db.scalar(select(func.count()).select_from(BinReading))
    for _ in range(2): c.get(f'/api/v1/bins/{id_}/view?waste_type=recycling')
    assert db.scalar(select(func.count()).select_from(BinReading))==n
    sim.reset(db); advance(60); advance(60)
    assert {t:s.fill_level_pct for t,s in states(p).items()}==values
    for s in states(p).values(): s.fill_level_pct=99.99
    advance(1000)
    assert all(0<=s.fill_level_pct<=100 for s in states(p).values())
    sim.reset(db)
    assert all(s.fill_level_pct==0 for s in states(p).values())


def test_invalid_waste_types_and_legacy_idempotency_replay(product):
    p=product; c=p['client']
    for path in ('bins','map/locations','map/nearest-usable','bins/'+p['bin']['id']+'/history','staff/work-orders','public/outcomes'):
        assert c.get('/api/v1/'+path+'?waste_type=other',headers=headers(p,'staff')).status_code==422
    body=report_body(p); key=uuid4()
    result=c.post('/api/v1/reports',json=body,headers=headers(p,key=key))
    assert result.status_code==201
    # Simulate a persisted response/hash written by 0005, without classification.
    item=p['db'].scalar(select(Idempotency).where(Idempotency.key==key))
    item.body_hash=hashlib.sha256(json.dumps(body,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    item.response={k:v for k,v in item.response.items() if k not in {'waste_type','classification_source'}}
    p['db'].flush()
    replay=c.post('/api/v1/reports',json=body,headers=headers(p,key=key))
    assert replay.status_code==201 and replay.headers['Idempotency-Replayed']=='true'
    assert replay.json()['waste_type']=='general' and replay.json()['classification_source']=='legacy_assumed_general'
    assert c.post('/api/v1/reports',json=dict(body,waste_type='recycling'),headers=headers(p,key=key)).status_code==409


def test_migration_keeps_unclassified_history_and_assumption_labels(isolated_engine):
    bin_id,reading_id=uuid4(),uuid4()
    with isolated_engine.begin() as connection:
        for name in ('0001_initial.py','0002_demo.py','0003_unified_bins.py','0004_product.py','0005_product_integrity.py'):
            revision(connection,name)
        connection.execute(text("""INSERT INTO bins(id,district,location,source_type,bin_type,name,status,placement_status)
            VALUES(:id,'大安區',ST_GeogFromText('SRID=4326;POINT(121.5358 25.033)'),'test','existing','舊桶','existing','existing')"""),{'id':bin_id})
        connection.execute(text("""INSERT INTO simulation_clocks VALUES('city_bins','2026-01-05T12:00:00Z','running',42,600,'unified-v1',0)"""))
        connection.execute(text("""INSERT INTO bin_states(bin_id,fill_level_pct,capacity_liters,fill_rate_pct_per_hour,last_updated_at,source_type)
            VALUES(:id,42,120,6,'2026-01-05T12:00:00Z','simulated')"""),{'id':bin_id})
        connection.execute(text("""INSERT INTO bin_readings(id,bin_id,fill_level_pct,recorded_at,source_type,event_type,generation)
            VALUES(:reading,:bin,42,'2026-01-05T12:00:00Z','simulated','measurement',0)"""),{'reading':reading_id,'bin':bin_id})
        revision(connection,'0006_waste_streams.py')
    with Session(isolated_engine) as db,db.begin():
        old=db.get(BinReading,reading_id)
        assert old.fill_level_pct==42 and old.waste_type is None and old.classification_source=='legacy_unclassified'
        state=db.get(BinState,(bin_id,'general'))
        assert state.fill_level_pct==42 and state.classification_source=='legacy_assumed_general'
        sim.initialize(db); sim.initialize(db)
        recycle=db.get(BinState,(bin_id,'recycling'))
        assert recycle.fill_level_pct==0 and recycle.last_updated_at==sim.get_clock(db).simulated_at
        assert db.scalar(select(func.count()).select_from(BinReading))==2
        assert db.get(BinReading,reading_id).waste_type is None


def test_parallel_streams_keep_one_open_event_per_kind(concurrent_product):
    from concurrent.futures import ThreadPoolExecutor
    from app.modules.schemas import ReportCreate, Position
    from app.modules.workflows import create_report
    p=concurrent_product
    def submitter(n):
        body=ReportCreate(bin_id=p['bin_id'],type='full',waste_type='general' if n%2==0 else 'recycling',
            photo_ids=[p['photos'][n]],position=Position(latitude=25.033,longitude=121.5358))
        return run(p,p['users'][n],'/reports',body,lambda db,user,request:create_report(db,user,body))
    with ThreadPoolExecutor(max_workers=4) as pool: results=list(pool.map(submitter,range(4)))
    assert all(status==201 for status,_,_ in results)
    assert len({data['event_id'] for _,data,_ in results})==2
    assert sum(data['first_reporter'] for _,data,_ in results)==2
    with Session(p['engine']) as db:
        assert db.scalar(select(func.count()).select_from(Incident))==2
        assert db.scalar(select(func.count()).select_from(WorkOrder))==2


def test_legacy_evidence_replay_keeps_historical_snapshot(product):
    p=product; report=submit(p,'general'); work=report['work_order_id']
    arrive(p,work)
    body=dict(media_id=upload(p,'completion','staff'),purpose='completion')
    key=uuid4()
    assert command(p,work,'evidence',body,key=key).status_code==200
    item=p['db'].scalar(select(Idempotency).where(Idempotency.key==key))
    data=json.loads(json.dumps(item.response))
    data['location'].pop('compartments')
    for value in (data['location']['bin_status'],data['work_order']):
        value.pop('waste_type'); value.pop('classification_source')
    item.response=data; p['db'].flush()
    replay=command(p,work,'evidence',body,key=key)
    assert replay.status_code==200 and replay.headers['Idempotency-Replayed']=='true'
    assert replay.json()['location']['compartments']==[]
    assert replay.json()['location']['bin_status']['waste_type']=='general'
    fresh=p['client'].get('/api/v1/staff/work-orders/'+work,headers=headers(p,'staff')).json()
    assert len(fresh['location']['compartments'])==2
