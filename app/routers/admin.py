from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Song, User, Score
from app.schemas import SongCreate, SongUpdate
from app.utils import normalize_title
from typing import List
import openpyxl
import io

router = APIRouter()


# ── 곡 목록 ──────────────────────────────────────────────
@router.get("/admin/songs")
def get_songs(db: Session = Depends(get_db)):
    return db.query(Song).order_by(Song.level, Song.chart, Song.title).all()


# ── 곡 단건 수정 ─────────────────────────────────────────
@router.put("/admin/songs/{song_id}")
def update_song(song_id: int, song: SongUpdate, db: Session = Depends(get_db)):
    existing = db.query(Song).filter(Song.id == song_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다")
    existing.title = song.title
    existing.title_normalized = normalize_title(song.title)
    existing.level = song.level
    existing.chart = song.chart
    existing.unofficial_level = song.unofficial_level
    db.commit()
    db.refresh(existing)
    return {
        "id": existing.id,
        "title": existing.title,
        "chart": existing.chart,
        "level": existing.level,
        "unofficial_level": existing.unofficial_level,
        "zasa_id": existing.zasa_id,
    }


# ── 곡 삭제 ──────────────────────────────────────────────
@router.delete("/admin/songs/{song_id}")
def delete_song(song_id: int, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="곡을 찾을 수 없습니다")
    db.delete(song)
    db.commit()
    return {"message": "삭제 완료"}


# ── Excel 내보내기 ────────────────────────────────────────
@router.get("/admin/songs/export")
def export_songs(db: Session = Depends(get_db)):
    songs = db.query(Song).order_by(Song.level, Song.chart, Song.title).all()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "songs"
    ws.append(["id", "title", "chart", "level", "unofficial_level", "zasa_id"])
    for s in songs:
        ws.append([s.id, s.title, s.chart, s.level, s.unofficial_level, s.zasa_id])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=songs.xlsx"},
    )


# ── Excel 가져오기 (id 기준 업데이트) ─────────────────────
@router.post("/admin/songs/import")
def import_songs(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = file.file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents))
    ws = wb.active

    updated = 0
    skipped = 0

    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0]:
            skipped += 1
            continue
        song_id, title, chart, level, unofficial_level = (
            row[0], row[1], row[2], row[3], row[4] if len(row) > 4 else None
        )
        zasa_id = row[5] if len(row) > 5 else None

        song = db.query(Song).filter(Song.id == int(song_id)).first()
        if not song:
            skipped += 1
            continue

        if title:
            song.title = str(title)
            song.title_normalized = normalize_title(str(title))
        if chart:
            song.chart = str(chart)
        if level:
            song.level = int(level)
        song.unofficial_level = float(unofficial_level) if unofficial_level is not None else None
        if zasa_id is not None:
            song.zasa_id = str(zasa_id) if zasa_id else None
        updated += 1

    db.commit()
    return {"updated": updated, "skipped": skipped}


# ── 곡 추가 (Excel 업로드 — 신규 추가 전용) ────────────────
@router.post("/admin/songs/upload")
def upload_songs(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = file.file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents))
    ws = wb.active

    added = 0
    skipped = 0

    for row in ws.iter_rows(min_row=2, values_only=True):
        title, level, chart = row[0], row[1], row[2]
        if not title or not level or not chart:
            continue
        existing = db.query(Song).filter(
            Song.title == str(title),
            Song.chart == str(chart)
        ).first()
        if existing:
            skipped += 1
            continue
        t = str(title)
        db.add(Song(title=t, title_normalized=normalize_title(t), level=int(level), chart=str(chart)))
        added += 1

    db.commit()
    return {"added": added, "skipped": skipped}


# ── 유저 목록 ─────────────────────────────────────────────
@router.get("/admin/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.dj_name).all()
    return [
        {
            "id": u.id,
            "iidx_id": u.iidx_id,
            "dj_name": u.dj_name,
            "score_count": db.query(Score).filter(Score.user_id == u.id).count(),
        }
        for u in users
    ]


# ── 유저 삭제 (스코어 포함) ───────────────────────────────
@router.delete("/admin/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")
    db.query(Score).filter(Score.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    return {"message": "삭제 완료"}