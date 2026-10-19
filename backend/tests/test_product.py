"""Product API integration against real PostGIS; all changes roll back."""
import io
import secrets
from datetime import timedelta
from uuid import uuid4
import pytest
from PIL import Image
from pydantic import SecretStr
from sqlalchemy import func, select
from app.config import get_settings
from app.models import Bin, BinReading, BinState
from app.modules.common import now
from app.modules.identity import password_hash, token_hash
from app.modules.models import (Adoption, AuthSession, Completion, CompletionLike, Idempotency, Incident,
    MediaAsset, Notification, PointEntry, Proposal, Redemption, Report, Reward, User, Vote, WorkOrder)
from app.modules import views
from scripts.seed_product_demo import seed


@pytest.fixture
def db(isolated_engine):
    # Demo accounts may already exist in the developer's local database.
    # Seed intentionally does not rotate their passwords. Use a private schema
    # so real dev credentials/rate limits never affect or get changed by tests.
    from sqlalchemy.orm import Session
    from test_migration import revision
    with isolated_engine.begin() as connection:
        for name in ('0001_initial.py', '0002_demo.py', '0003_unified_bins.py',
                     '0004_product.py', '0005_product_integrity.py','0006_waste_streams.py'):
            revision(connection, name)
    with isolated_engine.connect() as connection:
        transaction = connection.begin()
        with Session(bind=connection, join_transaction_mode='create_savepoint') as session:
            yield session
        transaction.rollback()


@pytest.fixture
def product(client, seeded, monkeypatch, tmp_path):
    settings = get_settings()
    password = secrets.token_urlsafe(20)
    monkeypatch.setattr(settings, "demo_auth_enabled", True)
    monkeypatch.setattr(settings, "media_backend", "local")
    monkeypatch.setattr(settings, "media_directory", str(tmp_path))
    for role in ("citizen", "staff", "admin"):
        monkeypatch.setattr(settings, f"demo_{role}_password", SecretStr(password))
    seed(seeded)
    tokens, users = {}, {}
    for role in ("citizen", "staff", "admin"):
        user = seeded.scalar(select(User).where(User.account == f"demo-{role}"))
        token = secrets.token_urlsafe(30)
        seeded.add(AuthSession(user_id=user.id, token_hash=token_hash(token), expires_at=now()+timedelta(hours=1)))
        tokens[role], users[role] = token, user
    for name, roles, districts in [("other", ["citizen"], []), ("outside", ["staff"], ["中正區"])]:
        user = User(account=name, display_name=name, password_hash=password_hash(password), roles=roles, districts=districts)
        seeded.add(user)
        seeded.flush()
        token = secrets.token_urlsafe(30)
        seeded.add(AuthSession(user_id=user.id, token_hash=token_hash(token), expires_at=now()+timedelta(hours=1)))
        tokens[name], users[name] = token, user
    seeded.flush()
    rows = client.get('/api/v1/bins?bin_type=existing').json()
    return dict(client=client, db=seeded, tokens=tokens, users=users, password=password, bin=rows[0], bins=rows)


def headers(p, role="citizen", key=None, etag=None):
    result = {"Authorization":"Bearer "+p["tokens"][role], "Idempotency-Key":str(key or uuid4())}
    if etag: result['If-Match'] = etag
    return result


def upload(p, purpose="report", role="citizen"):
    output = io.BytesIO()
    image = Image.new("RGB", (16, 16), (60, 120, 90))
    exif = Image.Exif(); exif[270] = "private test metadata"
    image.save(output, "JPEG", exif=exif)
    response = p['client'].post('/api/v1/media', files={'file':('photo.jpg', output.getvalue(), 'image/jpeg')},
        data={'purpose':purpose}, headers=headers(p, role))
    assert response.status_code == 201, response.text
    return response.json()['id']


def report_body(p, type_="full", role="citizen", bin_=None):
    bin_ = bin_ or p['bin']
    return dict(bin_id=bin_['id'], type=type_, description="現場狀況說明", photo_ids=[upload(p, role=role)],
        position=dict(latitude=bin_['latitude'], longitude=bin_['longitude']), quick=False)


def create_report(p, type_="full", role="citizen", bin_=None):
    response = p['client'].post('/api/v1/reports', json=report_body(p, type_, role, bin_), headers=headers(p, role))
    assert response.status_code == 201, response.text
    return response.json()


