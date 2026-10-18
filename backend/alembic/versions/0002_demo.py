"""Add candidate recommendation metadata and isolated demo simulation tables."""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    for name, typ in [
        ("external_id", sa.String(40)), ("scenario_id", sa.String(60)),
        ("rank", sa.Integer()), ("demand_score", sa.Float()), ("reason", sa.Text()),
        ("placement_status", sa.String(30)), ("feasibility_status", sa.String(30)),
        ("boundary_warning", sa.Text()),
    ]:
        op.add_column("candidate_locations", sa.Column(name, typ, nullable=True))
    op.create_unique_constraint("uq_candidate_external_id", "candidate_locations", ["external_id"])
    op.create_table("demo_scenarios",
        sa.Column("id", sa.String(60), primary_key=True),
        sa.Column("simulated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("simulation_status", sa.String(20), nullable=False),
        sa.Column("random_seed", sa.Integer(), nullable=False),
        sa.Column("time_multiplier", sa.Float(), nullable=False),
        sa.Column("data_version", sa.String(40), nullable=False),
        sa.Column("generation", sa.Integer(), nullable=False))
    op.create_table("simulation_states",
        sa.Column("candidate_id", sa.Uuid(), sa.ForeignKey("candidate_locations.id"), primary_key=True),
        sa.Column("scenario_id", sa.String(60), sa.ForeignKey("demo_scenarios.id"), nullable=False),
        *[sa.Column(n, sa.Float(), nullable=False) for n in ("fill_level_pct", "capacity_liters", "fill_rate_pct_per_hour")],
        sa.Column("last_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_emptied_at", sa.DateTime(timezone=True)),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("simulation_status", sa.String(20), nullable=False),
        sa.Column("random_seed", sa.Integer(), nullable=False),
        sa.CheckConstraint("fill_level_pct >= 0 AND fill_level_pct <= 100"),
        sa.CheckConstraint("capacity_liters > 0 AND fill_rate_pct_per_hour >= 0"))
    op.create_index("ix_simulation_states_scenario_id", "simulation_states", ["scenario_id"])
    op.create_table("reading_history",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("candidate_id", sa.Uuid(), sa.ForeignKey("candidate_locations.id"), nullable=False),
        sa.Column("fill_level_pct", sa.Float(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.CheckConstraint("fill_level_pct >= 0 AND fill_level_pct <= 100"))
    for col in ("candidate_id", "recorded_at"):
        op.create_index(f"ix_reading_history_{col}", "reading_history", [col])
    op.create_table("demo_advances",
        sa.Column("request_id", sa.Uuid(), primary_key=True),
        sa.Column("scenario_id", sa.String(60), sa.ForeignKey("demo_scenarios.id"), nullable=False),
        sa.Column("generation", sa.Integer(), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("simulated_at", sa.DateTime(timezone=True), nullable=False))


def downgrade():
    for table in ("demo_advances", "reading_history", "simulation_states", "demo_scenarios"):
        op.drop_table(table)
    op.drop_constraint("uq_candidate_external_id", "candidate_locations", type_="unique")
    for name in ("external_id", "scenario_id", "rank", "demand_score", "reason", "placement_status", "feasibility_status", "boundary_warning"):
        op.drop_column("candidate_locations", name)
