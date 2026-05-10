import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TagCreate(BaseModel):
    name: str
    color: str = "#00e5bf"


class TagResponse(BaseModel):
    id: str
    name: str
    color: str
    word_count: int = 0
    is_system: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class WordTagRequest(BaseModel):
    word_id: str
    tag_id: str


class FavoriteToggle(BaseModel):
    word_id: str


class UserSettingsUpdate(BaseModel):
    daily_goal: Optional[int] = None
    preferred_study_mode: Optional[str] = None
    enable_sound: Optional[bool] = None
    enable_ai_context: Optional[bool] = None
    reminder_enabled: Optional[bool] = None
    reminder_time: Optional[str] = None
    openai_api_key: Optional[str] = None


class UserSettingsResponse(BaseModel):
    daily_goal: int = 20
    preferred_study_mode: str = "flashcard"
    enable_sound: bool = True
    enable_ai_context: bool = True
    reminder_enabled: bool = False
    reminder_time: str = "09:00"
    openai_api_key: Optional[str] = None

    model_config = {"from_attributes": True}


class ChoiceTestQuestion(BaseModel):
    word_record_id: str
    word: str
    phonetic: Optional[str] = None
    correct_definition: str
    options: list[str]


class SpellingTestQuestion(BaseModel):
    word_record_id: str
    definition: str
    part_of_speech: Optional[str] = None
    phonetic: Optional[str] = None
    example_sentence: Optional[str] = None
    answer: str


class TestFeedback(BaseModel):
    word_record_id: str
    correct: bool


class DetailedStats(BaseModel):
    accuracy_trend: list[dict]
    mastery_distribution: dict
    daily_goal_progress: dict
    recent_reviews: list[dict]
