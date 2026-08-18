from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Score, Song
from app.schemas import ScoreResponse
from typing import List, Optional
import random as _random

router = APIRouter()

@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.dj_name).all()
    return [{"iidx_id": u.iidx_id, "dj_name": u.dj_name} for u in users]

@router.get("/unofficial_levels")
def get_unofficial_levels(db: Session = Depends(get_db)):
    rows = (
        db.query(Song.level, Song.unofficial_level)
        .filter(Song.unofficial_level.isnot(None))
        .distinct()
        .order_by(Song.level, Song.unofficial_level)
        .all()
    )
    result: dict[int, list[float]] = {}
    for level, unofficial in rows:
        result.setdefault(level, []).append(unofficial)
    return result

@router.get("/songs/random")
def get_random_song(
    from_level: int,
    from_unofficial: float,
    to_level: int,
    to_unofficial: float,
    db: Session = Depends(get_db),
):
    # (from_level, from_unofficial)이 항상 작은 쪽이 되도록 정렬
    if (from_level, from_unofficial) > (to_level, to_unofficial):
        from_level, from_unofficial, to_level, to_unofficial = to_level, to_unofficial, from_level, from_unofficial

    songs = (
        db.query(Song)
        .filter(
            Song.unofficial_level.isnot(None),
            # (level, unofficial_level) >= (from_level, from_unofficial)
            (Song.level > from_level) | (
                (Song.level == from_level) & (Song.unofficial_level >= from_unofficial)
            ),
            # (level, unofficial_level) <= (to_level, to_unofficial)
            (Song.level < to_level) | (
                (Song.level == to_level) & (Song.unofficial_level <= to_unofficial)
            ),
        )
        .all()
    )
    if not songs:
        raise HTTPException(status_code=404, detail="해당 범위에 곡이 없습니다")
    s = _random.choice(songs)
    return {"title": s.title, "chart": s.chart, "level": s.level, "unofficial_level": s.unofficial_level}

@router.get("/songs")
def get_songs(level: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Song).filter(Song.unofficial_level.isnot(None))
    if level:
        query = query.filter(Song.level == level)
    songs = query.order_by(Song.unofficial_level.desc(), Song.title).all()
    return [
        {
            "title": s.title,
            "chart": s.chart,
            "level": s.level,
            "unofficial_level": s.unofficial_level,
            "version_id": s.version_id,
        }
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
            song_id=song.id,
            title=song.title,
            level=song.level,
            chart=song.chart,
            unofficial_level=song.unofficial_level,
            version_id=song.version_id,
            clear_type=user_scores[song.id].clear_type if song.id in user_scores else 0,
            score=user_scores[song.id].score if song.id in user_scores else 0,
            dj_level=user_scores[song.id].dj_level if song.id in user_scores else "---",
            updated_at=user_scores[song.id].updated_at if song.id in user_scores else None,
        )
        for song in songs
    ]