from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

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
    title: str
    level: int
    chart: str
    unofficial_level: Optional[float]
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