import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.tag import WordNote

router = APIRouter(prefix="/api/word-notes", tags=["Word Notes"])


class WordNoteCreate(BaseModel):
    word_id: str
    content: str


class WordNoteUpdate(BaseModel):
    content: str


class WordNoteResponse(BaseModel):
    id: str
    word_id: str
    content: str
    created_at: str
    updated_at: str


@router.get("/{word_id}", response_model=list[WordNoteResponse])
async def get_word_notes(
    word_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WordNote).where(
            WordNote.user_id == current_user.id,
            WordNote.word_id == word_id,
        ).order_by(WordNote.created_at.desc())
    )
    notes = result.scalars().all()
    return [
        WordNoteResponse(
            id=n.id,
            word_id=n.word_id,
            content=n.content,
            created_at=n.created_at.isoformat(),
            updated_at=n.updated_at.isoformat(),
        )
        for n in notes
    ]


@router.post("", response_model=WordNoteResponse, status_code=201)
async def create_word_note(
    payload: WordNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = WordNote(
        user_id=current_user.id,
        word_id=payload.word_id,
        content=payload.content,
    )
    db.add(note)
    await db.flush()
    await db.refresh(note)
    return WordNoteResponse(
        id=note.id,
        word_id=note.word_id,
        content=note.content,
        created_at=note.created_at.isoformat(),
        updated_at=note.updated_at.isoformat(),
    )


@router.put("/{note_id}", response_model=WordNoteResponse)
async def update_word_note(
    note_id: str,
    payload: WordNoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WordNote).where(
            WordNote.id == note_id,
            WordNote.user_id == current_user.id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    note.content = payload.content
    await db.flush()
    await db.refresh(note)
    return WordNoteResponse(
        id=note.id,
        word_id=note.word_id,
        content=note.content,
        created_at=note.created_at.isoformat(),
        updated_at=note.updated_at.isoformat(),
    )


@router.delete("/{note_id}")
async def delete_word_note(
    note_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WordNote).where(
            WordNote.id == note_id,
            WordNote.user_id == current_user.id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    await db.delete(note)
    await db.flush()
    return {"detail": "Note deleted"}
