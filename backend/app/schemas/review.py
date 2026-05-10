import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.word import WordResponse


class ReviewFeedback(BaseModel):
    word_record_id: str
    quality: int


class ReviewFeedbackResponse(BaseModel):
    word_record_id: str
    word: WordResponse
    interval: int
    easiness_factor: float
    repetitions: int
    next_review_at: datetime


class DueWordResponse(BaseModel):
    word_record_id: str
    word: WordResponse
    easiness_factor: float
    interval: int
    repetitions: int
    next_review_at: datetime


class DashboardStats(BaseModel):
    due_today: int
    mastered_words: int
    total_words: int
    not_started: int = 0
    total_reviews: int
    streak_days: int
    today_reviews: int = 0
    heatmap_data: list[dict]
    daily_goal: int = 20
    daily_goal_progress: int = 0


class ChoiceTestQuestion(BaseModel):
    word_record_id: str
    word: str
    phonetic: Optional[str] = None
    correct_definition: str
    options: list[str]
    example_sentence: Optional[str] = None
    sentence_cn: Optional[str] = None


class SpellingTestQuestion(BaseModel):
    word_record_id: str
    definition: str
    part_of_speech: Optional[str] = None
    phonetic: Optional[str] = None
    example_sentence: Optional[str] = None
    sentence_cn: Optional[str] = None
    answer: str


class TestFeedback(BaseModel):
    word_record_id: str
    correct: bool


class AccuracyTrendItem(BaseModel):
    date: str
    accuracy: float
    total: int


class MasteryDistribution(BaseModel):
    new_words: int
    learning: int
    familiar: int
    mastered: int


class DetailedStats(BaseModel):
    accuracy_trend: list[dict]
    mastery_distribution: dict
    daily_goal_progress: dict
    recent_reviews: list[dict]
