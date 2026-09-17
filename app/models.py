from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    iidx_id = Column(String, unique=True, index=True, nullable=False)
    dj_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=True)
    scores = relationship("Score", back_populates="user")
    options = relationship("Option", back_populates="user")

class Version(Base):
    __tablename__ = "versions"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)

class Song(Base):
    __tablename__ = "songs"
    id = Column(Integer, primary_key=True)
    zasa_id = Column(String, nullable=True)       # "01010" - zasa 내부 곡 id (버전과 무관)
    title = Column(String, nullable=False)
    title_normalized = Column(String, nullable=False, index=True)  # 정규화된 곡명 (매칭용)
    level = Column(Integer, nullable=False)
    chart = Column(String, nullable=False)        # HYPER/ANOTHER/LEGGENDARIA
    unofficial_level = Column(Float, nullable=True)
    version_id = Column(Integer, ForeignKey("versions.id"), nullable=True)
    version = relationship("Version")
    scores = relationship("Score", back_populates="song")

class Score(Base):
    __tablename__ = "scores"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    song_id = Column(Integer, ForeignKey("songs.id"), nullable=False, index=True)
    clear_type = Column(Integer, default=0)  # 0=NO PLAY 1=FAILED 2=CLEAR 3=HARD 4=EX_HARD 5=FC
    score = Column(Integer, default=0)
    dj_level = Column(String, default="---")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = relationship("User", back_populates="scores")
    song = relationship("Song", back_populates="scores")

class Option(Base):
    __tablename__ = "options"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    song_id = Column(Integer, ForeignKey("songs.id"), primary_key=True)
    flip = Column(Integer, nullable=False, default=0)       # 0/1
    left_arr = Column(Integer, nullable=False, default=0)   # 0=정배 1=미러 2=랜덤 3=R-랜덤 4=슈퍼랜덤
    right_arr = Column(Integer, nullable=False, default=0)
    user = relationship("User", back_populates="options")
    song = relationship("Song")

class RivalPost(Base):
    __tablename__ = "rival_posts"
    id = Column(Integer, primary_key=True, index=True)
    iidx_id = Column(String, nullable=False, index=True)
    dj_name = Column(String, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    sp_dan = Column(Integer, nullable=True, index=True)  # 1~10=초단~10단, 11=중전, 12=개전
    dp_dan = Column(Integer, nullable=True, index=True)
    sp_arena = Column(String, nullable=True, index=True)  # "A1"(최상) ~ "C5"(최하)
    dp_arena = Column(String, nullable=True, index=True)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    comments = relationship("RivalComment", back_populates="post", cascade="all, delete-orphan")

class RivalComment(Base):
    __tablename__ = "rival_comments"
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("rival_posts.id"), nullable=False, index=True)
    iidx_id = Column(String, nullable=False)
    dj_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    post = relationship("RivalPost", back_populates="comments")