def command(p, work_id, action, body=None, role="staff", key=None):
    prefix = 'admin' if role == 'admin' else 'staff'
    detail = p['client'].get(f'/api/v1/{prefix}/work-orders/{work_id}', headers=headers(p, role))
    assert detail.status_code == 200, detail.text
    return p['client'].post(f'/api/v1/{prefix}/work-orders/{work_id}/{action}', json=body or {},
        headers=headers(p, role, key, detail.headers['ETag']))


def arrive(p, work):
    assert command(p, work, 'accept').status_code == 200
    assert command(p, work, 'arrive').status_code == 200


def verify(p, report, decision="approved"):
    return command(p, report['work_order_id'], f"reports/{report['id']}/review",
        dict(decision=decision, reason="查證不符" if decision == 'rejected' else None))


def evidence(p, work, purpose="completion"):
    return command(p, work, 'evidence', dict(media_id=upload(p, purpose, 'staff'), purpose=purpose))


def test_demo_login_expiry_logout_and_disabled(product, monkeypatch):
    p = product; c = p['client']; db = p['db']
    response = c.post('/api/v1/auth/demo/login', json=dict(account='demo-citizen', password=p['password']))
    assert response.status_code == 200
    token = response.json()['access_token']
    assert response.json()['user']['roles'] == ['citizen']
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash(token)))
    assert session.token_hash != token
    auth = {'Authorization':'Bearer '+token}
    assert c.get('/api/v1/me', headers=auth).status_code == 200
    assert c.delete('/api/v1/auth/session', headers=auth).status_code == 204
    assert c.get('/api/v1/me', headers=auth).status_code == 401
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash(p['tokens']['citizen'])))
    session.expires_at = now()-timedelta(seconds=1); db.flush()
    assert c.get('/api/v1/me', headers=headers(p)).json()['detail']['code'] == 'SESSION_EXPIRED'
    monkeypatch.setattr(get_settings(), 'demo_auth_enabled', False)
    assert c.post('/api/v1/auth/demo/login', json=dict(account='demo-citizen', password=p['password'])).status_code == 503


def test_seed_repeat_preserves_balances_and_catalog(product):
    p = product; db = p['db']
    seed(db, grant_points=63); db.flush()
    seed(db, grant_points=63); db.flush()
    assert db.scalar(select(func.count()).select_from(Reward)) == 4
    assert db.scalar(select(func.count()).select_from(PointEntry).where(PointEntry.type == 'demo_grant')) == 1
    assert p['users']['citizen'].available_points == 63
    assert not db.scalar(select(func.count()).select_from(Report))


def test_map_semantics_and_history_do_not_mutate(product):
    p = product; c = p['client']; db = p['db']
    before = db.scalar(select(func.count()).select_from(BinReading))
    first = c.get('/api/v1/map/locations?district=all&kind=all&limit=100').json()
    assert first['page']['total'] == 811
    assert c.get('/api/v1/map/locations').json()['page']['total'] == 47
    assert c.get('/api/v1/map/locations?kind=place').json()['page']['total'] == 18
    item = c.get(f"/api/v1/bins/{p['bin']['id']}/view").json()
    assert item['status']['fill_level_pct'] == p['bin']['current_usage']['fill_level_pct']
    assert item['status'] == item['location']['bin_status']
    assert item['status']['installed_at'] is None and not item['status']['is_new']
    assert item['location']['longitude'] == p['bin']['longitude']
    for _ in range(2): c.get(f"/api/v1/bins/{p['bin']['id']}/history")
    assert db.scalar(select(func.count()).select_from(BinReading)) == before
    query = f"latitude={p['bin']['latitude']}&longitude={p['bin']['longitude']}"
    result = c.get('/api/v1/map/availability?'+query).json()
    assert result['has_existing_bin_within_radius']
    state = db.get(BinState, (p['bin']['id'],'general')); state.fill_level_pct = 100; db.flush()
    assert c.get('/api/v1/map/availability?'+query).json()['has_existing_bin_within_radius']
    assert c.get('/api/v1/map/nearest-usable?'+query).json()['items'][0]['id'] != p['bin']['id']


