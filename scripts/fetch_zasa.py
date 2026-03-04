"""
zasa.sakura.ne.jp/dp/run.php 파싱 → songs 테이블 초기 적재 스크립트

실행:
    python -m scripts.fetch_zasa
또는:
    cd scoredp && python scripts/fetch_zasa.py
"""

import re
import sys
import os
import requests
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal, engine, Base
from app.models import Song
from app.utils import normalize_title

ZASA_URL = "https://zasa.sakura.ne.jp/dp/run.php"

# zasa 오표기 보정
TITLE_FIXES: dict[str, str] = {
    "Muzik LoverZ": "Musik LoverZ",
    "Voo Boo Bamboleo": "Voo Doo Bamboleo",
}

DIFFICULTY_MAP = {
    "5": "HYPER",
    "7": "ANOTHER",
    "9": "LEGGENDARIA",
}

# ☆10 (10.5) 형식에서 (official_level, unofficial_level) 추출
CELL_RE = re.compile(r"☆(\d+)\s*\(([0-9.]+)\)")
# music.php?id=XXXXX-Y-Z 형식에서 zasa_id와 difficulty key 추출
LINK_RE = re.compile(r"music\.php\?id=(\d{5})-([579])-[01]")


def parse_cell(cell):
    """
    셀 텍스트/링크에서 (zasa_id, official_level, unofficial_level, chart) 반환.
    해당 차트가 없으면 None 반환.
    """
    a = cell.find("a")
    if not a:
        return None

    href = a.get("href", "")
    link_match = LINK_RE.search(href)
    if not link_match:
        return None

    zasa_id = link_match.group(1)
    diff_key = link_match.group(2)
    chart = DIFFICULTY_MAP.get(diff_key)
    if not chart:
        return None

    text = a.get_text()
    cell_match = CELL_RE.search(text)
    if not cell_match:
        return None

    official_level = int(cell_match.group(1))
    unofficial_level = float(cell_match.group(2))

    return {
        "zasa_id": zasa_id,
        "chart": chart,
        "level": official_level,
        "unofficial_level": unofficial_level,
    }


def fetch_songs():
    resp = requests.get(ZASA_URL, timeout=30)
    resp.encoding = resp.apparent_encoding
    soup = BeautifulSoup(resp.text, "html.parser")

    # 테이블 행을 순회 (헤더 행 제외)
    rows = soup.find_all("tr")
    songs = []

    for row in rows:
        cells = row.find_all("td")
        # 열 구성: HYPER | ANOTHER | LEGGENDARIA | 곡명
        if len(cells) < 4:
            continue

        title_cell = cells[-1]
        title = title_cell.get_text(strip=True)
        if not title:
            continue
        title = TITLE_FIXES.get(title, title)

        # 앞 3개 셀이 각 차트 (순서: HYPER, ANOTHER, LEGGENDARIA)
        for cell in cells[:3]:
            info = parse_cell(cell)
            if info is None:
                continue
            songs.append({
                "zasa_id": info["zasa_id"],
                "title": title,
                "title_normalized": normalize_title(title),
                "level": info["level"],
                "chart": info["chart"],
                "unofficial_level": info["unofficial_level"],
            })

    return songs


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("zasa 데이터 가져오는 중...")
        songs = fetch_songs()
        print(f"파싱된 곡: {len(songs)}개")

        added = 0
        skipped = 0

        for s in songs:
            existing = db.query(Song).filter(
                Song.title_normalized == s["title_normalized"],
                Song.chart == s["chart"]
            ).first()

            if existing:
                existing.zasa_id = s["zasa_id"]
                existing.unofficial_level = s["unofficial_level"]
                existing.title_normalized = s["title_normalized"]
                skipped += 1
            else:
                db.add(Song(**s))
                added += 1

        db.commit()
        print(f"추가: {added}개, 업데이트(스킵): {skipped}개")

    finally:
        db.close()


if __name__ == "__main__":
    main()