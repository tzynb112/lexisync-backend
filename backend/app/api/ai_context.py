from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.word import Word
from app.models.review import WordRecord, ReviewLog
from app.services.ai_service import generate_context

router = APIRouter(prefix="/api/ai", tags=["AI Context"])


class ContextRequest(BaseModel):
    word_id: str


class ContextResponse(BaseModel):
    domain_0_example: str = ""
    domain_1_example: str = ""
    domain_0_name: str = ""
    domain_1_name: str = ""
    domain_0_color: str = "surface-500"
    domain_1_color: str = "surface-500"
    translation: str = ""


class ContextByTextRequest(BaseModel):
    word: str
    definition: str


@router.post("/context/{word_id}", response_model=ContextResponse)
async def get_ai_context(
    word_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Word).where(Word.id == word_id))
    word = result.scalar_one_or_none()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    from app.models.tag import UserSettings
    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    user_settings = settings_result.scalar_one_or_none()
    api_key = user_settings.openai_api_key if user_settings else None

    context = await generate_context(word.word, word.definition, api_key)
    return ContextResponse(**context)


@router.post("/context", response_model=ContextResponse)
async def get_ai_context_by_text(
    payload: ContextByTextRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.tag import UserSettings
    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    user_settings = settings_result.scalar_one_or_none()
    api_key = user_settings.openai_api_key if user_settings else None

    context = await generate_context(payload.word, payload.definition, api_key)
    return ContextResponse(**context)


@router.get("/recommendations")
async def get_recommendations(
    limit: int = Query(5, ge=1, le=20),
    tag_id: str | None = Query(None, description="按标签筛选词汇组"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.tag import WordTag

    weak_base = select(WordRecord.word_id).where(
        and_(
            WordRecord.user_id == current_user.id,
            WordRecord.incorrect_count > 0,
        )
    )

    if tag_id:
        weak_base = weak_base.join(Word, WordRecord.word_id == Word.id).join(WordTag, WordTag.word_id == Word.id).where(WordTag.tag_id == tag_id)

    weak_result = await db.execute(
        weak_base.order_by(WordRecord.incorrect_count.desc()).limit(10)
    )
    weak_word_ids = [row[0] for row in weak_result.all()]

    if weak_word_ids:
        weak_words_result = await db.execute(
            select(Word).where(Word.id.in_(weak_word_ids))
        )
        weak_words = weak_words_result.scalars().all()
        weak_parts = list({w.part_of_speech for w in weak_words if w.part_of_speech})
    else:
        weak_parts = []

    studied_base = select(WordRecord.word_id).where(WordRecord.user_id == current_user.id)

    if tag_id:
        studied_base = studied_base.join(Word, WordRecord.word_id == Word.id).join(WordTag, WordTag.word_id == Word.id).where(WordTag.tag_id == tag_id)

    studied_result = await db.execute(studied_base)
    studied_ids = {row[0] for row in studied_result.all()}

    if weak_parts:
        rec_base = select(Word).where(
            and_(
                Word.part_of_speech.in_(weak_parts),
                ~Word.id.in_(studied_ids) if studied_ids else True,
            )
        )
    else:
        rec_base = select(Word).where(
            ~Word.id.in_(studied_ids) if studied_ids else True
        )

    if tag_id:
        rec_base = rec_base.join(WordTag, WordTag.word_id == Word.id).where(WordTag.tag_id == tag_id)

    rec_result = await db.execute(
        rec_base.order_by(func.random()).limit(limit)
    )

    recommendations = list(rec_result.scalars().all())

    if len(recommendations) < limit:
        extra_base = select(Word)
        if tag_id:
            extra_base = extra_base.join(WordTag, WordTag.word_id == Word.id).where(WordTag.tag_id == tag_id)
        extra_result = await db.execute(
            extra_base.order_by(func.random()).limit(limit - len(recommendations))
        )
        extra_words = extra_result.scalars().all()
        existing_ids = {w.id for w in recommendations}
        recommendations.extend([w for w in extra_words if w.id not in existing_ids])

    return [
        {
            "id": str(w.id),
            "word": w.word,
            "phonetic": w.phonetic,
            "definition": w.definition,
            "part_of_speech": w.part_of_speech,
            "reason": "薄弱词性推荐" if weak_parts and w.part_of_speech in weak_parts else "探索新词",
        }
        for w in recommendations[:limit]
    ]
