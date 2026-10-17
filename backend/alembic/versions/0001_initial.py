"""Initial location tables and PostGIS."""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geography

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    for table, extra in [
        ("trash_bins", [sa.Column("address", sa.Text(), nullable=False), sa.Column("status", sa.String(30), nullable=False), sa.Column("location_precision", sa.String(100), nullable=False)]),
        ("hotspots", [sa.Column("name", sa.Text(), nullable=False), sa.Column("reported_count", sa.Integer(), nullable=False), sa.Column("location_precision", sa.String(100), nullable=False), sa.CheckConstraint("reported_count >= 0")]),
        ("candidate_locations", [sa.Column("name", sa.String(200), nullable=False), sa.Column("status", sa.String(40), nullable=False, server_default="needs_field_validation")]),
    ]:
        constraints = [] if table == "candidate_locations" else [sa.UniqueConstraint("source_type", "source_row")]
        op.create_table(table,
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("district", sa.String(20), nullable=False),
            sa.Column("location", Geography("POINT", srid=4326, spatial_index=False), nullable=False),
            sa.Column("source_type", sa.String(100), nullable=False),
            sa.Column("source_row", sa.Integer()), sa.Column("source_file", sa.String(255)),
            sa.Column("note", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            *extra, *constraints)
        op.create_index(f"ix_{table}_district", table, ["district"])
        op.create_index(f"idx_{table}_location", table, ["location"], postgresql_using="gist")


def downgrade():
    for table in ("candidate_locations", "hotspots", "trash_bins"):
        op.drop_table(table)
