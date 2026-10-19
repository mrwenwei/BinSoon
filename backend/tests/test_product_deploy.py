"""Validate deploy argument construction with a fake gcloud; no cloud operations."""
import json
import os
from pathlib import Path
import subprocess


def test_deploy_keeps_json_origins_and_secret_references(tmp_path):
    executable=tmp_path/'gcloud'
    log=tmp_path/'calls.jsonl'
    executable.write_text('''#!/usr/bin/env python3
import json,os,sys
with open(os.environ['FAKE_GCLOUD_LOG'],'a') as f: f.write(json.dumps(sys.argv[1:])+"\\n")
if sys.argv[1:4]==['artifacts','docker','images']: print('sha256:'+('0'*64))
''')
    executable.chmod(0o700)
    env=dict(os.environ,GCLOUD=str(executable),FAKE_GCLOUD_LOG=str(log),GCP_PROJECT_ID='test-project',
        CLOUD_SQL_CONNECTION_NAME='test-project:asia-east1:test-db',POSTGRES_USER='test-user',POSTGRES_DB='test-db',
        DB_PASSWORD_SECRET='db-secret',IMAGE_TAG='test-build',DEMO_AUTH_ENABLED='true',
        DEMO_CITIZEN_PASSWORD_SECRET='citizen-secret',DEMO_STAFF_PASSWORD_SECRET='staff-secret',DEMO_ADMIN_PASSWORD_SECRET='admin-secret',
        CORS_ORIGINS='["http://127.0.0.1:5173","https://frontend.example.invalid"]',MEDIA_BUCKET='test-media')
    env.pop('ADMIN_SECRET',None)
    env.pop('DEMO_ADMIN_SECRET',None)
    subprocess.run(['bash','deploy/cloudrun.sh'],env=env,check=True,capture_output=True,text=True)
    calls=[json.loads(line) for line in log.read_text().splitlines()]
    deploy=next(args for args in calls if args[:2]==['run','deploy'])
    values=next(a.split('=',1)[1] for a in deploy if a.startswith('--set-env-vars='))
    assert values.startswith('^~^')
    assert 'CORS_ORIGINS='+env['CORS_ORIGINS'] in values
    assert '~MEDIA_BACKEND=gcs~' in values
    secret=next(a for a in deploy if a.startswith('--set-secrets='))
    assert 'DEMO_CITIZEN_PASSWORD=citizen-secret:latest' in secret
    assert 'DEMO_ADMIN_PASSWORD=admin-secret:latest' in secret
    assert ',ADMIN_TOKEN=' not in secret
    assert all('seed_product_demo' not in ' '.join(args) for args in calls)
    # The historical alias still means the maintenance token, not a login password.
    env['DEMO_ADMIN_SECRET']='legacy-token-secret'
    subprocess.run(['bash','deploy/cloudrun.sh'],env=env,check=True,capture_output=True,text=True)
    calls=[json.loads(line) for line in log.read_text().splitlines()]
    deploy=[args for args in calls if args[:2]==['run','deploy']][-1]
    secret=next(a for a in deploy if a.startswith('--set-secrets='))
    assert ',ADMIN_TOKEN=legacy-token-secret:' in secret
    assert 'DEMO_ADMIN_PASSWORD=admin-secret:latest' in secret
