from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models import User, Option
from app.routers.auth import verify_password

router = APIRouter(prefix="/options")


class OptionSaveRequest(BaseModel):
    iidx_id: str
    password: str
    song_id: int
    flip: int       # 0/1
    left_arr: int   # 0~4
    right_arr: int  # 0~4


def _get_authed_user(iidx_id: str, password: str, db: Session) -> User:
    iidx_id = iidx_id.replace("-", "")
    user = db.query(User).filter(User.iidx_id == iidx_id).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="비밀번호가 설정되지 않은 계정입니다.")
    if not verify_password(iidx_id, password, user.password_hash):
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")
    return user


@router.post("")
def save_option(data: OptionSaveRequest, db: Session = Depends(get_db)):
    user = _get_authed_user(data.iidx_id, data.password, db)

    option = db.query(Option).filter(
        Option.user_id == user.id,
        Option.song_id == data.song_id,
    ).first()

    all_default = data.flip == 0 and data.left_arr == 0 and data.right_arr == 0

    if all_default:
        if option:
            db.delete(option)
            db.commit()
        return {"message": "삭제되었습니다."}

    if option:
        option.flip = data.flip
        option.left_arr = data.left_arr
        option.right_arr = data.right_arr
    else:
        db.add(Option(
            user_id=user.id,
            song_id=data.song_id,
            flip=data.flip,
            left_arr=data.left_arr,
            right_arr=data.right_arr,
        ))

    db.commit()
    return {"message": "저장되었습니다."}


@router.get("/{iidx_id}")
def get_options(iidx_id: str, db: Session = Depends(get_db)):
    iidx_id = iidx_id.replace("-", "")
    user = db.query(User).filter(User.iidx_id == iidx_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")

    options = db.query(
        Option.song_id, Option.flip, Option.left_arr, Option.right_arr
    ).filter(Option.user_id == user.id).all()

    return [
        {"song_id": o.song_id, "flip": o.flip, "left_arr": o.left_arr, "right_arr": o.right_arr}
        for o in options
    ]