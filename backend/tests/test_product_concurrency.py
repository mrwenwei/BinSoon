"""Independent connections/commits in a disposable schema, never production."""
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import pytest
from fastapi import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from starlette.requests import Request
from app.models import Bin
from app.modules.common import ProductError, now, write
from app.modules.identity import password_hash
from app.modules.membership import redeem
from app.modules.models import (Incident, MediaAsset, PointEntry, Proposal, Redemption,
    Report, Reward, User, WorkOrder)
from app.modules.schemas import Position, ProposalCreate, Redeem, ReportCreate, Review
from app.modules.participation import create_proposal
from app.modules.workflows import create_report, review_report
from app.services import simulation
from test_migration import revision


@pytest.fixture
def concurrent_product(isolated_engine):
    with isolated_engine.begin() as connection:
        for name in ['0001_initial.py','0002_demo.py','0003_unified_bins.py','0004_product.py','0005_product_integrity.py']:
            revision(connection, name)
    with Session(isolated_engine) as db, db.begin():
        bin_ = Bin(name='並行驗證桶', district='大安區', bin_type='existing', source_type='test_fixture',
            placement_status='existing', status='existing', location=func.ST_SetSRID(func.ST_MakePoint(121.5358,25.033),4326))
        db.add(bin_); db.flush(); simulation.initialize(db)
        users, photos = [], []
        for n in range(4):
            user = User(account=f'parallel-{n}', display_name='測試', password_hash='disabled', roles=['citizen'], districts=[], available_points=100, cumulative_points=100)
            db.add(user); db.flush(); users.append(user.id)
            media = MediaAsset(user_id=user.id, purpose='report', content_type='image/jpeg', size_bytes=100, storage_key=f'{uuid4()}.jpg', sha256='0'*64)
            db.add(media); db.flush(); photos.append(media.id)
        reward = Reward(code='parallel', name='測試獎品', category='coupon', cost=30, stock=1)
        db.add(reward); db.flush()
        result = dict(engine=isolated_engine, bin_id=bin_.id, users=users, photos=photos, reward_id=reward.id)
    return result


def request(path, key):
    return Request(dict(type='http', method='POST', path='/api/v1'+path, query_string=b'', scheme='http', server=('testserver',80),
        headers=[(b'idempotency-key',str(key).encode()),(b'if-match',b'"v3"')]))


def run(p, user_id, path, body, operation, key=None):
    with Session(p['engine']) as db:
        user = db.get(User, user_id)
        response = Response()
        req = request(path,key or uuid4())
        try:
            result = write(db, req, response, user, body.model_dump(), lambda:operation(db,user,req), 201)
            return response.status_code, result, response.headers.get('Idempotency-Replayed')
        except ProductError as exc:
            db.rollback()
            return exc.status, exc.code, None


def test_parallel_reports_one_event_and_one_first_reporter(concurrent_product):
    p = concurrent_product
    def submit(n):
        body = ReportCreate(bin_id=p['bin_id'], type='full', photo_ids=[p['photos'][n]], position=Position(latitude=25.033,longitude=121.5358))
        return run(p, p['users'][n], '/reports', body, lambda db,user,req:create_report(db,user,body))
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(submit,range(4)))
    assert all(status == 201 for status,_,_ in results)
    assert sum(data['first_reporter'] for _,data,_ in results) == 1
    assert len({data['event_id'] for _,data,_ in results}) == 1
    with Session(p['engine']) as db:
        assert db.scalar(select(func.count()).select_from(Incident)) == 1
        assert db.scalar(select(func.count()).select_from(WorkOrder)) == 1
        assert db.scalar(select(func.count()).select_from(Report)) == 4


def test_parallel_retry_replays_same_result(concurrent_product):
    p=concurrent_product; key=uuid4()
    body=ReportCreate(bin_id=p['bin_id'],type='dirty',photo_ids=[p['photos'][0]],position=Position(latitude=25.033,longitude=121.5358))
    def submit(_): return run(p,p['users'][0],'/reports',body,lambda db,user,req:create_report(db,user,body),key)
    with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(submit,range(2)))
    assert results[0][1] == results[1][1]
    assert sum(result[2] == 'true' for result in results) == 1


def test_parallel_redemptions_cannot_oversell(concurrent_product):
    p=concurrent_product
    body=Redeem(reward_id=p['reward_id'])
    def submit(n): return run(p,p['users'][n],'/redemptions',body,lambda db,user,req:redeem(db,user,body))
    with ThreadPoolExecutor(max_workers=4) as pool: results=list(pool.map(submit,range(4)))
    assert sorted(status for status,_,_ in results) == [201,409,409,409]
    with Session(p['engine']) as db:
        assert db.get(Reward,p['reward_id']).stock == 0
        assert db.scalar(select(func.count()).select_from(Redemption)) == 1
        assert sum(db.get(User,id_).available_points for id_ in p['users']) == 370


def test_parallel_proposals_cannot_exceed_monthly_quota(concurrent_product):
    p=concurrent_product
    body=ProposalCreate(name='並行提案',reason='待現勘',latitude=25.033,longitude=121.5358,confirmed_nearby=True)
    def submit(_): return run(p,p['users'][0],'/proposals',body,lambda db,user,req:create_proposal(db,user,body))
    with ThreadPoolExecutor(max_workers=4) as pool: results=list(pool.map(submit,range(4)))
    assert sorted(status for status,_,_ in results) == [201,201,201,409]
    with Session(p['engine']) as db:
        assert db.scalar(select(func.count()).select_from(Proposal)) == 3
        assert db.scalar(select(func.count()).select_from(Bin).where(Bin.bin_type == 'proposed')) == 3


def test_parallel_review_only_settles_once(concurrent_product):
    p=concurrent_product
    body=ReportCreate(bin_id=p['bin_id'],type='full',photo_ids=[p['photos'][0]],position=Position(latitude=25.033,longitude=121.5358))
    report=run(p,p['users'][0],'/reports',body,lambda db,user,req:create_report(db,user,body))[1]
    with Session(p['engine']) as db, db.begin():
        staff=User(account='staff',display_name='隊員',password_hash='disabled',roles=['staff'],districts=['大安區'])
        db.add(staff); db.flush(); staff_id=staff.id
        work=db.get(WorkOrder,report['work_order_id'])
        work.assigned_staff_id,work.accepted_at,work.arrived_at,work.status,work.version=staff.id,now(),now(),'arrived',3
    body=Review(decision='approved')
    path=f"/staff/work-orders/{report['work_order_id']}/reports/{report['id']}/review"
    def submit(_):
        from uuid import UUID
        return run(p,staff_id,path,body,lambda db,user,req:review_report(db,UUID(report['work_order_id']),UUID(report['id']),user,req,body))
    with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(submit,range(2)))
    assert sorted(status for status,_,_ in results) == [201,412]
    with Session(p['engine']) as db:
        assert db.get(User,p['users'][0]).available_points == 101
        assert db.scalar(select(func.count()).select_from(PointEntry)) == 1
