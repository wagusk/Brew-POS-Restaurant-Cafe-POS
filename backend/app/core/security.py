"""JWT + PIN auth. PIN-based = fast for terminals & waiters."""
from datetime import datetime, timedelta
from typing import Annotated
import warnings
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models import User
from app.core.permissions import can

# Suppress noisy passlib probe under bcrypt 4.x — works fine, just prints a warning.
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def hash_pin(pin: str) -> str:
    return pwd.hash(pin)


def verify_pin(pin: str, hashed: str) -> bool:
    return pwd.verify(pin, hashed)


def create_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode({"sub": str(user_id), "exp": expire}, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_user(token: str | None, db: Session) -> User | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        uid = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None
    return db.get(User, uid)


def current_user(token: Annotated[str | None, Depends(oauth2)], db: Annotated[Session, Depends(get_db)]) -> User:
    user = decode_user(token, db)
    if not user or not user.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return user


def require_role(*roles: str):
    def checker(user: Annotated[User, Depends(current_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return checker


def require_permission(permission: str):
    def checker(user: Annotated[User, Depends(current_user)]) -> User:
        if not can(user, permission):
            raise HTTPException(status_code=403, detail=f"Missing permission: {permission}")
        return user
    return checker
