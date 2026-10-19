"""product identity workflows membership participation

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    # Additive upgrade: preserve 0003 UUIDs, source fields and monitoring history.
    op.create_table('idempotency_records',
    sa.Column('actor', sa.String(length=64), nullable=False),
    sa.Column('key', sa.Uuid(), nullable=False),
    sa.Column('path', sa.String(length=255), nullable=False),
    sa.Column('body_hash', sa.String(length=64), nullable=False),
    sa.Column('response', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('status_code', sa.Integer(), nullable=False),
    sa.Column('etag', sa.String(length=30), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('actor', 'key', 'path')
    )
    op.create_table('login_attempts',
    sa.Column('key', sa.String(length=64), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('key')
    )
    op.create_table('rewards',
    sa.Column('code', sa.String(length=40), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('category', sa.String(length=20), nullable=False),
    sa.Column('cost', sa.Integer(), nullable=False),
    sa.Column('stock', sa.Integer(), nullable=False),
    sa.Column('is_demo', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('stock >= 0 AND cost > 0'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code')
    )
    op.create_table('users',
    sa.Column('account', sa.String(length=100), nullable=False),
    sa.Column('password_hash', sa.Text(), nullable=False),
    sa.Column('display_name', sa.String(length=100), nullable=False),
    sa.Column('roles', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('districts', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('enabled', sa.Boolean(), nullable=False),
    sa.Column('available_points', sa.Integer(), nullable=False),
    sa.Column('cumulative_points', sa.Integer(), nullable=False),
    sa.Column('rejected_count', sa.Integer(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('available_points >= 0 AND cumulative_points >= 0 AND rejected_count >= 0'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('account')
    )
    op.create_table('adoptions',
    sa.Column('bin_id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('display_name', sa.String(length=50), nullable=False),
    sa.Column('intro', sa.String(length=120), nullable=False),
    sa.Column('preferences', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('reason', sa.String(length=500), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.ForeignKeyConstraint(['bin_id'], ['bins.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_adoptions_bin_id'), 'adoptions', ['bin_id'], unique=False)
    op.create_index(op.f('ix_adoptions_user_id'), 'adoptions', ['user_id'], unique=False)
    op.create_index('uq_adoption_active', 'adoptions', ['bin_id'], unique=True, postgresql_where=sa.text("status = 'active'"))
    op.create_index('uq_adoption_pending_user', 'adoptions', ['bin_id', 'user_id'], unique=True, postgresql_where=sa.text("status IN ('pending','active')"))
    op.create_table('auth_sessions',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index(op.f('ix_auth_sessions_user_id'), 'auth_sessions', ['user_id'], unique=False)
    op.create_table('incidents',
    sa.Column('bin_id', sa.Uuid(), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('first_report_id', sa.Uuid(), nullable=True),
    sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['bin_id'], ['bins.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_incidents_bin_id'), 'incidents', ['bin_id'], unique=False)
    op.create_index('uq_incident_open', 'incidents', ['bin_id', 'type'], unique=True, postgresql_where=sa.text("status = 'open'"))
    op.create_table('media_assets',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('purpose', sa.String(length=20), nullable=False),
    sa.Column('content_type', sa.String(length=40), nullable=False),
    sa.Column('size_bytes', sa.Integer(), nullable=False),
    sa.Column('storage_key', sa.String(length=150), nullable=False),
    sa.Column('sha256', sa.String(length=64), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('storage_key')
    )
    op.create_index(op.f('ix_media_assets_user_id'), 'media_assets', ['user_id'], unique=False)
    op.create_table('notifications',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('type', sa.String(length=30), nullable=False),
    sa.Column('title', sa.String(length=100), nullable=False),
    sa.Column('message', sa.String(length=500), nullable=False),
    sa.Column('target_kind', sa.String(length=20), nullable=False),
    sa.Column('target_id', sa.Uuid(), nullable=False),
    sa.Column('dedup_key', sa.String(length=150), nullable=False),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'dedup_key')
    )
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)
    op.create_table('proposals',
    sa.Column('bin_id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('reason', sa.String(length=500), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('outcome_reason', sa.String(length=500), nullable=True),
    sa.Column('voting_closed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('pending_name', sa.String(length=30), nullable=True),
    sa.Column('approved_name', sa.String(length=30), nullable=True),
    sa.Column('name_status', sa.String(length=20), nullable=True),
    sa.Column('rule_version', sa.String(length=40), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.ForeignKeyConstraint(['bin_id'], ['bins.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('bin_id')
    )
    op.create_index(op.f('ix_proposals_user_id'), 'proposals', ['user_id'], unique=False)
    op.create_table('redemptions',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('reward_id', sa.Uuid(), nullable=False),
    sa.Column('cost', sa.Integer(), nullable=False),
    sa.Column('voucher_code', sa.String(length=80), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['reward_id'], ['rewards.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('voucher_code')
    )
    op.create_index(op.f('ix_redemptions_user_id'), 'redemptions', ['user_id'], unique=False)
    op.create_table('proposal_reviews',
    sa.Column('proposal_id', sa.Uuid(), nullable=False),
    sa.Column('actor', sa.String(length=64), nullable=False),
    sa.Column('action', sa.String(length=40), nullable=False),
    sa.Column('reason', sa.String(length=500), nullable=True),
    sa.Column('name', sa.String(length=30), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['proposal_id'], ['proposals.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('proposal_votes',
    sa.Column('proposal_id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('vote', sa.String(length=20), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("vote IS NULL OR vote IN ('support','oppose')"),
    sa.ForeignKeyConstraint(['proposal_id'], ['proposals.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('proposal_id', 'user_id')
    )
    op.create_index(op.f('ix_proposal_votes_proposal_id'), 'proposal_votes', ['proposal_id'], unique=False)
    op.create_table('reports',
    sa.Column('bin_id', sa.Uuid(), nullable=False),
    sa.Column('event_id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('description', sa.String(length=500), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('adopter', sa.Boolean(), nullable=False),
    sa.Column('first_reporter', sa.Boolean(), nullable=False),
    sa.Column('quick', sa.Boolean(), nullable=False),
    sa.Column('photo_id', sa.Uuid(), nullable=False),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('rejection_reason', sa.String(length=500), nullable=True),
    sa.Column('awarded_points', sa.Integer(), nullable=False),
    sa.Column('settled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('rule_version', sa.String(length=40), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['bin_id'], ['bins.id'], ),
    sa.ForeignKeyConstraint(['event_id'], ['incidents.id'], ),
    sa.ForeignKeyConstraint(['photo_id'], ['media_assets.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('event_id', 'user_id'),
    sa.UniqueConstraint('photo_id')
    )
    op.create_index(op.f('ix_reports_event_id'), 'reports', ['event_id'], unique=False)
    op.create_index(op.f('ix_reports_user_id'), 'reports', ['user_id'], unique=False)
    op.create_table('work_orders',
    sa.Column('event_id', sa.Uuid(), nullable=False),
    sa.Column('bin_id', sa.Uuid(), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('source', sa.String(length=20), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('district', sa.String(length=20), nullable=False),
    sa.Column('assigned_staff_id', sa.Uuid(), nullable=True),
    sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('arrived_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('photo_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('clear_reading_id', sa.Uuid(), nullable=True),
    sa.Column('reason', sa.String(length=500), nullable=True),
    sa.Column('confirmed_problem', sa.Boolean(), nullable=True),
    sa.Column('is_fixture', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.ForeignKeyConstraint(['assigned_staff_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['bin_id'], ['bins.id'], ),
    sa.ForeignKeyConstraint(['clear_reading_id'], ['bin_readings.id'], ),
    sa.ForeignKeyConstraint(['event_id'], ['incidents.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('clear_reading_id'),
    sa.UniqueConstraint('event_id')
    )
    op.create_index(op.f('ix_work_orders_bin_id'), 'work_orders', ['bin_id'], unique=False)
    op.create_index(op.f('ix_work_orders_status'), 'work_orders', ['status'], unique=False)
    op.create_table('completions',
    sa.Column('work_order_id', sa.Uuid(), nullable=False),
    sa.Column('bin_id', sa.Uuid(), nullable=False),
    sa.Column('staff_id', sa.Uuid(), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['bin_id'], ['bins.id'], ),
    sa.ForeignKeyConstraint(['staff_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('work_order_id')
    )
    op.create_index(op.f('ix_completions_bin_id'), 'completions', ['bin_id'], unique=False)
    op.create_table('point_entries',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('balance_after', sa.Integer(), nullable=False),
    sa.Column('report_id', sa.Uuid(), nullable=True),
    sa.Column('redemption_id', sa.Uuid(), nullable=True),
    sa.Column('source_type', sa.String(length=20), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('balance_after >= 0'),
    sa.ForeignKeyConstraint(['redemption_id'], ['redemptions.id'], ),
    sa.ForeignKeyConstraint(['report_id'], ['reports.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('redemption_id'),
    sa.UniqueConstraint('report_id')
    )
    op.create_index(op.f('ix_point_entries_user_id'), 'point_entries', ['user_id'], unique=False)
    op.create_table('work_order_actions',
    sa.Column('work_order_id', sa.Uuid(), nullable=False),
    sa.Column('actor', sa.String(length=64), nullable=False),
    sa.Column('action', sa.String(length=40), nullable=False),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('work_order_evidence',
    sa.Column('work_order_id', sa.Uuid(), nullable=False),
    sa.Column('media_id', sa.Uuid(), nullable=False),
    sa.Column('purpose', sa.String(length=20), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['media_id'], ['media_assets.id'], ),
    sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('media_id'),
    sa.UniqueConstraint('work_order_id', 'purpose')
    )
    op.create_table('completion_likes',
    sa.Column('completion_id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['completion_id'], ['completions.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('completion_id', 'user_id')
    )
    op.create_index(op.f('ix_completion_likes_completion_id'), 'completion_likes', ['completion_id'], unique=False)
    op.add_column('bin_readings', sa.Column('observed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('bin_readings', sa.Column('received_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('bin_readings', sa.Column('observation_sequence', sa.Integer(), server_default='0', nullable=False))
    op.add_column('bin_states', sa.Column('observed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('bin_states', sa.Column('received_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('bin_states', sa.Column('observation_sequence', sa.Integer(), server_default='0', nullable=False))
    op.add_column('bins', sa.Column('operational_status', sa.String(length=20), server_default='normal', nullable=False))
    op.add_column('bins', sa.Column('installed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('bins', sa.Column('removed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('bins', sa.Column('lifecycle_reason', sa.String(length=500), nullable=True))
    op.add_column('bins', sa.Column('version', sa.Integer(), server_default='1', nullable=False))
    # ### end Alembic commands ###


def downgrade():
    bind = op.get_bind()
    if any(bind.scalar(sa.text(f'SELECT EXISTS (SELECT 1 FROM {name})'))
           for name in ('users', 'incidents', 'proposals', 'rewards', 'idempotency_records')):
        raise RuntimeError('Refusing to discard product data; back up and plan an explicit rollback')
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('bins', 'version')
    op.drop_column('bins', 'lifecycle_reason')
    op.drop_column('bins', 'removed_at')
    op.drop_column('bins', 'installed_at')
    op.drop_column('bins', 'operational_status')
    op.drop_column('bin_states', 'observation_sequence')
    op.drop_column('bin_states', 'received_at')
    op.drop_column('bin_states', 'observed_at')
    op.drop_column('bin_readings', 'observation_sequence')
    op.drop_column('bin_readings', 'received_at')
    op.drop_column('bin_readings', 'observed_at')
    op.drop_index(op.f('ix_completion_likes_completion_id'), table_name='completion_likes')
    op.drop_table('completion_likes')
    op.drop_table('work_order_evidence')
    op.drop_table('work_order_actions')
    op.drop_index(op.f('ix_point_entries_user_id'), table_name='point_entries')
    op.drop_table('point_entries')
    op.drop_index(op.f('ix_completions_bin_id'), table_name='completions')
    op.drop_table('completions')
    op.drop_index(op.f('ix_work_orders_status'), table_name='work_orders')
    op.drop_index(op.f('ix_work_orders_bin_id'), table_name='work_orders')
    op.drop_table('work_orders')
    op.drop_index(op.f('ix_reports_user_id'), table_name='reports')
    op.drop_index(op.f('ix_reports_event_id'), table_name='reports')
    op.drop_table('reports')
    op.drop_index(op.f('ix_proposal_votes_proposal_id'), table_name='proposal_votes')
    op.drop_table('proposal_votes')
    op.drop_table('proposal_reviews')
    op.drop_index(op.f('ix_redemptions_user_id'), table_name='redemptions')
    op.drop_table('redemptions')
    op.drop_index(op.f('ix_proposals_user_id'), table_name='proposals')
    op.drop_table('proposals')
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_table('notifications')
    op.drop_index(op.f('ix_media_assets_user_id'), table_name='media_assets')
    op.drop_table('media_assets')
    op.drop_index('uq_incident_open', table_name='incidents', postgresql_where=sa.text("status = 'open'"))
    op.drop_index(op.f('ix_incidents_bin_id'), table_name='incidents')
    op.drop_table('incidents')
    op.drop_index(op.f('ix_auth_sessions_user_id'), table_name='auth_sessions')
    op.drop_table('auth_sessions')
    op.drop_index('uq_adoption_pending_user', table_name='adoptions', postgresql_where=sa.text("status IN ('pending','active')"))
    op.drop_index('uq_adoption_active', table_name='adoptions', postgresql_where=sa.text("status = 'active'"))
    op.drop_index(op.f('ix_adoptions_user_id'), table_name='adoptions')
    op.drop_index(op.f('ix_adoptions_bin_id'), table_name='adoptions')
    op.drop_table('adoptions')
    op.drop_table('users')
    op.drop_table('rewards')
    op.drop_table('login_attempts')
    op.drop_table('idempotency_records')
    # ### end Alembic commands ###
