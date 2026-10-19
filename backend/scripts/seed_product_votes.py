"""Opt-in fixed fictional voting scenarios for a new demo proposal, not a public API."""
import argparse
from uuid import NAMESPACE_URL, UUID, uuid5
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import get_settings
from app.database import get_engine
from app.modules.common import product_lock
from app.modules.models import Proposal, User, Vote
from app.modules.participation import vote
from app.modules.schemas import VoteCreate
from app.modules.views import proposal


def seed_votes(db, proposal_id, profile):
    if not get_settings().demo_auth_enabled: raise ValueError('Only available in an isolated demo environment')
    if profile not in {'evaluation','village'}: raise ValueError('Choose a fixed demonstration profile')
    product_lock(db)
    item=db.get(Proposal,proposal_id)
    if item is None: raise ValueError('Proposal not found')
    owner=db.get(User,item.user_id)
    supporters=35 if profile=='evaluation' else 34
    expected={uuid5(NAMESPACE_URL,f'binsoon:fixture-voter:{item.id}:{n}'):'support' if n<supporters else 'oppose' for n in range(59)}
    existing=db.scalars(select(Vote).where(Vote.proposal_id==item.id)).all()
    fixture={v.user_id:v.vote for v in existing if v.user_id in expected}
    if fixture==expected: return proposal(db,item,owner)
    if item.status!='collecting' or len(existing)!=1 or existing[0].user_id!=owner.id or existing[0].vote!='support':
        raise ValueError('Requires a fresh proposal with only its original support vote; will not overwrite votes')
    for id_,choice in expected.items():
        user=User(id=id_,account='fixture-'+id_.hex,display_name='虛構投票者（展示）',password_hash='disabled',
                  enabled=False,roles=['citizen'],districts=[])
        db.add(user); db.flush()
        vote(db,item.id,user,VoteCreate(vote=choice))
    return proposal(db,item,owner)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--proposal-id',type=UUID,required=True)
    parser.add_argument('--profile',choices=['evaluation','village'],required=True)
    args=parser.parse_args()
    with Session(get_engine()) as db,db.begin():
        result=seed_votes(db,args.proposal_id,args.profile)
        print(dict(id=str(result['id']),status=result['status'],support=result['support'],oppose=result['oppose'],is_demo=True))


if __name__=='__main__': main()
