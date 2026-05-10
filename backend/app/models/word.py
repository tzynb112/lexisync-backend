import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Integer, Boolean, func, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Word(Base):
    __tablename__ = "words"

    id: Mapped[uuid.UUID] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    word: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    phonetic: Mapped[str | None] = mapped_column(String(200), nullable=True)
    definition: Mapped[str] = mapped_column(Text, nullable=False)
    part_of_speech: Mapped[str | None] = mapped_column(String(50), nullable=True)
    etymology: Mapped[str | None] = mapped_column(Text, nullable=True)
    example_sentence: Mapped[str | None] = mapped_column(Text, nullable=True)
    sentence_cn: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now()
    )

    word_records: Mapped[list["WordRecord"]] = relationship(
        "WordRecord", back_populates="word", cascade="all, delete-orphan"
    )
    word_tags: Mapped[list["WordTag"]] = relationship(
        "WordTag", back_populates="word", cascade="all, delete-orphan"
    )
    favorited_by: Mapped[list["FavoriteWord"]] = relationship(
        "FavoriteWord", back_populates="word", cascade="all, delete-orphan"
    )
    word_notes: Mapped[list["WordNote"]] = relationship(
        "WordNote", back_populates="word", cascade="all, delete-orphan"
    )

    word_category_links: Mapped[list["WordCategoryLink"]] = relationship(
        "WordCategoryLink", back_populates="word", cascade="all, delete-orphan"
    )
    synonyms: Mapped[list["WordRelation"]] = relationship(
        "WordRelation", foreign_keys="WordRelation.word_id",
        back_populates="word", cascade="all, delete-orphan"
    )


class WordCategory(Base):
    """系统级单词分类（如：考研词汇、中考词汇等），所有用户共享"""
    __tablename__ = "word_categories"

    id: Mapped[uuid.UUID] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    color: Mapped[str] = mapped_column(String(7), default="#00e5bf", nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now()
    )

    word_category_links: Mapped[list["WordCategoryLink"]] = relationship(
        "WordCategoryLink", back_populates="category", cascade="all, delete-orphan"
    )


class WordCategoryLink(Base):
    """单词与系统分类的关联表"""
    __tablename__ = "word_category_links"
    __table_args__ = (
        UniqueConstraint('word_id', 'category_id', name='uq_word_category'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    word_id: Mapped[uuid.UUID] = mapped_column(
        String(36), ForeignKey("words.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        String(36), ForeignKey("word_categories.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now()
    )

    word: Mapped["Word"] = relationship("Word", back_populates="word_category_links")
    category: Mapped["WordCategory"] = relationship("WordCategory", back_populates="word_category_links")


class WordRelation(Base):
    __tablename__ = "word_relations"

    id: Mapped[uuid.UUID] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    word_id: Mapped[uuid.UUID] = mapped_column(
        String(36), ForeignKey("words.id", ondelete="CASCADE"), nullable=False, index=True
    )
    related_word_id: Mapped[uuid.UUID] = mapped_column(
        String(36), ForeignKey("words.id", ondelete="CASCADE"), nullable=False, index=True
    )
    relation_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), server_default=func.now()
    )

    word: Mapped["Word"] = relationship(
        "Word", foreign_keys=[word_id], back_populates="synonyms"
    )
    related_word: Mapped["Word"] = relationship(
        "Word", foreign_keys=[related_word_id]
    )
