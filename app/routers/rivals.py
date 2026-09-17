import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import RivalPost, RivalComment
from app.schemas import (
    RivalPostCreate, RivalPostUpdate, RivalPostResponse,
    RivalCommentCreate, RivalCommentUpdate, RivalCommentResponse,
    PasswordVerify,
)

router = APIRouter(prefix="/rivals")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, stored_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), stored_hash.encode())


def _get_post_or_404(post_id: int, db: Session) -> RivalPost:
    post = db.query(RivalPost).filter(RivalPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")
    return post


def _get_comment_or_404(comment_id: int, db: Session) -> RivalComment:
    comment = db.query(RivalComment).filter(RivalComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다")
    return comment


@router.get("", response_model=List[RivalPostResponse])
def list_posts(
    q: Optional[str] = None,
    sp_dan: Optional[int] = None,
    dp_dan: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(RivalPost)
    if q:
        query = query.filter(or_(
            RivalPost.iidx_id.contains(q.replace("-", "")),
            RivalPost.dj_name.contains(q),
        ))
    if sp_dan:
        query = query.filter(RivalPost.sp_dan == sp_dan)
    if dp_dan:
        query = query.filter(RivalPost.dp_dan == dp_dan)
    posts = query.order_by(RivalPost.created_at.desc()).all()
    return [
        RivalPostResponse(
            id=p.id, iidx_id=p.iidx_id, dj_name=p.dj_name,
            sp_dan=p.sp_dan, dp_dan=p.dp_dan, title=p.title, content=p.content,
            created_at=p.created_at, updated_at=p.updated_at,
            comment_count=len(p.comments),
        )
        for p in posts
    ]


@router.get("/{post_id}", response_model=RivalPostResponse)
def get_post(post_id: int, db: Session = Depends(get_db)):
    post = _get_post_or_404(post_id, db)
    return RivalPostResponse(
        id=post.id, iidx_id=post.iidx_id, dj_name=post.dj_name,
        sp_dan=post.sp_dan, dp_dan=post.dp_dan, title=post.title, content=post.content,
        created_at=post.created_at, updated_at=post.updated_at,
        comment_count=len(post.comments),
    )


@router.post("", response_model=RivalPostResponse)
def create_post(data: RivalPostCreate, db: Session = Depends(get_db)):
    post = RivalPost(
        iidx_id=data.iidx_id.replace("-", ""),
        dj_name=data.dj_name,
        password_hash=hash_password(data.password),
        sp_dan=data.sp_dan,
        dp_dan=data.dp_dan,
        title=data.title,
        content=data.content,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return RivalPostResponse(
        id=post.id, iidx_id=post.iidx_id, dj_name=post.dj_name,
        sp_dan=post.sp_dan, dp_dan=post.dp_dan, title=post.title, content=post.content,
        created_at=post.created_at, updated_at=post.updated_at, comment_count=0,
    )


@router.post("/{post_id}/verify")
def verify_post_password(post_id: int, data: PasswordVerify, db: Session = Depends(get_db)):
    post = _get_post_or_404(post_id, db)
    if not verify_password(data.password, post.password_hash):
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")
    return {"ok": True}


@router.put("/{post_id}", response_model=RivalPostResponse)
def update_post(post_id: int, data: RivalPostUpdate, db: Session = Depends(get_db)):
    post = _get_post_or_404(post_id, db)
    if not verify_password(data.password, post.password_hash):
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")
    post.sp_dan = data.sp_dan
    post.dp_dan = data.dp_dan
    post.title = data.title
    post.content = data.content
    db.commit()
    db.refresh(post)
    return RivalPostResponse(
        id=post.id, iidx_id=post.iidx_id, dj_name=post.dj_name,
        sp_dan=post.sp_dan, dp_dan=post.dp_dan, title=post.title, content=post.content,
        created_at=post.created_at, updated_at=post.updated_at,
        comment_count=len(post.comments),
    )


@router.delete("/{post_id}")
def delete_post(post_id: int, data: PasswordVerify, db: Session = Depends(get_db)):
    post = _get_post_or_404(post_id, db)
    if not verify_password(data.password, post.password_hash):
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")
    db.delete(post)
    db.commit()
    return {"message": "삭제되었습니다."}


@router.get("/{post_id}/comments", response_model=List[RivalCommentResponse])
def list_comments(post_id: int, db: Session = Depends(get_db)):
    _get_post_or_404(post_id, db)
    return (
        db.query(RivalComment)
        .filter(RivalComment.post_id == post_id)
        .order_by(RivalComment.created_at)
        .all()
    )


@router.post("/{post_id}/comments", response_model=RivalCommentResponse)
def create_comment(post_id: int, data: RivalCommentCreate, db: Session = Depends(get_db)):
    _get_post_or_404(post_id, db)
    comment = RivalComment(
        post_id=post_id,
        iidx_id=data.iidx_id.replace("-", ""),
        dj_name=data.dj_name,
        password_hash=hash_password(data.password),
        content=data.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.post("/comments/{comment_id}/verify")
def verify_comment_password(comment_id: int, data: PasswordVerify, db: Session = Depends(get_db)):
    comment = _get_comment_or_404(comment_id, db)
    if not verify_password(data.password, comment.password_hash):
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")
    return {"ok": True}


@router.put("/comments/{comment_id}", response_model=RivalCommentResponse)
def update_comment(comment_id: int, data: RivalCommentUpdate, db: Session = Depends(get_db)):
    comment = _get_comment_or_404(comment_id, db)
    if not verify_password(data.password, comment.password_hash):
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")
    comment.content = data.content
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, data: PasswordVerify, db: Session = Depends(get_db)):
    comment = _get_comment_or_404(comment_id, db)
    if not verify_password(data.password, comment.password_hash):
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")
    db.delete(comment)
    db.commit()
    return {"message": "삭제되었습니다."}
