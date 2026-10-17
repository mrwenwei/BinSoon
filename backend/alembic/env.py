from alembic import context
from app.database import Base, get_engine
from app import models  # noqa: F401

def include_object(obj, name, type_, reflected, compare_to):
    # PostGIS images also install extension-owned Tiger/geocoder tables.
    # Only application tables belong to this migration history.
    return not (type_ == "table" and reflected and name not in Base.metadata.tables)


if context.is_offline_mode():
    from app.config import get_settings
    context.configure(url=get_settings().database_url, target_metadata=Base.metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    with get_engine().connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata, include_object=include_object)
        with context.begin_transaction():
            context.run_migrations()
