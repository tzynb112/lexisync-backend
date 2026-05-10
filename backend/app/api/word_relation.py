import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.word import Word, WordRelation

router = APIRouter(prefix="/api/word-relations", tags=["Word Relations"])


class WordRelationCreate(BaseModel):
    word_id: str
    related_word_id: str
    relation_type: str


class WordRelationResponse(BaseModel):
    id: str
    word_id: str
    related_word_id: str
    relation_type: str
    related_word: str
    related_phonetic: str | None
    related_definition: str
    related_part_of_speech: str | None


@router.get("/{word_id}", response_model=list[WordRelationResponse])
async def get_word_relations(
    word_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WordRelation)
        .where(WordRelation.word_id == word_id)
        .options(selectinload(WordRelation.related_word))
    )
    relations = result.scalars().all()

    return [
        WordRelationResponse(
            id=r.id,
            word_id=r.word_id,
            related_word_id=r.related_word_id,
            relation_type=r.relation_type,
            related_word=r.related_word.word,
            related_phonetic=r.related_word.phonetic,
            related_definition=r.related_word.definition,
            related_part_of_speech=r.related_word.part_of_speech,
        )
        for r in relations
    ]


@router.post("", response_model=WordRelationResponse, status_code=201)
async def create_word_relation(
    payload: WordRelationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.relation_type not in ("synonym", "antonym", "related"):
        raise HTTPException(status_code=400, detail="relation_type must be synonym, antonym, or related")

    word = (await db.execute(select(Word).where(Word.id == payload.word_id))).scalar_one_or_none()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    related = (await db.execute(select(Word).where(Word.id == payload.related_word_id))).scalar_one_or_none()
    if not related:
        raise HTTPException(status_code=404, detail="Related word not found")

    existing = (await db.execute(
        select(WordRelation).where(
            WordRelation.word_id == payload.word_id,
            WordRelation.related_word_id == payload.related_word_id,
            WordRelation.relation_type == payload.relation_type,
        )
    )).scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=409, detail="Relation already exists")

    relation = WordRelation(
        word_id=payload.word_id,
        related_word_id=payload.related_word_id,
        relation_type=payload.relation_type,
    )
    db.add(relation)
    await db.flush()
    await db.refresh(relation)

    await db.execute(
        select(WordRelation)
        .where(WordRelation.id == relation.id)
        .options(selectinload(WordRelation.related_word))
    )
    result = await db.execute(
        select(WordRelation)
        .where(WordRelation.id == relation.id)
        .options(selectinload(WordRelation.related_word))
    )
    r = result.scalar_one()

    return WordRelationResponse(
        id=r.id,
        word_id=r.word_id,
        related_word_id=r.related_word_id,
        relation_type=r.relation_type,
        related_word=r.related_word.word,
        related_phonetic=r.related_word.phonetic,
        related_definition=r.related_word.definition,
        related_part_of_speech=r.related_word.part_of_speech,
    )


@router.delete("/{relation_id}", status_code=204)
async def delete_word_relation(
    relation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    relation = (await db.execute(
        select(WordRelation).where(WordRelation.id == relation_id)
    )).scalar_one_or_none()

    if not relation:
        raise HTTPException(status_code=404, detail="Relation not found")

    await db.delete(relation)
    await db.flush()
