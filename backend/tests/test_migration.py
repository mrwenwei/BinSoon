import importlib.util
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path
from uuid import uuid4
import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import inspect, select, func, text
from sqlalchemy.orm import Session
from app.models import Bin, BinState, BinReading, SimulationAdvance
from app.services import simulation as sim
from app.simulation_schemas import AdvanceRequest


def revision(connection, name):
    spec = importlib.util.spec_from_file_location('revision',Path('alembic/versions')/name)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with Operations.context(MigrationContext.configure(connection)):
        module.upgrade()


def legacy_schema(engine):
    with engine.begin() as c:
        revision(c,'0001_initial.py')
        revision(c,'0002_demo.py')


def test_migration_preserves_old_data_and_reading_ids(isolated_engine):
    legacy_schema(isolated_engine)
    existing, candidate, reading, request = [uuid4() for _ in range(4)]
    with isolated_engine.begin() as c:
        c.execute(text("""INSERT INTO trash_bins (id,district,location,source_type,source_row,source_file,address,status,location_precision,note)
            VALUES (:id,'大安區',ST_GeogFromText('SRID=4326;POINT(121.54 25.03)'), 'city_bin_inventory',1,'original.csv','地址','existing','original','保留原始備註')"""),dict(id=existing))
        c.execute(text("""INSERT INTO candidate_locations (id,district,location,source_type,name,external_id,rank,demand_score,placement_status,feasibility_status)
            VALUES (:id,'中正區',ST_GeogFromText('SRID=4326;POINT(121.53 25.04)'),'model_recommendation','原始提案','LEGACY-001',4,71.4,'proposed','pending_review')"""),dict(id=candidate))
        c.execute(text("""INSERT INTO demo_scenarios VALUES ('daan_phase1_10bins','2026-01-05T01:00:00Z','paused',42,600,'phase1-v1',3)"""))
        c.execute(text("""INSERT INTO simulation_states (candidate_id,scenario_id,fill_level_pct,capacity_liters,fill_rate_pct_per_hour,last_updated_at,last_emptied_at,source_type,simulation_status,random_seed)
            VALUES (:id,'daan_phase1_10bins',42.5,120,7.14,'2026-01-05T01:00:00Z',NULL,'simulated','paused',42)"""),dict(id=candidate))
        c.execute(text("""INSERT INTO reading_history VALUES (:reading,:candidate,42.5,'2026-01-05T01:00:00Z','simulated','measurement')"""),dict(reading=reading,candidate=candidate))
        c.execute(text("""INSERT INTO demo_advances VALUES (:id,'daan_phase1_10bins',3,60,'2026-01-05T01:00:00Z')"""),dict(id=request))
        revision(c,'0003_unified_bins.py')
        revision(c,'0004_product.py')
        revision(c,'0005_product_integrity.py')
        revision(c,'0006_waste_streams.py')
    with Session(isolated_engine) as db:
        assert db.get(Bin,existing).note=='保留原始備註'
        assert db.get(Bin,existing).source_file=='original.csv'
        assert db.get(Bin,candidate).rank==4 and db.get(Bin,candidate).name=='原始提案'
        assert db.get(Bin,candidate).bin_type=='proposed'
        assert db.get(BinState,(candidate,'general')).fill_level_pct==42.5
        assert db.get(BinReading,reading).bin_id==candidate
        assert db.get(BinReading,reading).generation==3
        assert db.get(SimulationAdvance,request).minutes==60
        assert sim.get_clock(db).simulation_status=='paused'
    with isolated_engine.begin() as c:
        assert 'candidate_locations' not in inspect(c).get_table_names(schema=c.exec_driver_sql('SELECT current_schema()').scalar())


def test_uuid_collision_stops_migration_before_changes(isolated_engine):
    legacy_schema(isolated_engine)
    id_=uuid4()
    with isolated_engine.begin() as c:
        common=dict(id=id_)
        c.execute(text("""INSERT INTO trash_bins (id,district,location,source_type,address,status,location_precision)
            VALUES (:id,'大安區',ST_GeogFromText('SRID=4326;POINT(121.54 25.03)'),'city_bin_inventory','a','existing','original')"""),common)
        c.execute(text("""INSERT INTO candidate_locations (id,district,location,source_type,name)
            VALUES (:id,'大安區',ST_GeogFromText('SRID=4326;POINT(121.54 25.03)'),'manual_candidate','b')"""),common)
        with pytest.raises(RuntimeError,match='UUID collision'):
            revision(c,'0003_unified_bins.py')
        assert c.scalar(text('SELECT count(*) FROM trash_bins'))==1
        assert c.scalar(text('SELECT count(*) FROM candidate_locations'))==1


def test_parallel_advance_and_seed(isolated_engine):
    with isolated_engine.begin() as c:
        for name in ('0001_initial.py','0002_demo.py','0003_unified_bins.py','0004_product.py','0005_product_integrity.py','0006_waste_streams.py'):
            revision(c,name)
    def seed(_):
        with Session(isolated_engine) as db,db.begin():
            sim.seed(db)
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(seed,range(2)))
    request=uuid4()
    def advance(id_):
        with Session(isolated_engine) as db,db.begin():
            return sim.advance(db,AdvanceRequest(request_id=id_,generation=0,minutes=60))
    with ThreadPoolExecutor(max_workers=2) as pool:
        result=list(pool.map(advance,[request,request]))
    assert sorted(r['replayed'] for r in result)==[False,True]
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(advance,[uuid4(),uuid4()]))
    with Session(isolated_engine) as db:
        assert sim.get_clock(db).simulated_at==sim.START+timedelta(hours=3)
        assert db.scalar(select(func.count()).select_from(Bin))==10
        assert db.scalar(select(func.count()).select_from(BinReading))==80