def test_report_dedup_evidence_authorization_and_event_ids(product):
    p = product; c = p['client']; db = p['db']
    body = report_body(p)
    assert c.post('/api/v1/reports', json=body).status_code == 401
    assert c.post('/api/v1/reports', json=body, headers=headers(p, 'staff')).status_code == 403
    key = uuid4()
    response = c.post('/api/v1/reports', json=body, headers=headers(p, key=key)); assert response.status_code == 201, response.text
    report = response.json()
    assert report['event_id'] != report['work_order_id']
    replay = c.post('/api/v1/reports', json=body, headers=headers(p, key=key))
    assert replay.status_code == 201 and replay.headers['Idempotency-Replayed'] == 'true'
    assert replay.json() == report
    assert c.post('/api/v1/reports', json=dict(body, description='changed'), headers=headers(p, key=key)).status_code == 409
    duplicate = c.post('/api/v1/reports', json=body, headers=headers(p))
    assert duplicate.status_code == 200 and duplicate.json()['id'] == report['id']
    assert db.scalar(select(func.count()).select_from(Incident)) == 1
    assert c.get(f"/api/v1/reports/{report['id']}", headers=headers(p, 'other')).status_code == 404
    assert c.get(f"/api/v1/staff/work-orders/{report['work_order_id']}", headers=headers(p, 'outside')).status_code == 404
    second = create_report(p, role='other')
    assert second['event_id'] == report['event_id'] and not second['first_reporter']


@pytest.mark.parametrize('clear_first', [False, True])
def test_full_workflow_points_clear_completion_and_likes(product, clear_first):
    p = product; c = p['client']; db = p['db']
    report = create_report(p); work = report['work_order_id']
    bad = command(p, work, 'arrive'); assert bad.status_code == 409
    assert command(p, work, f"reports/{report['id']}/review", dict(decision='approved')).status_code == 409
    arrive(p, work)
    verify_response = verify(p, report); assert verify_response.status_code == 200, verify_response.text
    assert verify_response.json()['report']['awarded_points'] == 1
    assert verify_response.json()['work_order']['status'] == 'arrived'
    assert verify(p, report).status_code == 409
    assert c.get('/api/v1/me/membership', headers=headers(p)).json()['available_points'] == 1
    reading_id = str(uuid4())
    if clear_first:
        result = command(p, work, 'demo-clear', dict(reading_id=reading_id), 'admin')
        assert result.status_code == 200, result.text
        assert result.json()['work_order']['status'] == 'arrived'
        assert db.get(BinState, (p['bin']['id'],'general')).fill_level_pct == 0
    assert evidence(p, work).status_code == 200
    finish = command(p, work, 'finish'); assert finish.status_code == 200, finish.text
    if not clear_first:
        assert finish.json()['status'] == 'waiting_sensor'
        result = command(p, work, 'demo-clear', dict(reading_id=reading_id), 'admin')
        assert result.status_code == 200, result.text
    detail = c.get(f'/api/v1/staff/work-orders/{work}', headers=headers(p, 'staff')).json()
    assert detail['work_order']['status'] == 'completed'
    assert detail['latest_reading']['source_type'] == 'simulated'
    assert db.scalar(select(func.count()).select_from(Completion)) == 1
    cleanup = detail['work_order']['completion_id']
    for _ in range(2):
        result = c.post(f'/api/v1/completions/{cleanup}/like', json={}, headers=headers(p))
        assert result.status_code == 200 and result.json()['like_count'] == 1
    assert db.scalar(select(func.count()).select_from(CompletionLike)) == 1
    assert c.get('/api/v1/staff/statistics', headers=headers(p, 'staff')).json()['completed_count'] == 1
    assert c.get('/api/v1/public/outcomes').json()['completed_count'] == 1
    assert c.get('/api/v1/staff/route-stops', headers=headers(p, 'staff')).json()['stops'] == []
    new = create_report(p)
    assert new['event_id'] != report['event_id'] and new['first_reporter']


def test_rejection_no_promotion_and_third_rejection_only_blocks_reporting(product):
    p = product; c = p['client']; db = p['db']
    first = create_report(p, 'dirty')
    second = create_report(p, 'dirty', 'other')
    work = first['work_order_id']; arrive(p, work)
    assert verify(p, first, 'rejected').status_code == 200
    result = verify(p, second); assert result.status_code == 200
    assert result.json()['report']['awarded_points'] == 0
    for problem in ['dumping', 'broken']:
        report = create_report(p, problem); arrive(p, report['work_order_id'])
        assert verify(p, report, 'rejected').status_code == 200
    assert c.get('/api/v1/me/membership', headers=headers(p)).json()['reporting_suspended']
    assert c.post('/api/v1/reports', json=report_body(p), headers=headers(p)).status_code == 403
    assert c.get('/api/v1/me/proposal-quota', headers=headers(p)).status_code == 200
    assert c.post('/api/v1/proposals', json=dict(name='提案', reason='需求', latitude=25.033, longitude=121.5358), headers=headers(p)).status_code == 201


