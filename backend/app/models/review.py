import uuid
from datetime import datetime

from sqlalchemy import String, ForeignKey, Integer, Float, DateTime, Text, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WordRecord(Base):
    __tablename__ = "word_records"
    __table_args__ = (
        UniqueConstraint('user_id', 'word_id', name='uq_word_record_user_word'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    word_id: Mapped[uuid.UUID] = mapped_column(
        String(36), ForeignKey("words.id", ondelete="CASCADE"), nullable=False
    )
    easiness_factor: Mapped[float] = mapped_column(Float, default=2.5, nullable=False)
    interval: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    repetitions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_review_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False
    )
    total_reviews: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    correct_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    incorrect_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="word_records")
    word: Mapped["Word"] = relationship("Word", back_populates="word_records")
    review_logs: Mapped[list["ReviewLog"]] = relationship(
        "ReviewLog", back_populates="word_record", cascade="all, delete-orphan"
    )


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    word_record_id: Mapped[uuid.UUID] = mapped_column(
        String(36),
        ForeignKey("word_records.id", ondelete="CASCADE"),
        nullable=False,
    )
    quality: Mapped[int] = mapped_column(Integer, nullable=False)
    interval_before: Mapped[int] = mapped_column(Integer, nullable=False)
    interval_after: Mapped[int] = mapped_column(Integer, nullable=False)
    easiness_factor_before: Mapped[float] = mapped_column(Float, nullable=False)
    easiness_factor_after: Mapped[float] = mapped_column(Float, nullable=False)
    repetitions_before: Mapped[int] = mapped_column(Integer, nullable=False)
    repetitions_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="review_logs")
    word_record: Mapped["WordRecord"] = relationship(
        "WordRecord", back_populates="review_logs"
    )
