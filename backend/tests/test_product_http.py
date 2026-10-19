"""Exercise the shipped smoke CLI over real HTTP and an isolated PostGIS schema."""
import secrets
import socket
import threading
import time
from pathlib import Path
from pydantic import SecretStr
from sqlalchemy.orm import Session
import uvicorn
from app.config import get_settings
from app.database import get_session
from app.main import app
from scripts.import_data import import_data
from scripts.seed_product_demo import seed
from scripts.check_product_demo import main as smoke
from scripts.check_deployment import check as deployment_smoke
from test_migration import revision


def test_real_http_demo_smoke(isolated_engine,monkeypatch,tmp_path,capsys):
    settings=get_settings()
    maintenance_token=secrets.token_urlsafe(30)
    monkeypatch.setattr(settings,'admin_token',SecretStr(maintenance_token))
    monkeypatch.setenv('ADMIN_TOKEN',maintenance_token)
    monkeypatch.setattr(settings,'demo_auth_enabled',True)
    monkeypatch.setattr(settings,'media_backend','local')
    monkeypatch.setattr(settings,'media_directory',str(tmp_path))
    for role in ['citizen','staff','admin']:
        password=secrets.token_urlsafe(20)
        monkeypatch.setattr(settings,f'demo_{role}_password',SecretStr(password))
        monkeypatch.setenv(f'DEMO_{role.upper()}_PASSWORD',password)
    with isolated_engine.begin() as connection:
        for name in ['0001_initial.py','0002_demo.py','0003_unified_bins.py','0004_product.py','0005_product_integrity.py','0006_waste_streams.py']:
            revision(connection,name)
    with Session(isolated_engine) as db,db.begin():
        import_data(Path('data'),db)
        seed(db)
    def session():
        with Session(isolated_engine) as db: yield db
    previous=dict(app.dependency_overrides)
    app.dependency_overrides[get_session]=session
    sock=socket.socket(); sock.bind(('127.0.0.1',0))
    port=sock.getsockname()[1]
    server=uvicorn.Server(uvicorn.Config(app,access_log=False,log_level='critical',lifespan='off'))
    thread=threading.Thread(target=lambda:server.run(sockets=[sock]),daemon=True)
    thread.start()
    try:
        for _ in range(100):
            if server.started: break
            time.sleep(.05)
        assert server.started
        deployment_smoke(f'http://127.0.0.1:{port}')
        deployment_smoke(f'http://127.0.0.1:{port}',create_bin=True)
        monkeypatch.setattr('sys.argv',['check_product_demo',f'http://127.0.0.1:{port}'])
        smoke()
        monkeypatch.setattr('sys.argv',['check_product_demo',f'http://127.0.0.1:{port}','--write-demo'])
        smoke()
        output=capsys.readouterr().out
        assert 'read-only' in output and 'report -> review/settlement' in output
    finally:
        server.should_exit=True
        thread.join(timeout=5)
        sock.close()
        app.dependency_overrides.clear(); app.dependency_overrides.update(previous)
