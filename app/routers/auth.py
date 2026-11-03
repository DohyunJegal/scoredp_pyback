import hashlib
import math
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, or_, update
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/auth")


class RegisterRequest(BaseModel):
    iidx_id: str
    password: str


def hash_password(iidx_id: str, password: str) -> str:
    return hashlib.sha256(f"{iidx_id}:{password}".encode()).hexdigest()


def verify_password(iidx_id: str, password: str, stored_hash: str) -> bool:
    return hash_password(iidx_id, password) == stored_hash


# 비밀번호 잠금: 5회 실패 후 잠금, 라운드가 거듭될수록 잠금 시간 증가
LOCK_EVERY = 5
LOCK_MINUTES = (15, 60, 240, 960)      # 잠금 시간
LOCK_MAX_MINUTES = 24 * 60             # 최대 시간
FAIL_DECAY = timedelta(hours=24)       # 마지막 실패부터 이 시간이 지나면 초기화


def _locked(locked_until: datetime, now: datetime) -> HTTPException:
    secs = max(1, math.ceil((locked_until - now).total_seconds()))
    return HTTPException(
        status_code=429,
        detail={"message": "비밀번호를 너무 많이 틀렸습니다. 잠시 후 다시 시도해 주세요.", "retry_after": secs},
        headers={"Retry-After": str(secs)},
    )


def authenticate(db: Session, iidx_id: str, password: str) -> User:
    """비밀번호 확인 및 계정별 잠금 확인"""
    iidx_id = iidx_id.replace("-", "")
    user = db.query(User).filter(User.iidx_id == iidx_id).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="비밀번호가 설정되지 않은 계정입니다.")

    now = datetime.utcnow()
    unlocked = or_(User.pw_locked_until.is_(None), User.pw_locked_until <= now)

    # 마지막 실패로부터 오래 지났으면 횟수 초기화
    db.execute(
        update(User)
        .where(User.id == user.id, unlocked, User.pw_last_fail_at < now - FAIL_DECAY)
        .values(pw_fail_count=0)
        .execution_options(synchronize_session=False)
    )

    # 비밀번호 비교 전 시도 1회를 원자적으로 먼저 소진, 이번 시도가 5의 배수면 같은 UPDATE 안에서 잠금
    new_count = User.pw_fail_count + 1
    lock_until = case(
        (new_count % LOCK_EVERY != 0, User.pw_locked_until),
        *[(new_count == LOCK_EVERY * (i + 1), now + timedelta(minutes=m)) for i, m in enumerate(LOCK_MINUTES)],
        else_=now + timedelta(minutes=LOCK_MAX_MINUTES),
    )
    reserved = db.execute(
        update(User)
        .where(User.id == user.id, unlocked)
        .values(pw_fail_count=new_count, pw_last_fail_at=now, pw_locked_until=lock_until)
        .execution_options(synchronize_session=False)
    ).rowcount
    db.commit()
    db.refresh(user)
    # 이미 잠겨 있다면 비밀번호 비교하지 않음
    if not reserved:
        raise _locked(user.pw_locked_until, now)

    if verify_password(iidx_id, password, user.password_hash):
        db.execute(
            update(User).where(User.id == user.id)
            .values(pw_fail_count=0, pw_last_fail_at=None, pw_locked_until=None)
            .execution_options(synchronize_session=False)
        )
        db.commit()
        return user
    if user.pw_locked_until and user.pw_locked_until > now:
        raise _locked(user.pw_locked_until, now)
    raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")


@router.get("/status/{iidx_id}")
def get_status(iidx_id: str, db: Session = Depends(get_db)):
    iidx_id = iidx_id.replace("-", "")
    user = db.query(User).filter(User.iidx_id == iidx_id).first()
    return {
        "has_password": bool(user and user.password_hash),
        "dj_name": user.dj_name if user else None,
    }


@router.post("/verify")
def verify(data: RegisterRequest, db: Session = Depends(get_db)):
    authenticate(db, data.iidx_id, data.password)
    return {"ok": True}


@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if not data.password.isdigit() or len(data.password) != 4:
        raise HTTPException(status_code=400, detail="비밀번호는 숫자 4자리여야 합니다.")

    iidx_id = data.iidx_id.replace("-", "")
    user = db.query(User).filter(User.iidx_id == iidx_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="먼저 크롤링을 실행해 주세요.")

    # 최초 설정만, 재설정은 관리자가 직접 초기화
    updated = db.query(User).filter(
        User.id == user.id, User.password_hash.is_(None)
    ).update({"password_hash": hash_password(iidx_id, data.password)})
    db.commit()
    if not updated:
        raise HTTPException(status_code=409, detail="이미 비밀번호가 설정된 계정입니다.")
    return {"message": "비밀번호가 설정되었습니다."}