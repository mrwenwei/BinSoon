"""Unify official inventory and proposed bins, preserving IDs and readings.

Requires a coordinated application cutover: old code cannot run on this schema.
"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geography

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.scalar(sa.text("SELECT count(*) FROM trash_bins t JOIN candidate_locations c ON c.id=t.id")):
        raise RuntimeError("Bin UUID collision: resolve explicitly before migration")
    if bind.scalar(sa.text("SELECT count(*) FROM demo_scenarios")) > 1:
        raise RuntimeError("Multiple legacy clocks require an explicit merge plan")
    op.create_table("bins",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("district", sa.String(20), nullable=False),
        sa.Column("location", Geography("POINT", srid=4326, spatial_index=False), nullable=False),
        sa.Column("source_type", sa.String(100), nullable=False),
        sa.Column("source_row", sa.Integer()), sa.Column("source_file", sa.String(255)),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("bin_type", sa.String(20), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("address", sa.Text()), sa.Column("status", sa.String(40), nullable=False),
        sa.Column("location_precision", sa.String(100)),
        sa.Column("external_id", sa.String(40)), sa.Column("scenario_id", sa.String(60)),
        sa.Column("rank", sa.Integer()), sa.Column("demand_score", sa.Float()), sa.Column("reason", sa.Text()),
        sa.Column("placement_status", sa.String(30), nullable=False),
        sa.Column("feasibility_status", sa.String(30)), sa.Column("boundary_warning", sa.Text()),
        sa.UniqueConstraint("external_id"), sa.UniqueConstraint("source_type", "source_row"),
        sa.CheckConstraint("bin_type IN ('existing', 'proposed')"))
    for col in ("district", "bin_type"):
        op.create_index(f"ix_bins_{col}", "bins", [col])
    op.create_index("idx_bins_location", "bins", ["location"], postgresql_using="gist")
    op.execute("""INSERT INTO bins
        (id,district,location,source_type,source_row,source_file,note,created_at,updated_at,
         bin_type,name,address,status,location_precision,placement_status)
        SELECT id,district,location,source_type,source_row,source_file,note,created_at,updated_at,
         'existing',left(coalesce(nullif(address,''),'清潔箱 '||source_row),200),address,status,location_precision,'existing'
        FROM trash_bins""")
    op.execute("""INSERT INTO bins
        (id,district,location,source_type,source_row,source_file,note,created_at,updated_at,
         bin_type,name,status,external_id,scenario_id,rank,demand_score,reason,placement_status,feasibility_status,boundary_warning)
        SELECT id,district,location,source_type,source_row,source_file,note,created_at,updated_at,
         'proposed',name,status,external_id,scenario_id,rank,demand_score,reason,
         coalesce(placement_status,'proposed'),coalesce(feasibility_status,'pending_review'),boundary_warning
        FROM candidate_locations""")
    for table in ("simulation_states", "reading_history"):
        for fk in sa.inspect(bind).get_foreign_keys(table):
            op.drop_constraint(fk["name"], table, type_="foreignkey")
    for fk in sa.inspect(bind).get_foreign_keys("demo_advances"):
        op.drop_constraint(fk["name"], "demo_advances", type_="foreignkey")
    op.rename_table("demo_scenarios", "simulation_clocks")
    op.execute("UPDATE simulation_clocks SET id='city_bins', data_version='unified-v1'")
    op.rename_table("simulation_states", "bin_states")
    op.alter_column("bin_states", "candidate_id", new_column_name="bin_id")
    op.drop_index("ix_simulation_states_scenario_id", table_name="bin_states")
    for col in ("scenario_id", "simulation_status", "random_seed"):
        op.drop_column("bin_states", col)
    op.create_foreign_key("fk_bin_states_bin", "bin_states", "bins", ["bin_id"], ["id"])
    op.rename_table("reading_history", "bin_readings")
    op.alter_column("bin_readings", "candidate_id", new_column_name="bin_id")
    op.add_column("bin_readings", sa.Column("generation", sa.Integer(), nullable=True))
    op.execute("UPDATE bin_readings SET generation=(SELECT generation FROM simulation_clocks LIMIT 1)")
    for old, new, col in (("ix_reading_history_candidate_id", "ix_bin_readings_bin_id", "bin_id"),
                          ("ix_reading_history_recorded_at", "ix_bin_readings_recorded_at", "recorded_at")):
        op.drop_index(old, table_name="bin_readings")
        op.create_index(new, "bin_readings", [col])
    op.create_foreign_key("fk_bin_readings_bin", "bin_readings", "bins", ["bin_id"], ["id"])
    op.rename_table("demo_advances", "simulation_advances")
    op.drop_column("simulation_advances", "scenario_id")
    # All legacy data has been copied, and all historical IDs/FKs now point to bins.
    op.drop_table("candidate_locations")
    op.drop_table("trash_bins")


def downgrade():
    raise RuntimeError("Unified bin histories cannot be represented by the old candidate-only schema; restore a backup or migrate forward")
