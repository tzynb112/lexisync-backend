import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.word import Word
from app.models.learning_path import LearningPath, LearningPathWord
from app.models.review import WordRecord

router = APIRouter(prefix="/api/learning-paths", tags=["Learning Paths"])


class PathWordResponse(BaseModel):
    id: str
    word: str
    phonetic: str | None
    definition: str
    part_of_speech: str | None
    order_index: int
    is_studied: bool


class LearningPathResponse(BaseModel):
    id: str
    name: str
    description: str | None
    category: str
    difficulty: str
    word_count: int
    created_at: str


class LearningPathDetailResponse(BaseModel):
    id: str
    name: str
    description: str | None
    category: str
    difficulty: str
    word_count: int
    created_at: str
    words: list[PathWordResponse]


@router.get("", response_model=list[LearningPathResponse])
async def list_learning_paths(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(LearningPath)
    if category:
        query = query.where(LearningPath.category == category)
    query = query.order_by(LearningPath.created_at.desc())

    result = await db.execute(query)
    paths = result.scalars().all()

    return [
        LearningPathResponse(
            id=str(p.id),
            name=p.name,
            description=p.description,
            category=p.category,
            difficulty=p.difficulty,
            word_count=p.word_count,
            created_at=p.created_at.isoformat(),
        )
        for p in paths
    ]


@router.get("/categories")
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(LearningPath.category, func.count(LearningPath.id))
        .group_by(LearningPath.category)
        .order_by(LearningPath.category)
    )
    return [{"category": row.category, "count": row[1]} for row in result.all()]


@router.get("/{path_id}", response_model=LearningPathDetailResponse)
async def get_learning_path(
    path_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(LearningPath)
        .where(LearningPath.id == path_id)
        .options(selectinload(LearningPath.path_words).selectinload(LearningPathWord.word))
    )
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")

    studied_result = await db.execute(
        select(WordRecord.word_id).where(WordRecord.user_id == current_user.id)
    )
    studied_ids = {row[0] for row in studied_result.all()}

    words = sorted(path.path_words, key=lambda pw: pw.order_index)

    return LearningPathDetailResponse(
        id=str(path.id),
        name=path.name,
        description=path.description,
        category=path.category,
        difficulty=path.difficulty,
        word_count=path.word_count,
        created_at=path.created_at.isoformat(),
        words=[
            PathWordResponse(
                id=str(pw.word.id),
                word=pw.word.word,
                phonetic=pw.word.phonetic,
                definition=pw.word.definition,
                part_of_speech=pw.word.part_of_speech,
                order_index=pw.order_index,
                is_studied=pw.word.id in studied_ids,
            )
            for pw in words
        ],
    )


@router.post("/{path_id}/start")
async def start_learning_path(
    path_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(LearningPath)
        .where(LearningPath.id == path_id)
        .options(selectinload(LearningPath.path_words))
    )
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")

    added = 0
    skipped = 0
    for pw in path.path_words:
        existing = (await db.execute(
            select(WordRecord).where(
                WordRecord.user_id == current_user.id,
                WordRecord.word_id == pw.word_id,
            )
        )).scalar_one_or_none()
        if existing:
            skipped += 1
            continue
        record = WordRecord(user_id=current_user.id, word_id=pw.word_id)
        db.add(record)
        added += 1

    await db.flush()
    return {"added": added, "skipped": skipped, "total": len(path.path_words)}