@pytest.mark.parametrize('problem', ['dirty', 'dumping', 'broken', 'other'])
def test_nonfull_work_and_repair_constraints(product, problem):
    p = product; c = p['client']; report = create_report(p, problem); work = report['work_order_id']
    arrive(p, work); assert verify(p, report).status_code == 200
    if problem == 'broken':
        assert command(p, work, 'defer-repair', dict(reason='需要修繕')).status_code == 200
        view = c.get(f"/api/v1/bins/{p['bin']['id']}/view").json()
        assert view['status']['operational_status'] == 'repair'
        assert not view['status']['is_usable']
    assert command(p, work, 'demo-clear', dict(reading_id=str(uuid4())), 'admin').status_code == 409
    assert evidence(p, work).status_code == 200
    result = command(p, work, 'finish'); assert result.status_code == 200
    assert result.json()['status'] == 'completed'
    assert c.get(f"/api/v1/bins/{p['bin']['id']}/view").json()['status']['operational_status'] == 'normal'


def test_dismiss_and_version_conflicts(product):
    p = product; c = p['client']; report = create_report(p); work = report['work_order_id']
    assert c.post(f'/api/v1/staff/work-orders/{work}/accept', json={}, headers=headers(p, 'staff')).status_code == 428
    assert c.post(f'/api/v1/staff/work-orders/{work}/accept', json={}, headers=headers(p, 'staff', etag='"v99"')).status_code == 412
    arrive(p, work); verify(p, report, 'rejected')
    assert command(p, work, 'dismiss', dict(reason='現場已無需處理')).status_code == 409
    assert evidence(p, work, 'site').status_code == 200
    result = command(p, work, 'dismiss', dict(reason='現場已無需處理'))
    assert result.status_code == 200 and result.json()['status'] == 'dismissed'
    assert p['db'].scalar(select(func.count()).select_from(Completion)) == 0


def test_media_is_private_normalized_and_session_bound(product):
    p = product; c = p['client']; asset = upload(p)
    assert c.get(f'/api/v1/media/{asset}/access').status_code == 401
    assert c.get(f'/api/v1/media/{asset}/access', headers=headers(p, 'other')).status_code == 404
    link = c.get(f'/api/v1/media/{asset}/access', headers=headers(p)).json()['url']
    result = c.get(link); assert result.status_code == 200
    with Image.open(io.BytesIO(result.content)) as image:
        assert not image.getexif()
    assert c.post('/api/v1/media', files={'file':('bad.jpg', b'not an image', 'image/jpeg')}, data={'purpose':'report'}, headers=headers(p)).status_code == 415
    assert c.post('/api/v1/media', files={'file':('big.jpg', b'x'*(5*1024*1024+1), 'image/jpeg')}, data={'purpose':'report'}, headers=headers(p)).status_code == 413
    assert c.delete('/api/v1/auth/session', headers=headers(p)).status_code == 204
    assert c.get(link).status_code == 404


def proposal_body(**updates):
    return dict(name='大安示範提案', reason='待會勘需求', latitude=25.033, longitude=121.5358, confirmed_nearby=True, **updates)


def test_proposal_bin_identity_quota_and_boundary(product):
    p = product; c = p['client']; db = p['db']
    body = proposal_body(); key = uuid4()
    first = c.post('/api/v1/proposals', json=body, headers=headers(p, key=key)); assert first.status_code == 201, first.text
    proposal = first.json()['proposal']
    assert proposal['support'] == 1 and proposal['total_votes'] == 1 and proposal['my_vote'] == 'support'
    bin_ = c.get('/api/v1/bins/'+proposal['bin_id']).json()
    assert bin_['bin_type'] == 'proposed' and bin_['source_type'] == 'user_proposal'
    assert c.get('/api/v1/map/locations').json()['page']['total'] == 47
    assert c.post('/api/v1/proposals', json=body, headers=headers(p, key=key)).json() == first.json()
    outside = dict(body, latitude=25.035372, longitude=121.524643)
    assert c.post('/api/v1/proposals', json=outside, headers=headers(p)).status_code == 422
    for _ in range(2): assert c.post('/api/v1/proposals', json=body, headers=headers(p)).status_code == 201
    assert c.post('/api/v1/proposals', json=body, headers=headers(p)).json()['detail']['code'] == 'MONTHLY_QUOTA_EXCEEDED'
    assert c.get('/api/v1/me/proposal-quota', headers=headers(p)).json()['remaining'] == 0
    assert c.get('/api/v1/bins?bin_type=existing').json().__len__() == 47


