"""Login + /me."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import LoginIn, TokenOut, UserOut
from app.core.security import verify_pin, create_token, current_user
from app.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.pin.like(payload.pin)).first()
    # We store bcrypt hashes, so we need to verify against every active user.
    # For a 4-digit PIN this is at most ~100 users — fine.
    for u in db.query(User).filter(User.active.is_(True)).all():
        if verify_pin(payload.pin, u.pin):
            return TokenOut(access_token=create_token(u.id), user=UserOut.model_validate(u))
    raise HTTPException(status_code=401, detail="Wrong PIN")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return UserOut.model_validate(user)
