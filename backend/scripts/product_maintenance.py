"""Dry-run by default: expire operational records and remove unreferenced photos."""
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from app.config import get_settings
from app.database import get_engine
from app.modules.common import now, product_lock
from app.modules.models import AuthSession, Evidence, Idempotency, LoginAttempt, MediaAsset, Report


def orphan_assets(db, before):
    return db.scalars(select(MediaAsset).where(MediaAsset.created_at < before,
        ~select(Report.id).where(Report.photo_id == MediaAsset.id).exists(),
        ~select(Evidence.id).where(Evidence.media_id == MediaAsset.id).exists())).all()


def maintain(db, apply=False):
    product_lock(db)
    cutoff = now()-timedelta(hours=24)
    settings = get_settings()
    assets = orphan_assets(db, cutoff)
    known = set(db.scalars(select(MediaAsset.storage_key)))
    orphan_keys = {a.storage_key for a in assets}
    if settings.media_backend == 'gcs':
        if not settings.media_bucket: raise ValueError('MEDIA_BUCKET required')
        from google.cloud import storage
        bucket = storage.Client().bucket(settings.media_bucket)
        orphan_keys.update(blob.name for blob in bucket.list_blobs(prefix='binsoon-', timeout=30)
                           if blob.name not in known and blob.updated and blob.updated < cutoff)
        if apply:
            for key in sorted(orphan_keys): bucket.blob(key).delete(timeout=30)
    else:
        directory = Path(settings.media_directory)
        orphan_keys.update(path.name for path in directory.glob('binsoon-*.jpg')
            if path.name not in known and datetime.fromtimestamp(path.stat().st_mtime,timezone.utc) < cutoff)
        if apply:
            for key in sorted(orphan_keys):
                if Path(key).name != key: raise ValueError('Invalid stored object key')
                (directory/key).unlink(missing_ok=True)
    if apply:
        for asset in assets: db.delete(asset)
        db.execute(delete(Idempotency).where(Idempotency.created_at < now()-timedelta(days=30)))
        db.execute(delete(LoginAttempt).where(LoginAttempt.started_at < cutoff))
        db.execute(delete(AuthSession).where(AuthSession.expires_at < now()-timedelta(days=7)))
    return dict(dry_run=not apply, orphan_photos=len(orphan_keys), expired_metadata_policy='30d idempotency / 7d sessions / 1d attempts')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    with Session(get_engine()) as db, db.begin(): print(maintain(db,args.apply))


if __name__ == '__main__': main()
