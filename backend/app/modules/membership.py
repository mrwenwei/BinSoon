"""Economy writes share the product transaction and account serialization."""
from uuid import uuid4
from app.modules.common import fail, get
from app.modules import views
from app.modules.models import PointEntry, Redemption, Reward


def redeem(db, user, body):
    item = get(db, Reward, body.reward_id)
    if item.stock <= 0: fail(409, "OUT_OF_STOCK")
    if user.available_points < item.cost: fail(409, "INSUFFICIENT_POINTS")
    item.stock -= 1
    user.available_points -= item.cost
    redemption = Redemption(user_id=user.id, reward_id=item.id, cost=item.cost, voucher_code="DEMO-"+uuid4().hex.upper())
    db.add(redemption)
    db.flush()
    db.add(PointEntry(user_id=user.id, type="redemption", amount=-item.cost, balance_after=user.available_points, redemption_id=redemption.id))
    return dict(redemption=views.redemption(redemption), membership=views.membership(db, user), reward=views.reward(item))