@pytest.mark.parametrize('support,expected', [(36, 'evaluation'), (35, 'village')])
def test_voting_threshold_and_locked_result(product, support, expected):
    p = product; c = p['client']; db = p['db']
    result = c.post('/api/v1/proposals', json=proposal_body(), headers=headers(p)); assert result.status_code == 201, result.text
    id_ = result.json()['proposal']['id']
    # Real rows for independent voters, not arbitrary aggregate counters.
    for n in range(58):
        user = User(account='voter-'+str(n), display_name='voter', password_hash='disabled', roles=['citizen'], districts=[])
        db.add(user); db.flush()
        db.add(Vote(proposal_id=id_, user_id=user.id, vote='support' if n < support-1 else 'oppose'))
    db.flush()
    response = c.post(f'/api/v1/proposals/{id_}/vote', json=dict(vote='oppose'), headers=headers(p, 'other'))
    assert response.status_code == 200, response.text
    data = response.json(); assert data['total_votes'] == 60 and data['status'] == expected
    assert c.post(f'/api/v1/proposals/{id_}/vote', json=dict(vote=None), headers=headers(p)).status_code == 409


def test_adoption_snapshot_end_and_removed_bin(product):
    p = product; c = p['client']; db = p['db']
    body = dict(bin_id=p['bin']['id'], role='店家', display_name='認養店家', intro='介紹', preferences=dict(full=True, dirty=True, dumping=False))
    result = c.post('/api/v1/adoptions', json=body, headers=headers(p)); assert result.status_code == 201, result.text
    id_ = result.json()['id']
    # Pending does not reserve the bin against a different citizen.
    assert c.post('/api/v1/adoptions', json=body, headers=headers(p, 'other')).status_code == 201
    approved = c.post(f'/api/v1/admin/adoptions/{id_}/review', json=dict(decision='active'), headers=headers(p, 'admin', etag='"v1"'))
    assert approved.status_code == 200, approved.text
    report = create_report(p)
    assert report['adopter'] and report['pending_points'] == 2
    ended = c.post(f'/api/v1/adoptions/{id_}/end', json=dict(reason='結束'), headers=headers(p, etag='"v2"'))
    assert ended.status_code == 200
    arrive(p, report['work_order_id']); verified = verify(p, report)
    assert verified.json()['report']['awarded_points'] == 2
    view = c.get(f"/api/v1/bins/{p['bin']['id']}/view", headers=headers(p)).json()
    assert view['adopter'] is None
    lifecycle = c.get(f"/api/v1/bins/{p['bin']['id']}/lifecycle", headers=headers(p, 'admin'))
    removed = c.post(f"/api/v1/admin/bins/{p['bin']['id']}/lifecycle", json=dict(action='remove', reason='示範撤除'), headers=headers(p, 'admin', etag=lifecycle.headers['ETag']))
    assert removed.status_code == 200, removed.text
    assert not c.get(f"/api/v1/bins/{p['bin']['id']}/view").json()['status']['is_usable']
    assert db.get(Report, report['id']).adopter


def test_redemption_atomic_balance_stock_and_idempotency(product):
    p = product; c = p['client']; db = p['db']; seed(db, grant_points=63)
    reward = db.scalar(select(Reward).where(Reward.code == 'seven')); reward.stock = 1; db.flush()
    key = uuid4(); body = dict(reward_id=str(reward.id))
    result = c.post('/api/v1/redemptions', json=body, headers=headers(p, key=key)); assert result.status_code == 201, result.text
    assert result.json()['membership']['available_points'] == 33
    assert result.json()['membership']['cumulative_points'] == 63
    assert c.post('/api/v1/redemptions', json=body, headers=headers(p, key=key)).json() == result.json()
    assert c.post('/api/v1/redemptions', json=body, headers=headers(p)).json()['detail']['code'] == 'OUT_OF_STOCK'
    assert db.scalar(select(func.count()).select_from(Redemption)) == 1
    assert db.scalar(select(func.count()).select_from(PointEntry).where(PointEntry.type == 'redemption')) == 1


def test_other_district_report_unassigned_and_validation(product):
    p = product; c = p['client']
    other = c.get('/api/v1/bins?district=中正區&bin_type=existing').json()[0]
    report = create_report(p, bin_=other)
    assert report['assignment_status'] == 'unassigned' and report['work_order_id'] is None
    assert c.get('/api/v1/staff/work-orders', headers=headers(p, 'staff')).json()['page']['total'] == 0
    body = report_body(p); body['first_reporter'] = True
    assert c.post('/api/v1/reports', json=body, headers=headers(p)).status_code == 422
    assert c.get('/api/v1/map/locations?latitude=NaN&longitude=121').status_code == 422
    assert c.get('/api/v1/map/nearest-usable?latitude=25').status_code == 422
    assert c.get('/api/v1/staff/statistics?month=not-a-month', headers=headers(p, 'staff')).status_code == 422


