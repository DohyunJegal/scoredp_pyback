"""
기존 DB에 인덱스 추가 마이그레이션
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "scoredp.db")

statements = [
    "CREATE INDEX IF NOT EXISTS ix_scores_user_id ON scores (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_scores_song_id ON scores (song_id)",
    "CREATE INDEX IF NOT EXISTS ix_songs_title_normalized ON songs (title_normalized)",
]

conn = sqlite3.connect(DB_PATH)
for sql in statements:
    conn.execute(sql)
    print(f"OK: {sql}")
conn.commit()
conn.close()
print("완료.")