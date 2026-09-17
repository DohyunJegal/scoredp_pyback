import re
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime, timezone

def _as_utc(v: datetime) -> datetime:
    # SQLite는 tzinfo를 저장/복원하지 못해 항상 naive datetime을 돌려주므로,
    # 응답 직렬화 전에 UTC로 명시해줘야 프론트에서 오파싱하지 않음
    return v if v.tzinfo is not None else v.replace(tzinfo=timezone.utc)

# 1 ~ 10 = 초단 ~ 10단, 11 = 중전, 12 = 개전
DAN_LABELS = ["초단", "2단", "3단", "4단", "5단", "6단", "7단", "8단", "9단", "10단", "중전", "개전"]

def _no_html(value: str) -> str:
    if "<" in value or ">" in value:
        raise ValueError("텍스트만 입력할 수 있습니다.")
    return value

def _check_ascii(value: str) -> str:
    if not re.fullmatch(r"[\x21-\x7E]+", value):
        raise ValueError("영어, 숫자, 특수문자만 사용할 수 있습니다.")
    return value

def _check_iidx_id(value: str) -> str:
    if not re.fullmatch(r"\d{8}", value.replace("-", "")):
        raise ValueError("IIDX ID는 8자리 숫자여야 합니다.")
    return value

def _check_arena(value: Optional[str]) -> Optional[str]:
    if value is not None and not re.fullmatch(r"[ABC][1-5]", value):
        raise ValueError("아레나 클래스는 A1~C5 중 하나여야 합니다.")
    return value

class ScoreItem(BaseModel):
    title: str
    chart: str
    level: int
    clear_type: int
    score: int
    dj_level: str

class UploadRequest(BaseModel):
    iidx_id: str
    dj_name: str
    scores: List[ScoreItem]

class ScoreResponse(BaseModel):
    song_id: int
    title: str
    level: int
    chart: str
    unofficial_level: Optional[float]
    version_id: Optional[int]
    clear_type: int
    score: int
    dj_level: str
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class SongCreate(BaseModel):
    title: str
    level: int
    chart: str

class SongUpdate(BaseModel):
    title: str
    level: int
    chart: str
    unofficial_level: Optional[float] = None

class RivalPostCreate(BaseModel):
    iidx_id: str = Field(min_length=1, max_length=9)
    dj_name: str = Field(min_length=1, max_length=6)
    password: str = Field(min_length=1, max_length=72)
    sp_dan: Optional[int] = Field(default=None, ge=1, le=12)
    dp_dan: Optional[int] = Field(default=None, ge=1, le=12)
    sp_arena: Optional[str] = Field(default=None, max_length=2)
    dp_arena: Optional[str] = Field(default=None, max_length=2)
    title: str = Field(min_length=1, max_length=60)
    content: str = Field(min_length=1, max_length=1000)

    @field_validator("iidx_id")
    @classmethod
    def _check_iidx(cls, v):
        return _check_iidx_id(v)

    @field_validator("dj_name")
    @classmethod
    def _check_dj_name(cls, v):
        return _no_html(_check_ascii(v))

    @field_validator("sp_arena", "dp_arena")
    @classmethod
    def _check_arena_fields(cls, v):
        return _check_arena(v)

    @field_validator("title", "content")
    @classmethod
    def _check_no_html(cls, v):
        return _no_html(v)

class RivalPostUpdate(BaseModel):
    password: str = Field(min_length=1, max_length=72)
    sp_dan: Optional[int] = Field(default=None, ge=1, le=12)
    dp_dan: Optional[int] = Field(default=None, ge=1, le=12)
    sp_arena: Optional[str] = Field(default=None, max_length=2)
    dp_arena: Optional[str] = Field(default=None, max_length=2)
    title: str = Field(min_length=1, max_length=60)
    content: str = Field(min_length=1, max_length=1000)

    @field_validator("sp_arena", "dp_arena")
    @classmethod
    def _check_arena_fields(cls, v):
        return _check_arena(v)

    @field_validator("title", "content")
    @classmethod
    def _check_no_html(cls, v):
        return _no_html(v)

class RivalCommentCreate(BaseModel):
    iidx_id: str = Field(min_length=1, max_length=9)
    dj_name: str = Field(min_length=1, max_length=6)
    password: str = Field(min_length=1, max_length=72)
    content: str = Field(min_length=1, max_length=300)

    @field_validator("iidx_id")
    @classmethod
    def _check_iidx(cls, v):
        return _check_iidx_id(v)

    @field_validator("dj_name")
    @classmethod
    def _check_dj_name(cls, v):
        return _no_html(_check_ascii(v))

    @field_validator("content")
    @classmethod
    def _check_no_html(cls, v):
        return _no_html(v)

class RivalCommentUpdate(BaseModel):
    password: str = Field(min_length=1, max_length=72)
    content: str = Field(min_length=1, max_length=300)

    @field_validator("content")
    @classmethod
    def _check_no_html(cls, v):
        return _no_html(v)

class PasswordVerify(BaseModel):
    password: str = Field(min_length=1, max_length=72)

class RivalPostResponse(BaseModel):
    id: int
    iidx_id: str
    dj_name: str
    sp_dan: Optional[int]
    dp_dan: Optional[int]
    sp_arena: Optional[str]
    dp_arena: Optional[str]
    title: str
    content: str
    created_at: datetime
    updated_at: datetime
    comment_count: int = 0

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def _tag_utc(cls, v):
        return _as_utc(v) if isinstance(v, datetime) else v

    class Config:
        from_attributes = True

class RivalPostPage(BaseModel):
    items: List[RivalPostResponse]
    has_more: bool
    total: int

class RivalCommentResponse(BaseModel):
    id: int
    post_id: int
    iidx_id: str
    dj_name: str
    content: str
    created_at: datetime

    @field_validator("created_at", mode="before")
    @classmethod
    def _tag_utc(cls, v):
        return _as_utc(v) if isinstance(v, datetime) else v

    class Config:
        from_attributes = True