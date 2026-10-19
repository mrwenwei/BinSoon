"""Explicit, repeatable demo accounts/catalog. Never run during cold start/import."""
import argparse
from uuid import NAMESPACE_URL, uuid5
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import get_settings
from app.database import get_engine
from app.modules.common import product_lock
from app.modules.identity import password_hash
from app.modules.models import Incident, PointEntry, Reward, User, WorkOrder

CATALOG = [
    ("seven", "7-11 50 元兌換券", "coupon", 30, 380),
    ("family", "全家 50 元兌換券", "coupon", 50, 412),
    ("flight", "日本來回機票", "grand", 1000, 3),
    ("phone", "iPhone Duo", "grand", 3000, 1),
]


def seed(db, settings=None, grant_points=0, with_work_orders=False):
    settings = settings or get_settings()
    if not settings.demo_auth_enabled: raise ValueError("Enable DEMO_AUTH_ENABLED only in an isolated demo environment")
    credentials = [(role, getattr(settings, f"demo_{role}_password")) for role in ("citizen", "staff", "admin")]
    if any(secret is None or len(secret.get_secret_value()) < 12 for _, secret in credentials):
        raise ValueError("Set all DEMO_*_PASSWORD secrets (at least 12 characters)")
    if not 0 <= grant_points <= 10000: raise ValueError("grant_points must be 0..10000")
    product_lock(db)
    for role, secret in credentials:
        account = f"demo-{role}"
        user = db.scalar(select(User).where(User.account == account))
        if user is None:
            user = User(id=uuid5(NAMESPACE_URL, f"binsoon:demo:user:{role}"), account=account,
                display_name={"citizen":"示範市民", "staff":"大安區示範隊員", "admin":"示範管理員"}[role],
                password_hash=password_hash(secret.get_secret_value()), roles=[role], districts=["大安區"] if role == "staff" else [])
            db.add(user)
            db.flush()
        elif user.roles != [role]:
            raise ValueError("Existing demo account role conflict; will not overwrite")
        if role == "citizen" and grant_points:
            entry_id = uuid5(NAMESPACE_URL, "binsoon:demo:initial-grant")
            old = db.get(PointEntry, entry_id)
            if old and old.amount != grant_points: raise ValueError("Grant already exists with a different amount")
            if not old:
                user.available_points += grant_points
                user.cumulative_points += grant_points
                db.add(PointEntry(id=entry_id, user_id=user.id, type="demo_grant", amount=grant_points, balance_after=user.available_points, source_type="demo"))
    for code, name, category, cost, stock in CATALOG:
        if db.scalar(select(Reward.id).where(Reward.code == code)) is None:
            db.add(Reward(id=uuid5(NAMESPACE_URL, f"binsoon:demo:reward:{code}"), code=code, name=name, category=category, cost=cost, stock=stock))
    db.flush()
    if with_work_orders:
        seed_work_orders(db)
    return dict(accounts=["demo-citizen", "demo-staff", "demo-admin"], catalog_codes=[r[0] for r in CATALOG], grant_points=grant_points)


def seed_work_orders(db):
    from app.models import Bin, BinState
    from app.services import simulation
    from app.modules.common import now
    simulation.lock(db)
    clock = simulation.initialize(db)
    staff = db.scalar(select(User).where(User.account == 'demo-staff'))
    bins = db.scalars(select(Bin).where(Bin.bin_type == 'existing', Bin.district == '大安區', Bin.operational_status == 'normal').order_by(Bin.id).limit(3)).all()
    for bin_, (problem, source) in zip(bins, [('full','sensor'),('dirty','inspection'),('broken','inspection')]):
        event_id = uuid5(NAMESPACE_URL, f'binsoon:demo:work:{bin_.id}:{problem}')
        if db.get(Incident,event_id) or db.scalar(select(Incident.id).where(Incident.bin_id == bin_.id,Incident.type == problem,Incident.status == 'open')):
            continue
        event=Incident(id=event_id,bin_id=bin_.id,type=problem,status='open')
        db.add(event); db.flush()
        task=WorkOrder(event_id=event.id,bin_id=bin_.id,type=problem,district=bin_.district,source=source,is_fixture=True)
        if problem == 'broken':
            task.status, task.assigned_staff_id, task.accepted_at, task.arrived_at, task.reason = 'repair',staff.id,now(),now(),'明示示範：待修繕'
        db.add(task)
        if problem == 'full':
            state=db.get(BinState,bin_.id)
            if state and state.source_type == 'simulated':
                state.fill_level_pct=94
                simulation.record(db,state,'measurement',clock)
    db.flush()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--grant-points", type=int, default=0)
    parser.add_argument("--with-work-orders", action="store_true", help="Explicit fictional sensor/inspection/repair cases; no citizen rewards")
    args = parser.parse_args()
    with Session(get_engine()) as db, db.begin():
        print(seed(db, grant_points=args.grant_points, with_work_orders=args.with_work_orders))


if __name__ == "__main__": main()
