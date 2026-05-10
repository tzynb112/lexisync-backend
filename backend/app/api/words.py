import csv
import io
import json
import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy import select, func, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.word import Word
from app.models.review import WordRecord

from app.schemas.word import WordCreate, WordResponse, WordImport, BatchWordIds, BatchTagRequest, BatchOperationResult, WordDetailResponse, PaginatedWordResponse

router = APIRouter(prefix="/api/words", tags=["Word Management"])

# ==================== 系统级单词分类 API (必须在动态路由 /{word_id} 之前定义) ====================

from app.models.word import WordCategory, WordCategoryLink
from pydantic import BaseModel

class CategoryResponse(BaseModel):
    id: str
    name: str
    description: str | None
    color: str
    icon: str | None
    word_count: int

class CategoryDetailResponse(CategoryResponse):
    words: list[WordResponse]

@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取所有系统级单词分类"""
    result = await db.execute(
        select(WordCategory)
        .where(WordCategory.is_active == True)
        .order_by(WordCategory.display_order)
    )
    categories = result.scalars().all()

    response = []
    for cat in categories:
        word_count = (
            await db.execute(
                select(func.count(WordCategoryLink.id))
                .where(WordCategoryLink.category_id == cat.id)
            )
        ).scalar() or 0

        response.append(CategoryResponse(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            color=cat.color,
            icon=cat.icon,
            word_count=word_count,
        ))
    return response


@router.get("/categories/{category_id}", response_model=CategoryDetailResponse)
async def get_category_detail(
    category_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取某个分类下的单词列表"""
    result = await db.execute(
        select(WordCategory).where(WordCategory.id == category_id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="分类未找到")

    # 获取单词总数
    total = (
        await db.execute(
            select(func.count(WordCategoryLink.id))
            .where(WordCategoryLink.category_id == category_id)
        )
    ).scalar() or 0

    # 获取单词列表
    word_result = await db.execute(
        select(Word)
        .join(WordCategoryLink, WordCategoryLink.word_id == Word.id)
        .where(WordCategoryLink.category_id == category_id)
        .order_by(Word.word)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    words = word_result.scalars().all()

    return CategoryDetailResponse(
        id=category.id,
        name=category.name,
        description=category.description,
        color=category.color,
        icon=category.icon,
        word_count=total,
        words=[
            WordResponse(
                id=w.id,
                word=w.word,
                phonetic=w.phonetic,
                definition=w.definition,
                part_of_speech=w.part_of_speech,
                etymology=w.etymology,
                example_sentence=w.example_sentence,
                sentence_cn=w.sentence_cn,
                language=w.language,
                created_at=w.created_at.isoformat(),
            )
            for w in words
        ],
    )


@router.post("/categories/link", response_model=dict)
async def add_word_to_category(
    word_id: str = Query(..., description="单词ID"),
    category_id: str = Query(..., description="分类ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """将单词关联到系统分类"""
    # 检查分类是否存在
    category = await db.execute(select(WordCategory).where(WordCategory.id == category_id))
    if not category.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="分类未找到")

    # 检查单词是否存在
    word = await db.execute(select(Word).where(Word.id == word_id))
    if not word.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="单词未找到")

    # 检查是否已关联
    existing = await db.execute(
        select(WordCategoryLink).where(
            WordCategoryLink.word_id == word_id,
            WordCategoryLink.category_id == category_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"message": "已关联", "word_id": word_id, "category_id": category_id}

    link = WordCategoryLink(word_id=word_id, category_id=category_id)
    db.add(link)
    await db.flush()
    return {"message": "关联成功", "word_id": word_id, "category_id": category_id}


class BatchLinkRequest(BaseModel):
    word_ids: list[str]
    category_id: str


@router.post("/categories/batch-link", response_model=dict)
async def batch_add_words_to_category(
    payload: BatchLinkRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = (await db.execute(
        select(WordCategory).where(WordCategory.id == payload.category_id)
    )).scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="分类未找到")

    existing_word_ids = {
        row[0] for row in (await db.execute(
            select(WordCategoryLink.word_id).where(
                WordCategoryLink.word_id.in_(payload.word_ids),
                WordCategoryLink.category_id == payload.category_id,
            )
        )).all()
    }

    new_ids = [wid for wid in payload.word_ids if wid not in existing_word_ids]
    for wid in new_ids:
        db.add(WordCategoryLink(word_id=wid, category_id=payload.category_id))

    await db.flush()
    return {"linked": len(new_ids), "skipped": len(existing_word_ids), "total": len(payload.word_ids)}


@router.post("", response_model=WordResponse, status_code=status.HTTP_201_CREATED)
async def create_word(
    payload: WordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(select(Word).where(Word.word == payload.word))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Word already exists")

    word = Word(**payload.model_dump())
    db.add(word)
    await db.flush()
    await db.refresh(word)
    return WordResponse.model_validate(word)


@router.get("", response_model=PaginatedWordResponse)
async def search_words(
    q: Optional[str] = Query(None, description="Search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    part_of_speech: Optional[str] = Query(None, description="Filter by part of speech"),
    tag_id: Optional[str] = Query(None, description="Filter by tag ID"),
    category_id: Optional[str] = Query(None, description="Filter by system category ID"),
    sort_by: Optional[str] = Query("word", description="Sort field: word, created_at"),
    sort_order: Optional[str] = Query("asc", description="Sort order: asc, desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Word)

    if q:
        query = query.where(
            or_(
                Word.word.ilike(f"%{q}%"),
                Word.definition.ilike(f"%{q}%"),
            )
        )

    if part_of_speech:
        query = query.where(Word.part_of_speech == part_of_speech)

    if category_id:
        query = query.join(WordCategoryLink, WordCategoryLink.word_id == Word.id).where(WordCategoryLink.category_id == category_id)
    elif tag_id:
        from app.models.tag import WordTag
        query = query.join(WordTag, WordTag.word_id == Word.id).where(WordTag.tag_id == tag_id)

    sort_col = Word.word if sort_by == "word" else Word.created_at
    if sort_order == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    result = await db.execute(
        query.offset((page - 1) * page_size).limit(page_size)
    )
    words = result.scalars().all()
    return PaginatedWordResponse(
        words=[WordResponse.model_validate(w) for w in words],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/word-of-the-day")
async def get_word_of_the_day(
    tag_id: str | None = Query(None, description="按标签筛选词汇组"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import random
    from datetime import datetime

    today = datetime.now().strftime("%Y-%m-%d")

    base_query = select(WordRecord, Word).join(Word, WordRecord.word_id == Word.id).where(WordRecord.user_id == current_user.id)

    if tag_id:
        from app.models.tag import WordTag
        base_query = base_query.join(WordTag, WordTag.word_id == Word.id).where(WordTag.tag_id == tag_id)

    result = await db.execute(base_query.order_by(func.random()).limit(1))
    row = result.one_or_none()

    if not row:
        result = await db.execute(
            select(Word).order_by(func.random()).limit(1)
        )
        word = result.scalar_one_or_none()
        if not word:
            raise HTTPException(status_code=404, detail="No words available")
        return {
            "word": word.word,
            "phonetic": word.phonetic,
            "definition": word.definition,
            "part_of_speech": word.part_of_speech,
            "example_sentence": word.example_sentence,
            "sentence_cn": getattr(word, 'sentence_cn', None),
            "word_id": str(word.id),
            "date": today,
        }

    record, word = row
    return {
        "word": word.word,
        "phonetic": word.phonetic,
        "definition": word.definition,
        "part_of_speech": word.part_of_speech,
        "example_sentence": word.example_sentence,
        "sentence_cn": getattr(word, 'sentence_cn', None),
        "word_id": str(word.id),
        "date": today,
    }


@router.get("/export/data")
async def export_words(
    format: str = Query("json", description="Export format: json or csv"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi.responses import StreamingResponse

    record_result = await db.execute(
        select(WordRecord, Word)
        .join(Word, WordRecord.word_id == Word.id)
        .where(WordRecord.user_id == current_user.id)
    )
    rows = record_result.all()

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["word", "phonetic", "definition", "part_of_speech", "repetitions", "easiness_factor", "interval", "correct_count", "incorrect_count", "next_review_at"])
        for r, w in rows:
            writer.writerow([
                w.word,
                w.phonetic or "",
                w.definition,
                w.part_of_speech or "",
                r.repetitions,
                round(r.easiness_factor, 2),
                r.interval,
                r.correct_count,
                r.incorrect_count,
                r.next_review_at.isoformat() if r.next_review_at else "",
            ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=lexisync_export.csv"},
        )

    data = []
    for r, w in rows:
        data.append({
            "word": w.word,
            "phonetic": w.phonetic,
            "definition": w.definition,
            "part_of_speech": w.part_of_speech,
            "repetitions": r.repetitions,
            "easiness_factor": round(r.easiness_factor, 2),
            "interval": r.interval,
            "correct_count": r.correct_count,
            "incorrect_count": r.incorrect_count,
            "next_review_at": r.next_review_at.isoformat() if r.next_review_at else None,
        })

    return StreamingResponse(
        iter([json.dumps(data, ensure_ascii=False, indent=2)]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=lexisync_export.json"},
    )


@router.get("/search", response_model=list[WordResponse])
async def search_words_quick(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Word)
        .where(
            or_(
                Word.word.ilike(f"{q}%"),
                Word.word.ilike(f"%{q}%"),
                Word.definition.ilike(f"%{q}%"),
            )
        )
        .order_by(
            func.case(
                (Word.word.ilike(f"{q}%"), 0),
                else_=1,
            ),
            Word.word,
        )
        .limit(limit)
    )
    words = result.scalars().all()

    return [
        WordResponse(
            id=w.id,
            word=w.word,
            phonetic=w.phonetic,
            definition=w.definition,
            part_of_speech=w.part_of_speech,
            etymology=w.etymology,
            example_sentence=w.example_sentence,
            sentence_cn=w.sentence_cn,
            language=w.language,
            created_at=w.created_at.isoformat(),
        )
        for w in words
    ]


@router.post("/import", response_model=list[WordResponse])
async def import_words(
    payload: WordImport,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    created_words = []
    for word_data in payload.words:
        existing = await db.execute(select(Word).where(Word.word == word_data.word))
        if existing.scalar_one_or_none():
            continue
        word = Word(**word_data.model_dump())
        db.add(word)
        created_words.append(word)

    await db.flush()
    for w in created_words:
        await db.refresh(w)
    return [WordResponse.model_validate(w) for w in created_words]


@router.post("/batch/start-learning", response_model=BatchOperationResult)
async def batch_start_learning(
    payload: BatchWordIds,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = 0
    skipped = 0
    failed = 0

    for word_id in payload.word_ids:
        try:
            word = (await db.execute(select(Word).where(Word.id == word_id))).scalar_one_or_none()
            if not word:
                failed += 1
                continue

            existing = (await db.execute(
                select(WordRecord).where(
                    WordRecord.user_id == current_user.id,
                    WordRecord.word_id == word_id,
                )
            )).scalar_one_or_none()

            if existing:
                skipped += 1
                continue

            from datetime import datetime
            record = WordRecord(
                user_id=current_user.id,
                word_id=word_id,
                next_review_at=datetime.now(),
            )
            db.add(record)
            success += 1
        except Exception:
            failed += 1

    await db.flush()
    return BatchOperationResult(success=success, skipped=skipped, failed=failed)


@router.post("/batch/add-tag", response_model=BatchOperationResult)
async def batch_add_tag(
    payload: BatchTagRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.tag import WordTag, Tag

    tag = (await db.execute(
        select(Tag).where(Tag.id == payload.tag_id, Tag.user_id == current_user.id)
    )).scalar_one_or_none()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    success = 0
    skipped = 0
    failed = 0

    for word_id in payload.word_ids:
        try:
            existing = (await db.execute(
                select(WordTag).where(
                    WordTag.word_id == word_id,
                    WordTag.tag_id == payload.tag_id,
                )
            )).scalar_one_or_none()

            if existing:
                skipped += 1
                continue

            word_tag = WordTag(word_id=word_id, tag_id=payload.tag_id)
            db.add(word_tag)
            success += 1
        except Exception:
            failed += 1

    await db.flush()
    return BatchOperationResult(success=success, skipped=skipped, failed=failed)


@router.post("/batch/favorite", response_model=BatchOperationResult)
async def batch_favorite(
    payload: BatchWordIds,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.tag import FavoriteWord

    success = 0
    skipped = 0
    failed = 0

    for word_id in payload.word_ids:
        try:
            existing = (await db.execute(
                select(FavoriteWord).where(
                    FavoriteWord.user_id == current_user.id,
                    FavoriteWord.word_id == word_id,
                )
            )).scalar_one_or_none()

            if existing:
                skipped += 1
                continue

            fav = FavoriteWord(user_id=current_user.id, word_id=word_id)
            db.add(fav)
            success += 1
        except Exception:
            failed += 1

    await db.flush()
    return BatchOperationResult(success=success, skipped=skipped, failed=failed)


@router.post("/import/csv", response_model=list[WordResponse])
async def import_words_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("gbk")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="Unable to decode file. Use UTF-8 or GBK encoding.")

    reader = csv.DictReader(io.StringIO(text))

    created_words = []
    for row in reader:
        word_text = row.get("word", "").strip()
        if not word_text:
            continue

        existing = await db.execute(select(Word).where(Word.word == word_text))
        if existing.scalar_one_or_none():
            continue

        word = Word(
            word=word_text,
            phonetic=row.get("phonetic", "").strip() or None,
            definition=row.get("definition", "").strip(),
            part_of_speech=row.get("part_of_speech", "").strip() or None,
            etymology=row.get("etymology", "").strip() or None,
            example_sentence=row.get("example_sentence", "").strip() or None,
            language=row.get("language", "en").strip(),
        )
        db.add(word)
        created_words.append(word)

    await db.flush()
    for w in created_words:
        await db.refresh(w)
    return [WordResponse.model_validate(w) for w in created_words]


@router.post("/import/json", response_model=list[WordResponse])
async def import_words_json(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Only JSON files are supported")

    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")

    if not isinstance(data, list):
        raise HTTPException(status_code=400, detail="JSON must be an array of word objects")

    created_words = []
    for item in data:
        word_text = item.get("word", "").strip()
        if not word_text:
            continue

        existing = await db.execute(select(Word).where(Word.word == word_text))
        if existing.scalar_one_or_none():
            continue

        word = Word(
            word=word_text,
            phonetic=item.get("phonetic", "").strip() or None,
            definition=item.get("definition", "").strip(),
            part_of_speech=item.get("part_of_speech", "").strip() or None,
            etymology=item.get("etymology", "").strip() or None,
            example_sentence=item.get("example_sentence", "").strip() or None,
            language=item.get("language", "en").strip(),
        )
        db.add(word)
        created_words.append(word)

    await db.flush()
    for w in created_words:
        await db.refresh(w)
    return [WordResponse.model_validate(w) for w in created_words]


@router.get("/{word_id}", response_model=WordResponse)
async def get_word(
    word_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Word).where(Word.id == word_id))
    word = result.scalar_one_or_none()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    return WordResponse.model_validate(word)


@router.get("/{word_id}/detail", response_model=WordDetailResponse)
async def get_word_detail(
    word_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.tag import WordTag, Tag, FavoriteWord
    from app.models.review import ReviewLog

    result = await db.execute(select(Word).where(Word.id == word_id))
    word = result.scalar_one_or_none()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    tag_result = await db.execute(
        select(Tag).join(WordTag, WordTag.tag_id == Tag.id)
        .where(WordTag.word_id == word_id, Tag.user_id == current_user.id)
    )
    tags = tag_result.scalars().all()
    tag_list = [{"id": str(t.id), "name": t.name, "color": t.color} for t in tags]

    fav_result = await db.execute(
        select(FavoriteWord).where(
            FavoriteWord.user_id == current_user.id,
            FavoriteWord.word_id == word_id,
        )
    )
    is_favorited = fav_result.scalar_one_or_none() is not None

    record_result = await db.execute(
        select(WordRecord).where(
            WordRecord.user_id == current_user.id,
            WordRecord.word_id == word_id,
        )
    )
    record = record_result.scalar_one_or_none()

    review_info = None
    if record:
        review_info = {
            "easiness_factor": record.easiness_factor,
            "interval": record.interval,
            "repetitions": record.repetitions,
            "next_review_at": record.next_review_at.isoformat() if record.next_review_at else None,
            "total_reviews": record.total_reviews,
            "correct_count": record.correct_count,
            "incorrect_count": record.incorrect_count,
        }

    review_history = []
    if record:
        log_result = await db.execute(
            select(ReviewLog).where(
                ReviewLog.user_id == current_user.id,
                ReviewLog.word_record_id == record.id,
            ).order_by(ReviewLog.reviewed_at.desc()).limit(20)
        )
        logs = log_result.scalars().all()
        review_history = [
            {
                "quality": log.quality,
                "interval_before": log.interval_before,
                "interval_after": log.interval_after,
                "easiness_factor_before": log.easiness_factor_before,
                "easiness_factor_after": log.easiness_factor_after,
                "reviewed_at": log.reviewed_at.isoformat() if log.reviewed_at else None,
            }
            for log in logs
        ]

    return WordDetailResponse(
        id=word.id,
        word=word.word,
        phonetic=word.phonetic,
        definition=word.definition,
        part_of_speech=word.part_of_speech,
        etymology=word.etymology,
        example_sentence=word.example_sentence,
        sentence_cn=word.sentence_cn,
        language=word.language,
        created_at=word.created_at,
        tags=tag_list,
        is_favorited=is_favorited,
        review_info=review_info,
        review_history=review_history,
    )


@router.delete("/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_word(
    word_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    word = await db.get(Word, word_id)
    if not word:
        raise HTTPException(status_code=404, detail="单词未找到")

    from app.models.tag import WordTag, FavoriteWord, WordNote

    await db.execute(delete(WordCategoryLink).where(WordCategoryLink.word_id == word_id))
    await db.execute(delete(WordTag).where(WordTag.word_id == word_id))
    await db.execute(delete(FavoriteWord).where(FavoriteWord.word_id == word_id))
    await db.execute(delete(WordNote).where(WordNote.word_id == word_id))

    await db.delete(word)
    await db.commit()
