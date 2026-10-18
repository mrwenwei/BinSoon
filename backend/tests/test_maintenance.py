import pytest
from fastapi.testclient import TestClient
from app.maintenance import app


@pytest.mark.parametrize('method,path',[('GET','/health'),('POST','/api/v1/bins'),('POST','/api/v1/demo/advance'),('GET','/docs')])
def test_maintenance_rejects_requests_without_database_access(method,path):
    with TestClient(app) as client:
        response=client.request(method,path)
    assert response.status_code==503
    assert response.headers['Retry-After']=='60'
    assert response.headers['Cache-Control']=='no-store'
