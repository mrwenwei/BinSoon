"""Independent general/recycling states without duplicating old history.

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("bin_states", sa.Column("waste_type", sa.String(20), nullable=False, server_default="general"))
    op.add_column("bin_states", sa.Column("classification_source", sa.String(40), nullable=False, server_default="demo_assumption"))
    op.execute("UPDATE bin_states SET classification_source='legacy_assumed_general'")
    old_pk = sa.inspect(op.get_bind()).get_pk_constraint("bin_states")["name"]
    op.drop_constraint(old_pk, "bin_states", type_="primary")
    op.create_primary_key("bin_states_pkey", "bin_states", ["bin_id", "waste_type"])
    op.create_check_constraint("ck_bin_state_waste_type", "bin_states", "waste_type IN ('general','recycling')")
    op.add_column("bin_readings", sa.Column("waste_type", sa.String(20), nullable=True))
    op.add_column("bin_readings", sa.Column("classification_source", sa.String(40), nullable=False, server_default="legacy_unclassified"))
    op.create_check_constraint("ck_bin_reading_waste_type", "bin_readings", "waste_type IS NULL OR waste_type IN ('general','recycling')")
    op.drop_index("ix_bin_readings_observation", table_name="bin_readings")
    op.create_index("ix_bin_readings_observation", "bin_readings", ["bin_id", "waste_type", "observation_sequence"])
    for table, label in (("incidents", "incident"), ("reports", "report"), ("work_orders", "work_order"), ("completions", "completion")):
        op.add_column(table, sa.Column("waste_type", sa.String(20), nullable=False, server_default="general"))
        op.add_column(table, sa.Column("classification_source", sa.String(40), nullable=False, server_default="demo_assumption"))
        op.execute(sa.text(f"UPDATE {table} SET classification_source='legacy_assumed_general'"))
        op.create_check_constraint(f"ck_{label}_waste_type", table, "waste_type IN ('general','recycling')")
    op.drop_index("uq_incident_open", table_name="incidents")
    op.create_index("uq_incident_open", "incidents", ["bin_id", "type", "waste_type"], unique=True, postgresql_where=sa.text("status = 'open'"))
    op.add_column("notifications", sa.Column("waste_type", sa.String(20), nullable=True))
    # New streams are initialized by initialize_db/import_data in the same
    # deployment entrypoint, using configured capacities/rates and current clock.
    # No past measurements are copied or relabeled. Existing UUIDs stay intact.


def downgrade():
    raise RuntimeError("0006 preserves independent waste histories; restore a coordinated backup instead of discarding a stream")