def test_openapi_documents_all_product_contracts(product):
    import json
    from pathlib import Path
    spec = product['client'].get('/openapi.json').json()
    assert spec == json.loads(Path('docs/openapi.json').read_text())
    for path in ['/api/v1/reports', '/api/v1/proposals', '/api/v1/adoptions', '/api/v1/media', '/api/v1/staff/route-stops']:
        assert path in spec['paths']
    assert spec['paths']['/api/v1/staff/work-orders/{id}/accept']['post']['requestBody']
    params = spec['paths']['/api/v1/staff/work-orders/{id}/accept']['post']['parameters']
    assert {'Idempotency-Key','If-Match'} <= {p['name'] for p in params}
    error=spec['paths']['/api/v1/reports']['post']['responses']['422']['content']['application/json']['schema']
    assert error['$ref'].endswith('/ApiError')
    invalid=product['client'].post('/api/v1/auth/demo/login',json={})
    assert invalid.status_code==422 and invalid.json()['detail']['code']=='VALIDATION_ERROR'
    for method in ['get', 'post']:
        assert spec['paths']['/api/v1/bins'][method]['responses']


def test_proposal_review_install_and_name_history(product):
    p=product; c=p['client']; db=p['db']
    result=c.post('/api/v1/proposals',json=proposal_body(),headers=headers(p))
    assert result.status_code == 201
    id_=result.json()['proposal']['id']
    item=db.get(Proposal,id_); item.status='evaluation'; db.flush()
    for action in ['evaluation_approve','survey_approve']:
        current=c.get(f'/api/v1/proposals/{id_}',headers=headers(p))
        result=c.post(f'/api/v1/admin/proposals/{id_}/review',json=dict(action=action),headers=headers(p,'admin',etag=current.headers['ETag']))
        assert result.status_code == 200,result.text
    assert result.json()['status'] == 'installed'
    bin_=c.get('/api/v1/bins/'+result.json()['bin_id']).json()
    assert bin_['bin_type'] == 'proposed' and bin_['placement_status'] == 'installed'
    current=c.get(f'/api/v1/proposals/{id_}',headers=headers(p))
    result=c.post(f'/api/v1/proposals/{id_}/name-requests',json=dict(name='命名一號'),headers=headers(p,etag=current.headers['ETag']))
    assert result.status_code == 200,result.text
    result=c.post(f'/api/v1/admin/proposals/{id_}/name-review',json=dict(approve=True),headers=headers(p,'admin',etag=result.headers['ETag']))
    assert result.status_code == 200 and result.json()['approved_name'] == '命名一號'
    assert c.get('/api/v1/bins/'+bin_['id']).json()['name'] == '命名一號'
    result=c.post(f'/api/v1/proposals/{id_}/name-requests',json=dict(name='命名二號'),headers=headers(p,etag=result.headers['ETag']))
    result=c.post(f'/api/v1/admin/proposals/{id_}/name-review',json=dict(approve=False,reason='請調整'),headers=headers(p,'admin',etag=result.headers['ETag']))
    assert result.status_code == 200 and result.json()['approved_name'] == '命名一號'


def test_notifications_preferences_monthly_summary_and_maintenance(product):
    p=product; c=p['client']; db=p['db']
    body=dict(bin_id=p['bin']['id'],role='居民',display_name='認養者',preferences=dict(full=True,dirty=True,dumping=True))
    result=c.post('/api/v1/adoptions',json=body,headers=headers(p)); assert result.status_code == 201
    id_=result.json()['id']
    result=c.post(f'/api/v1/admin/adoptions/{id_}/review',json=dict(decision='active'),headers=headers(p,'admin',etag='"v1"'))
    result=c.patch(f'/api/v1/adoptions/{id_}/preferences',json=dict(full=False,dirty=True,dumping=True),headers=headers(p,etag=result.headers['ETag']))
    assert result.status_code == 200 and not result.json()['preferences']['full']
    report=create_report(p,'dirty')
    summary=c.get(f'/api/v1/adoptions/{id_}/monthly-summary',headers=headers(p)).json()
    assert summary['reports_submitted'] == 1 and summary['points_awarded'] == 0
    notices=c.get('/api/v1/me/notifications',headers=headers(p)).json()['items']
    assert any(n['type']=='adoption_alert' for n in notices)
    id_=notices[0]['id']
    result=c.post(f'/api/v1/me/notifications/{id_}/read',json={},headers=headers(p)); assert result.status_code == 200
    read_at=result.json()['read_at']
    result=c.post(f'/api/v1/me/notifications/{id_}/read',json={},headers=headers(p)); assert result.json()['read_at'] == read_at
    from scripts.product_maintenance import orphan_assets
    unreferenced=upload(p)
    asset=db.get(MediaAsset,unreferenced); asset.created_at=now()-timedelta(days=2); db.flush()
    assert unreferenced in {str(a.id) for a in orphan_assets(db,now()-timedelta(days=1))}
    assert db.get(Report,report['id']).photo_id not in {a.id for a in orphan_assets(db,now()+timedelta(days=1))}


