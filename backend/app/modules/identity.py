import hashlib
import hmac
import secrets
from datetime import timedelta
from typing import Annotated
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from app.config import get_settings
from app.security import bearer
from app.modules.common import DB, fail, now
from app.modules.models import AuthSession, User


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    value = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1).hex()
    return f"scrypt${salt}${value}"


def password_matches(password, stored):
    try:
        _, salt, _ = stored.split("$")
        return hmac.compare_digest(password_hash(password, salt), stored)
    except ValueError:
        return False


def user_view(user):
    return dict(id=user.id, display_name=user.display_name, roles=user.roles, districts=user.districts, auth_source="demo")


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def optional_user(db: DB, request: Request, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    if credentials is None:
        return None
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash(credentials.credentials)))
    if session is None or session.revoked:
        fail(401, "UNAUTHENTICATED")
    if session.expires_at <= now():
        fail(401, "SESSION_EXPIRED")
    user = db.get(User, session.user_id, populate_existing=True)
    if not user or not user.enabled:
        fail(401, "UNAUTHENTICATED")
    request.state.auth_session_id = session.id
    return user


OptionalUser = Annotated[User | None, Depends(optional_user)]


def require_user(user: OptionalUser):
    if user is None:
        fail(401, "UNAUTHENTICATED")
    return user


CurrentUser = Annotated[User, Depends(require_user)]


def user_or_maintenance_admin(db: DB, request: Request, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    configured = get_settings().admin_token
    if credentials and configured and hmac.compare_digest(credentials.credentials.encode(), configured.get_secret_value().encode()):
        return None
    return require_user(optional_user(db, request, credentials))


UserOrAdmin = Annotated[User | None, Depends(user_or_maintenance_admin)]


def role(name):
    def dependency(user: CurrentUser):
        if name not in user.roles:
            fail(403, "FORBIDDEN")
        return user
    return dependency


Citizen = Annotated[User, Depends(role("citizen"))]
Staff = Annotated[User, Depends(role("staff"))]


def require_product_admin(db: DB, request: Request, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    configured = get_settings().admin_token
    if credentials and configured and hmac.compare_digest(credentials.credentials.encode(), configured.get_secret_value().encode()):
        return None
    user = optional_user(db, request, credentials)
    if user is None:
        fail(401, "UNAUTHENTICATED")
    if "admin" not in user.roles:
        fail(403, "FORBIDDEN")
    return user


Admin = Annotated[User | None, Depends(require_product_admin)]


def new_session(db, user):
    token = secrets.token_urlsafe(48)
    expires = now() + timedelta(minutes=60)
    db.add(AuthSession(user_id=user.id, token_hash=token_hash(token), expires_at=expires, revoked=False))
    return dict(access_token=token, token_type="bearer", expires_at=expires, user=user_view(user))
