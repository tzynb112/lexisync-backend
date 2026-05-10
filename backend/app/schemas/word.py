import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class WordCreate(BaseModel):
    word: str
    phonetic: Optional[str] = None
    definition: str
    part_of_speech: Optional[str] = None
    etymology: Optional[str] = None
    example_sentence: Optional[str] = None
    sentence_cn: Optional[str] = None
    language: str = "en"


class WordResponse(BaseModel):
    id: str
    word: str
    phonetic: Optional[str] = None
    definition: str
    part_of_speech: Optional[str] = None
    etymology: Optional[str] = None
    example_sentence: Optional[str] = None
    sentence_cn: Optional[str] = None
    language: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WordImport(BaseModel):
    words: list[WordCreate]


class BatchWordIds(BaseModel):
    word_ids: list[str]


class BatchTagRequest(BaseModel):
    word_ids: list[str]
    tag_id: str


class BatchOperationResult(BaseModel):
    success: int
    skipped: int
    failed: int


class WordDetailResponse(BaseModel):
    id: str
    word: str
    phonetic: Optional[str] = None
    definition: str
    part_of_speech: Optional[str] = None
    etymology: Optional[str] = None
    example_sentence: Optional[str] = None
    sentence_cn: Optional[str] = None
    language: str
    created_at: datetime
    tags: list[dict]
    is_favorited: bool
    review_info: Optional[dict] = None
    review_history: list[dict]

    model_config = {"from_attributes": True}


class PaginatedWordResponse(BaseModel):
    words: list[WordResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