def test_seed_work_orders_no_fake_citizen_rewards(product):
    p=product; db=p['db']
    seed(db,with_work_orders=True); seed(db,with_work_orders=True)
    assert db.scalar(select(func.count()).select_from(WorkOrder)) == 3
    assert db.scalar(select(func.count()).select_from(Report)) == 0
    assert db.scalar(select(func.count()).select_from(PointEntry)) == 0
    assert {w.source for w in db.scalars(select(WorkOrder))} == {'sensor','inspection'}


def test_map_batches_queries(product):
    p=product
    from sqlalchemy import event
    statements=[]
    connection=p['db'].connection()
    def count(conn,cursor,statement,parameters,context,executemany): statements.append(statement)
    event.listen(connection,'before_cursor_execute',count)
    try:
        result=p['client'].get('/api/v1/map/locations?district=all&kind=all&latitude=25.033&longitude=121.5358&limit=100')
        assert result.status_code == 200,result.text
        assert result.json()['page']['total'] == 811
        assert len(statements) <= 6
    finally: event.remove(connection,'before_cursor_execute',count)


def test_gcs_upload_and_signing_adapter_without_network(product,monkeypatch):
    p=product; c=p['client']; calls=[]
    settings=get_settings()
    monkeypatch.setattr(settings,'media_backend','gcs')
    monkeypatch.setattr(settings,'media_bucket','test-private-bucket')
    monkeypatch.setattr(settings,'media_signing_service_account','test@example.invalid')
    class Blob:
        def upload_from_string(self,data,**kwargs): calls.append((data,kwargs))
        def generate_signed_url(self,**kwargs):
            assert kwargs['service_account_email']=='test@example.invalid'
            assert kwargs['version']=='v4'
            return 'https://example.invalid/private-photo'
    class Bucket:
        def blob(self,key): assert key.startswith('binsoon-'); return Blob()
    class Client:
        def __init__(self,**kwargs): pass
        def bucket(self,name): assert name=='test-private-bucket'; return Bucket()
    class Credentials:
        token='mock-token'
        def refresh(self,request): pass
    import google.auth
    from google.cloud import storage
    monkeypatch.setattr(storage,'Client',Client)
    monkeypatch.setattr(google.auth,'default',lambda **kwargs:(Credentials(),'mock-project'))
    id_=upload(p)
    assert calls[0][1]['if_generation_match'] == 0
    result=c.get(f'/api/v1/media/{id_}/access',headers=headers(p))
    assert result.status_code == 200 and result.json()['url'].startswith('https://example.invalid/')


def test_rate_limit_and_cors_contract(product,monkeypatch):
    p=product; db=p['db']
    from app.modules.models import LoginAttempt
    import hashlib
    key=hashlib.sha256(b'account:demo-citizen').hexdigest()
    db.add(LoginAttempt(key=key,started_at=now(),attempts=20)); db.flush()
    result=p['client'].post('/api/v1/auth/demo/login',json=dict(account='demo-citizen',password=p['password']))
    assert result.status_code == 429 and result.headers['Retry-After'] == '300'
    monkeypatch.setattr(get_settings(),'cors_origins',['http://127.0.0.1:5173'])
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.modules.application import install
    app=FastAPI(); install(app)
    with TestClient(app) as client:
        result=client.options('/api/v1/reports',headers={'Origin':'http://127.0.0.1:5173','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Authorization,Idempotency-Key,If-Match'})
        assert result.status_code == 200
        assert result.headers['Access-Control-Allow-Origin']=='http://127.0.0.1:5173'
        result=client.options('/api/v1/reports',headers={'Origin':'https://untrusted.invalid','Access-Control-Request-Method':'POST'})
        assert result.status_code == 400


