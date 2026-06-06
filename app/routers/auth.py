import hashlib
from fastapi import APIRouter, Depends, HTTPException
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


@router.get("/status/{iidx_id}")
def get_status(iidx_id: str, db: Session = Depends(get_db)):
    iidx_id = iidx_id.replace("-", "")
    user = db.query(User).filter(User.iidx_id == iidx_id).first()
    return {"has_password": bool(user and user.password_hash)}


@router.post("/verify")
def verify(data: RegisterRequest, db: Session = Depends(get_db)):
    iidx_id = data.iidx_id.replace("-", "")
    user = db.query(User).filter(User.iidx_id == iidx_id).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="비밀번호가 설정되지 않은 계정입니다.")
    if not verify_password(iidx_id, data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")
    return {"ok": True}


@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if not data.password.isdigit() or len(data.password) != 4:
        raise HTTPException(status_code=400, detail="비밀번호는 숫자 4자리여야 합니다.")

    iidx_id = data.iidx_id.replace("-", "")
    user = db.query(User).filter(User.iidx_id == iidx_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="먼저 크롤링을 실행해 주세요.")

    user.password_hash = hash_password(iidx_id, data.password)
    db.commit()
    return {"message": "비밀번호가 설정되었습니다."}