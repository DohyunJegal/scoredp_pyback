import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Song, Score
from app.schemas import UploadRequest
from app.utils import normalize_title

logger = logging.getLogger(__name__)

router = APIRouter()

DJ_LEVEL_RANK = {
    "---": 0, "F": 1, "E": 2, "D": 3,
    "C": 4, "B": 5, "A": 6, "AA": 7, "AAA": 8
}

@router.post("/upload")
def upload_scores(data: UploadRequest, db: Session = Depends(get_db)):
    iidx_id = data.iidx_id.replace('-', '')

    # 유저 upsert
    user = db.query(User).filter(User.iidx_id == iidx_id).first()
    if not user:
        user = User(iidx_id=iidx_id, dj_name=data.dj_name)
        db.add(user)
        db.flush()
    else:
        user.dj_name = data.dj_name

    updated = 0

    for item in data.scores:
        if item.chart == 'NORMAL':
            continue
        normalized = normalize_title(item.title)
        q = db.query(Song).filter(
            Song.title_normalized == normalized,
            Song.chart == item.chart
        )
        if item.level is not None:
            q = q.filter(Song.level == item.level)
        cands = q.all()
        if len(cands) > 1 and item.series is not None:
            # 동명곡 series → version_id 비교
            vids = (1, 2) if item.series == 0 else (item.series + 2,)
            cands = [s for s in cands if s.version_id in vids] or cands
        if len(cands) > 1:
            logger.warning(
                "Song match ambiguous | title=%r | normalized=%r | chart=%s | series=%s | song_ids=%s | version_ids=%s",
                item.title,
                normalized,
                item.chart,
                item.series,
                [s.id for s in cands],
                [s.version_id for s in cands]
            )
            continue
        song = cands[0] if cands else None
        if not song:
            logger.warning(
                "Song match failed | title=%r | normalized=%r | chart=%s",
                item.title,
                normalized,
                item.chart
            )
            continue

        # 점수 조회
        score = db.query(Score).filter(
            Score.user_id == user.id,
            Score.song_id == song.id
        ).first()

        if not score:
            score = Score(
                user_id=user.id,
                song_id=song.id,
                clear_type=item.clear_type,
                score=item.score,
                dj_level=item.dj_level
            )
            db.add(score)
            updated += 1
        else:
            changed = False
            # clear_type 독립 갱신
            if item.clear_type > score.clear_type:
                score.clear_type = item.clear_type
                changed = True
            # score + dj_level 독립 갱신
            if item.score > score.score:
                score.score = item.score
                score.dj_level = item.dj_level
                changed = True
            if changed:
                updated += 1

    db.commit()
    return {"message": "업로드 완료", "updated": updated}