def test_simulation_reset_is_not_work_evidence_or_economy_reset(product):
    p=product; c=p['client']; db=p['db']
    from app.services import simulation
    report=create_report(p); work=report['work_order_id']
    arrive(p,work); assert verify(p,report).status_code == 200
    assert evidence(p,work).status_code == 200
    assert command(p,work,'finish').json()['status'] == 'waiting_sensor'
    simulation.reset(db); db.flush()
    detail=c.get(f'/api/v1/staff/work-orders/{work}',headers=headers(p,'staff')).json()
    assert detail['work_order']['status'] == 'waiting_sensor'
    assert detail['latest_reading'] is None
    assert c.get('/api/v1/me/membership',headers=headers(p)).json()['available_points'] == 1
    assert db.scalar(select(func.count()).select_from(PointEntry)) == 1
    assert db.get(Report,report['id']).awarded_points == 1


def test_bare_collection_cannot_complete_work_and_scoped_replay(product):
    p=product; c=p['client']; db=p['db']
    from app.services import simulation
    report=create_report(p); work=report['work_order_id']
    arrive(p,work); verify(p,report); evidence(p,work)
    assert command(p,work,'finish').json()['status']=='waiting_sensor'
    simulation.collect(db,report['bin_id']); db.flush()
    assert db.get(WorkOrder,work).clear_reading_id is None
    assert db.get(WorkOrder,work).status=='waiting_sensor'
    # Replaying an old work command still checks the current responsibility scope.
    other=create_report(p,'dirty')
    key=uuid4(); first=command(p,other['work_order_id'],'accept',key=key)
    assert first.status_code==200
    p['users']['staff'].districts=['中正區']; db.flush()
    result=c.post(f"/api/v1/staff/work-orders/{other['work_order_id']}/accept",json={},headers=headers(p,'staff',key=key,etag='"v1"'))
    assert result.status_code==404


def test_full_adoption_alert_only_on_threshold_crossing(product):
    p=product; c=p['client']; db=p['db']
    from app.services import simulation
    body=dict(bin_id=p['bin']['id'],role='居民',display_name='認養者',preferences=dict(full=True,dirty=False,dumping=False))
    item=c.post('/api/v1/adoptions',json=body,headers=headers(p)).json()
    approved=c.post(f"/api/v1/admin/adoptions/{item['id']}/review",json=dict(decision='active'),headers=headers(p,'admin',etag='"v1"'))
    assert approved.status_code==200
    create_report(p)
    alerts=lambda:db.scalar(select(func.count()).select_from(Notification).where(Notification.type=='adoption_alert'))
    assert alerts()==0
    state=db.get(BinState,(p['bin']['id'],'general')); state.fill_level_pct=81
    clock=simulation.get_clock(db)
    simulation.record(db,state,'measurement',clock); db.flush()
    assert alerts()==1
    simulation.record(db,state,'measurement',clock); db.flush()
    assert alerts()==1
    assert c.get('/api/v1/map/locations').status_code==200
    assert alerts()==1


def test_vote_change_withdraw_and_same_vote_noop(product):
    p=product; c=p['client']
    item=c.post('/api/v1/proposals',json=proposal_body(),headers=headers(p)).json()['proposal']
    path=f"/api/v1/proposals/{item['id']}/vote"
    same=c.post(path,json=dict(vote='support'),headers=headers(p)).json()
    assert same['version']==item['version'] and same['total_votes']==1
    opposed=c.post(path,json=dict(vote='oppose'),headers=headers(p)).json()
    assert opposed['support']==0 and opposed['oppose']==1 and opposed['total_votes']==1
    withdrawn=c.post(path,json=dict(vote=None),headers=headers(p)).json()
    assert withdrawn['total_votes']==0 and withdrawn['support_ratio'] is None
    again=c.post(path,json=dict(vote=None),headers=headers(p)).json()
    assert again['version']==withdrawn['version']
    assert c.get('/api/v1/me/votes',headers=headers(p)).json()['page']['total']==0


def test_explicit_demo_vote_profiles_preserve_real_votes_and_rewards(product):
    p=product; db=p['db']; c=p['client']
    from uuid import UUID
    from scripts.seed_product_votes import seed_votes
    for profile,support in [('evaluation',36),('village',35)]:
        item=c.post('/api/v1/proposals',json=proposal_body(),headers=headers(p)).json()['proposal']
        result=seed_votes(db,UUID(item['id']),profile)
        assert result['status']==profile and result['total_votes']==60 and result['support']==support
        repeated=seed_votes(db,UUID(item['id']),profile)
        assert repeated['version']==result['version']
    assert db.scalar(select(func.count()).select_from(User).where(User.account.like('fixture-%'),User.enabled.is_(False)))==118
    assert db.scalar(select(func.count()).select_from(PointEntry))==0
