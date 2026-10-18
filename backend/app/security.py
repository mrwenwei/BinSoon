import secrets
from typing import Annotated
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.config import get_settings

bearer = HTTPBearer(auto_error=False)


def require_admin(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    token = get_settings().admin_token
    if token is None or not token.get_secret_value():
        raise HTTPException(503, "Writes disabled: configure ADMIN_TOKEN")
    if credentials is None or not secrets.compare_digest(credentials.credentials.encode(), token.get_secret_value().encode()):
        raise HTTPException(401, "Admin authorization required", headers={"WWW-Authenticate": "Bearer"})
