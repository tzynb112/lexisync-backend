import uuid
from datetime import datetime

from sqlalchemy import String, Text, Integer, DateTime, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LearningPath(Base):
    __tablename__ = "learning_paths"

    id: Mapped[uuid.UUID] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), default="beginner")
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now()
    )

    path_words: Mapped[list["LearningPathWord"]] = relationship(
        "LearningPathWord", back_populates="path", cascade="all, delete-orphan"
    )


class LearningPathWord(Base):
    __tablename__ = "learning_path_words"

    id: Mapped[uuid.UUID] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    path_id: Mapped[uuid.UUID] = mapped_column(
        String(36), ForeignKey("learning_paths.id", ondelete="CASCADE"), nullable=False
    )
    word_id: Mapped[uuid.UUID] = mapped_column(
        String(36), ForeignKey("words.id", ondelete="CASCADE"), nullable=False
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    path: Mapped["LearningPath"] = relationship("LearningPath", back_populates="path_words")
    word: Mapped["Word"] = relationship("Word")
