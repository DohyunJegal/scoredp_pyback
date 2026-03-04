from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    iidx_id = Column(String, unique=True, index=True, nullable=False)
    dj_name = Column(String, nullable=False)
    scores = relationship("Score", back_populates="user")

class Song(Base):
    __tablename__ = "songs"
    id = Column(Integer, primary_key=True)
    zasa_id = Column(String, nullable=True)       # "01010" - 버전 포함
    title = Column(String, nullable=False)
    title_normalized = Column(String, nullable=False)  # 정규화된 곡명 (매칭용)
    level = Column(Integer, nullable=False)
    chart = Column(String, nullable=False)        # HYPER/ANOTHER/LEGGENDARIA
    unofficial_level = Column(Float, nullable=True)
    scores = relationship("Score", back_populates="song")

class Score(Base):
    __tablename__ = "scores"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    song_id = Column(Integer, ForeignKey("songs.id"), nullable=False)
    clear_type = Column(Integer, default=0)  # 0=NO PLAY 1=FAILED 2=CLEAR 3=HARD 4=EX_HARD 5=FC
    score = Column(Integer, default=0)
    dj_level = Column(String, default="---")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = relationship("User", back_populates="scores")
    song = relationship("Song", back_populates="scores")