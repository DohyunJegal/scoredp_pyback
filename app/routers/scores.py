from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Score, Song
from app.schemas import ScoreResponse
from typing import List, Optional

router = APIRouter()

@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.dj_name).all()
    return [{"iidx_id": u.iidx_id, "dj_name": u.dj_name} for u in users]

@router.get("/songs")
def get_songs(level: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Song).filter(Song.unofficial_level.isnot(None))
    if level:
        query = query.filter(Song.level == level)
    songs = query.order_by(Song.unofficial_level.desc(), Song.title).all()
    return [
        {"title": s.title, "chart": s.chart, "level": s.level, "unofficial_level": s.unofficial_level}
        for s in songs
    ]

@router.get("/scores/{iidx_id}", response_model=List[ScoreResponse])
def get_scores(
    iidx_id: str,
    level: Optional[int] = None,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.iidx_id == iidx_id.replace('-', '')).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

    # 전체 곡 조회 (unofficial_level 있는 곡만)
    song_query = db.query(Song).filter(Song.unofficial_level.isnot(None))
    if level:
        song_query = song_query.filter(Song.level == level)
    songs = song_query.order_by(Song.unofficial_level.desc(), Song.title).all()

    # 유저 스코어를 song_id 기준 딕셔너리로
    user_scores = {
        s.song_id: s
        for s in db.query(Score).filter(Score.user_id == user.id).all()
    }

    return [
        ScoreResponse(
            title=song.title,
            level=song.level,
            chart=song.chart,
            unofficial_level=song.unofficial_level,
            clear_type=user_scores[song.id].clear_type if song.id in user_scores else 0,
            score=user_scores[song.id].score if song.id in user_scores else 0,
            dj_level=user_scores[song.id].dj_level if song.id in user_scores else "---",
            updated_at=user_scores[song.id].updated_at if song.id in user_scores else None,
        )
        for song in songs
    ]