import random
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, load_only

from app.core.deps import get_current_user
from app.core.sm2 import calculate_sm2, is_due_for_review
from app.database import get_db
from app.models.user import User
from app.models.word import Word, WordCategoryLink
from app.models.review import WordRecord, ReviewLog
from app.models.tag import UserSettings, WordTag
from app.schemas.review import (
    ReviewFeedback,
    ReviewFeedbackResponse,
    DueWordResponse,
    DashboardStats,
    ChoiceTestQuestion,
    SpellingTestQuestion,
    TestFeedback,
    DetailedStats,
)
from app.schemas.word import WordResponse

router = APIRouter(prefix="/api/review", tags=["Review"])


@router.get("/due", response_model=list[DueWordResponse])
async def get_due_words(
    limit: int = Query(20, ge=1, le=100),
    tag_id: str | None = Query(None, description="按标签筛选词汇组"),
    category_id: str | None = Query(None, description="按系统分类筛选"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now()

    if category_id:
        query = (
            select(WordRecord, Word)
            .join(Word, WordRecord.word_id == Word.id)
            .join(WordCategoryLink, WordCategoryLink.word_id == Word.id)
            .where(
                and_(
                    WordRecord.user_id == current_user.id,
                    WordRecord.next_review_at <= now,
                    WordCategoryLink.category_id == category_id,
                )
            )
            .order_by(WordRecord.next_review_at)
            .limit(limit)
        )
    elif tag_id:
        query = (
            select(WordRecord, Word)
            .join(Word, WordRecord.word_id == Word.id)
            .join(WordTag, WordTag.word_id == Word.id)
            .where(
                and_(
                    WordRecord.user_id == current_user.id,
                    WordRecord.next_review_at <= now,
                    WordTag.tag_id == tag_id,
                )
            )
            .order_by(WordRecord.next_review_at)
            .limit(limit)
        )
    else:
        query = (
            select(WordRecord, Word)
            .join(Word, WordRecord.word_id == Word.id)
            .where(
                and_(
                    WordRecord.user_id == current_user.id,
                    WordRecord.next_review_at <= now,
                )
            )
            .order_by(WordRecord.next_review_at)
            .limit(limit)
        )

    result = await db.execute(query)
    rows = result.all()
    return [
        DueWordResponse(
            word_record_id=record.id,
            word=WordResponse.model_validate(word),
            easiness_factor=record.easiness_factor,
            interval=record.interval,
            repetitions=record.repetitions,
            next_review_at=record.next_review_at,
        )
        for record, word in rows
    ]


@router.post("/feedback", response_model=ReviewFeedbackResponse)
async def submit_review_feedback(
    payload: ReviewFeedback,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WordRecord, Word)
        .join(Word, WordRecord.word_id == Word.id)
        .where(
            and_(
                WordRecord.id == payload.word_record_id,
                WordRecord.user_id == current_user.id,
            )
        )
        .with_for_update()
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="单词记录未找到")
    record, word = row

    if not 0 <= payload.quality <= 5:
        raise HTTPException(status_code=400, detail="质量分数必须在0到5之间")

    sm2_result = calculate_sm2(
        quality=payload.quality,
        previous_interval=record.interval,
        previous_easiness_factor=record.easiness_factor,
        previous_repetitions=record.repetitions,
    )

    review_log = ReviewLog(
        user_id=current_user.id,
        word_record_id=record.id,
        quality=payload.quality,
        interval_before=record.interval,
        interval_after=sm2_result.interval,
        easiness_factor_before=record.easiness_factor,
        easiness_factor_after=sm2_result.easiness_factor,
        repetitions_before=record.repetitions,
        repetitions_after=sm2_result.repetitions,
    )
    db.add(review_log)

    record.interval = sm2_result.interval
    record.easiness_factor = sm2_result.easiness_factor
    record.repetitions = sm2_result.repetitions
    record.next_review_at = sm2_result.next_review_at
    record.total_reviews += 1

    if payload.quality >= 3:
        record.correct_count += 1
    else:
        record.incorrect_count += 1

    await db.flush()
    await db.refresh(record)

    return ReviewFeedbackResponse(
        word_record_id=record.id,
        word=WordResponse.model_validate(word),
        interval=record.interval,
        easiness_factor=record.easiness_factor,
        repetitions=record.repetitions,
        next_review_at=record.next_review_at,
    )


@router.post("/test-feedback", response_model=ReviewFeedbackResponse)
async def submit_test_feedback(
    payload: TestFeedback,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WordRecord, Word)
        .join(Word, WordRecord.word_id == Word.id)
        .where(
            and_(
                WordRecord.id == payload.word_record_id,
                WordRecord.user_id == current_user.id,
            )
        )
        .with_for_update()
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="单词记录未找到")
    record, word = row

    quality = 5 if payload.correct else 1

    sm2_result = calculate_sm2(
        quality=quality,
        previous_interval=record.interval,
        previous_easiness_factor=record.easiness_factor,
        previous_repetitions=record.repetitions,
    )

    review_log = ReviewLog(
        user_id=current_user.id,
        word_record_id=record.id,
        quality=quality,
        interval_before=record.interval,
        interval_after=sm2_result.interval,
        easiness_factor_before=record.easiness_factor,
        easiness_factor_after=sm2_result.easiness_factor,
        repetitions_before=record.repetitions,
        repetitions_after=sm2_result.repetitions,
    )
    db.add(review_log)

    record.interval = sm2_result.interval
    record.easiness_factor = sm2_result.easiness_factor
    record.repetitions = sm2_result.repetitions
    record.next_review_at = sm2_result.next_review_at
    record.total_reviews += 1

    if payload.correct:
        record.correct_count += 1
    else:
        record.incorrect_count += 1

    await db.flush()
    await db.refresh(record)

    return ReviewFeedbackResponse(
        word_record_id=record.id,
        word=WordResponse.model_validate(word),
        interval=record.interval,
        easiness_factor=record.easiness_factor,
        repetitions=record.repetitions,
        next_review_at=record.next_review_at,
    )


@router.post("/words/{word_id}/start", response_model=DueWordResponse)
async def start_learning_word(
    word_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    word_result = await db.execute(select(Word).where(Word.id == word_id))
    word = word_result.scalar_one_or_none()
    if not word:
        raise HTTPException(status_code=404, detail="单词未找到")

    existing = await db.execute(
        select(WordRecord).where(
            and_(
                WordRecord.user_id == current_user.id,
                WordRecord.word_id == word_id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="已在学习此单词")

    record = WordRecord(
        user_id=current_user.id,
        word_id=word_id,
        easiness_factor=2.5,
        interval=0,
        repetitions=0,
        next_review_at=datetime.now(),
    )
    db.add(record)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="已在学习此单词")
    await db.refresh(record)

    return DueWordResponse(
        word_record_id=record.id,
        word=WordResponse.model_validate(word),
        easiness_factor=record.easiness_factor,
        interval=record.interval,
        repetitions=record.repetitions,
        next_review_at=record.next_review_at,
    )


@router.post("/start-all", response_model=dict)
async def start_learning_all_words(
    tag_id: str | None = Query(None, description="按标签筛选词汇组"),
    category_id: str | None = Query(None, description="按系统分类筛选"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_query = select(Word)

    if category_id:
        base_query = base_query.join(WordCategoryLink, WordCategoryLink.word_id == Word.id).where(WordCategoryLink.category_id == category_id)
    elif tag_id:
        from app.models.tag import WordTag
        base_query = base_query.join(WordTag, WordTag.word_id == Word.id).where(WordTag.tag_id == tag_id)

    result = await db.execute(base_query)
    all_words = result.scalars().all()

    existing_result = await db.execute(
        select(WordRecord.word_id).where(WordRecord.user_id == current_user.id)
    )
    existing_word_ids = {str(row[0]) for row in existing_result.all()}

    added_count = 0
    for word in all_words:
        if str(word.id) in existing_word_ids:
            continue
        record = WordRecord(
            user_id=current_user.id,
            word_id=word.id,
            easiness_factor=2.5,
            interval=0,
            repetitions=0,
            next_review_at=datetime.now(),
        )
        db.add(record)
        added_count += 1

    await db.flush()
    return {"added": added_count, "skipped": len(all_words) - added_count}


@router.get("/choice-test", response_model=list[ChoiceTestQuestion])
async def get_choice_test(
    limit: int = Query(10, ge=1, le=50),
    tag_id: str | None = Query(None),
    category_id: str | None = Query(None, description="按系统分类筛选"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now()

    if category_id:
        result = await db.execute(
            select(WordRecord, Word)
            .join(Word, WordRecord.word_id == Word.id)
            .join(WordCategoryLink, WordCategoryLink.word_id == Word.id)
            .where(
                and_(
                    WordRecord.user_id == current_user.id,
                    WordRecord.next_review_at <= now,
                    WordCategoryLink.category_id == category_id,
                )
            )
            .order_by(WordRecord.next_review_at)
            .limit(limit)
        )
    elif tag_id:
        result = await db.execute(
            select(WordRecord, Word)
            .join(Word, WordRecord.word_id == Word.id)
            .join(WordTag, WordTag.word_id == Word.id)
            .where(
                and_(
                    WordRecord.user_id == current_user.id,
                    WordRecord.next_review_at <= now,
                    WordTag.tag_id == tag_id,
                )
            )
            .order_by(WordRecord.next_review_at)
            .limit(limit)
        )
    else:
        result = await db.execute(
            select(WordRecord, Word)
            .join(Word, WordRecord.word_id == Word.id)
            .where(
                and_(
                    WordRecord.user_id == current_user.id,
                    WordRecord.next_review_at <= now,
                )
            )
            .order_by(WordRecord.next_review_at)
            .limit(limit)
        )
    rows = result.all()

    if not rows:
        return []

    all_words_result = await db.execute(select(Word))
    all_words = all_words_result.scalars().all()
    all_definitions = [w.definition for w in all_words if w.definition]

    questions = []
    for record, word in rows:
        wrong_options = random.sample(
            [d for d in all_definitions if d != word.definition],
            min(3, len(all_definitions) - 1) if len(all_definitions) > 1 else 0,
        )

        while len(wrong_options) < 3:
            wrong_options.append(f"（干扰项 {len(wrong_options) + 1}）")

        options = wrong_options[:3] + [word.definition]
        random.shuffle(options)

        questions.append(
            ChoiceTestQuestion(
                word_record_id=record.id,
                word=word.word,
                phonetic=word.phonetic,
                correct_definition=word.definition,
                options=options,
                example_sentence=word.example_sentence,
                sentence_cn=word.sentence_cn,
            )
        )

    return questions


@router.get("/spelling-test", response_model=list[SpellingTestQuestion])
async def get_spelling_test(
    limit: int = Query(10, ge=1, le=50),
    tag_id: str | None = Query(None),
    category_id: str | None = Query(None, description="按系统分类筛选"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now()

    if category_id:
        result = await db.execute(
            select(WordRecord, Word)
            .join(Word, WordRecord.word_id == Word.id)
            .join(WordCategoryLink, WordCategoryLink.word_id == Word.id)
            .where(
                and_(
                    WordRecord.user_id == current_user.id,
                    WordRecord.next_review_at <= now,
                    WordCategoryLink.category_id == category_id,
                )
            )
            .order_by(WordRecord.next_review_at)
            .limit(limit)
        )
    elif tag_id:
        result = await db.execute(
            select(WordRecord, Word)
            .join(Word, WordRecord.word_id == Word.id)
            .join(WordTag, WordTag.word_id == Word.id)
            .where(
                and_(
                    WordRecord.user_id == current_user.id,
                    WordRecord.next_review_at <= now,
                    WordTag.tag_id == tag_id,
                )
            )
            .order_by(WordRecord.next_review_at)
            .limit(limit)
        )
    else:
        result = await db.execute(
            select(WordRecord, Word)
            .join(Word, WordRecord.word_id == Word.id)
            .where(
                and_(
                    WordRecord.user_id == current_user.id,
                    WordRecord.next_review_at <= now,
                )
            )
            .order_by(WordRecord.next_review_at)
            .limit(limit)
        )
    rows = result.all()

    return [
        SpellingTestQuestion(
            word_record_id=record.id,
            definition=word.definition,
            part_of_speech=word.part_of_speech,
            phonetic=word.phonetic,
            example_sentence=word.example_sentence,
            sentence_cn=word.sentence_cn,
            answer=word.word,
        )
        for record, word in rows
    ]


def _make_filter_join(category_id: str | None, tag_id: str | None):
    """根据 category_id 或 tag_id 返回对应的 join 条件和 filter 条件"""
    if category_id:
        return (
            (WordCategoryLink.category_id == category_id, WordCategoryLink.word_id == Word.id),
            True,
        )
    elif tag_id:
        return (
            (WordTag.tag_id == tag_id, WordTag.word_id == Word.id),
            False,
        )
    return None, False


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    tag_id: str | None = Query(None, description="按标签筛选词汇组"),
    category_id: str | None = Query(None, description="按系统分类筛选"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now()
    is_category = bool(category_id)

    def get_join_conditions():
        if category_id:
            return (WordCategoryLink.category_id == category_id, WordCategoryLink.word_id == Word.id, WordRecord.word_id == Word.id)
        elif tag_id:
            return (WordTag.tag_id == tag_id, WordTag.word_id == Word.id, WordRecord.word_id == Word.id)
        return None

    join_conds = get_join_conditions()

    # due_count
    if join_conds:
        if is_category:
            due_count = (
                await db.execute(
                    select(func.count(WordRecord.id))
                    .join(Word, WordRecord.word_id == Word.id)
                    .join(WordCategoryLink, and_(*join_conds))
                    .where(
                        and_(
                            WordRecord.user_id == current_user.id,
                            WordRecord.next_review_at <= now,
                        )
                    )
                )
            ).scalar()
        else:
            due_count = (
                await db.execute(
                    select(func.count(WordRecord.id))
                    .join(Word, WordRecord.word_id == Word.id)
                    .join(WordTag, and_(*join_conds))
                    .where(
                        and_(
                            WordRecord.user_id == current_user.id,
                            WordRecord.next_review_at <= now,
                        )
                    )
                )
            ).scalar()
    else:
        due_count = (
            await db.execute(
                select(func.count(WordRecord.id)).where(
                    and_(
                        WordRecord.user_id == current_user.id,
                        WordRecord.next_review_at <= now,
                    )
                )
            )
        ).scalar()

    # total_records
    if join_conds:
        if is_category:
            total_records = (
                await db.execute(
                    select(func.count(WordRecord.id))
                    .join(Word, WordRecord.word_id == Word.id)
                    .join(WordCategoryLink, and_(*join_conds))
                    .where(WordRecord.user_id == current_user.id)
                )
            ).scalar()
        else:
            total_records = (
                await db.execute(
                    select(func.count(WordRecord.id))
                    .join(Word, WordRecord.word_id == Word.id)
                    .join(WordTag, and_(*join_conds))
                    .where(WordRecord.user_id == current_user.id)
                )
            ).scalar()
    else:
        total_records = (
            await db.execute(
                select(func.count(WordRecord.id)).where(
                    WordRecord.user_id == current_user.id
                )
            )
        ).scalar()

    # mastered
    if join_conds:
        if is_category:
            mastered = (
                await db.execute(
                    select(func.count(WordRecord.id))
                    .join(Word, WordRecord.word_id == Word.id)
                    .join(WordCategoryLink, and_(*join_conds))
                    .where(
                        and_(
                            WordRecord.user_id == current_user.id,
                            WordRecord.repetitions >= 5,
                            WordRecord.easiness_factor >= 2.5,
                        )
                    )
                )
            ).scalar()
        else:
            mastered = (
                await db.execute(
                    select(func.count(WordRecord.id))
                    .join(Word, WordRecord.word_id == Word.id)
                    .join(WordTag, and_(*join_conds))
                    .where(
                        and_(
                            WordRecord.user_id == current_user.id,
                            WordRecord.repetitions >= 5,
                            WordRecord.easiness_factor >= 2.5,
                        )
                    )
                )
            ).scalar()
    else:
        mastered = (
            await db.execute(
                select(func.count(WordRecord.id)).where(
                    and_(
                        WordRecord.user_id == current_user.id,
                        WordRecord.repetitions >= 5,
                        WordRecord.easiness_factor >= 2.5,
                    )
                )
            )
        ).scalar()

    # total_reviews
    if join_conds:
        if is_category:
            total_reviews = (
                await db.execute(
                    select(func.coalesce(func.sum(WordRecord.total_reviews), 0))
                    .join(Word, WordRecord.word_id == Word.id)
                    .join(WordCategoryLink, and_(*join_conds))
                    .where(WordRecord.user_id == current_user.id)
                )
            ).scalar()
        else:
            total_reviews = (
                await db.execute(
                    select(func.coalesce(func.sum(WordRecord.total_reviews), 0))
                    .join(Word, WordRecord.word_id == Word.id)
                    .join(WordTag, and_(*join_conds))
                    .where(WordRecord.user_id == current_user.id)
                )
            ).scalar()
    else:
        total_reviews = (
            await db.execute(
                select(func.coalesce(func.sum(WordRecord.total_reviews), 0)).where(
                    WordRecord.user_id == current_user.id
                )
            )
        ).scalar()

    thirty_days_ago = now - timedelta(days=29)
    heatmap_data = []
    for i in range(30):
        day = thirty_days_ago + timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        if join_conds:
            if is_category:
                count = (
                    await db.execute(
                        select(func.count(ReviewLog.id))
                        .join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                        .join(Word, WordRecord.word_id == Word.id)
                        .join(WordCategoryLink, and_(*join_conds))
                        .where(
                            and_(
                                ReviewLog.user_id == current_user.id,
                                ReviewLog.reviewed_at >= day_start,
                                ReviewLog.reviewed_at < day_end,
                            )
                        )
                    )
                ).scalar()
            else:
                count = (
                    await db.execute(
                        select(func.count(ReviewLog.id))
                        .join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                        .join(Word, WordRecord.word_id == Word.id)
                        .join(WordTag, and_(*join_conds))
                        .where(
                            and_(
                                ReviewLog.user_id == current_user.id,
                                ReviewLog.reviewed_at >= day_start,
                                ReviewLog.reviewed_at < day_end,
                            )
                        )
                    )
                ).scalar()
        else:
            count = (
                await db.execute(
                    select(func.count(ReviewLog.id)).where(
                        and_(
                            ReviewLog.user_id == current_user.id,
                            ReviewLog.reviewed_at >= day_start,
                            ReviewLog.reviewed_at < day_end,
                        )
                    )
                )
            ).scalar()

        heatmap_data.append({"date": day_start.isoformat(), "count": count})

    streak_days = 0
    check_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    while True:
        day_start = check_date - timedelta(days=1)
        day_end = check_date
        if join_conds:
            if is_category:
                count = (
                    await db.execute(
                        select(func.count(ReviewLog.id))
                        .join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                        .join(Word, WordRecord.word_id == Word.id)
                        .join(WordCategoryLink, and_(*join_conds))
                        .where(
                            and_(
                                ReviewLog.user_id == current_user.id,
                                ReviewLog.reviewed_at >= day_start,
                                ReviewLog.reviewed_at < day_end,
                            )
                        )
                    )
                ).scalar()
            else:
                count = (
                    await db.execute(
                        select(func.count(ReviewLog.id))
                        .join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                        .join(Word, WordRecord.word_id == Word.id)
                        .join(WordTag, and_(*join_conds))
                        .where(
                            and_(
                                ReviewLog.user_id == current_user.id,
                                ReviewLog.reviewed_at >= day_start,
                                ReviewLog.reviewed_at < day_end,
                            )
                        )
                    )
                ).scalar()
        else:
            count = (
                await db.execute(
                    select(func.count(ReviewLog.id)).where(
                        and_(
                            ReviewLog.user_id == current_user.id,
                            ReviewLog.reviewed_at >= day_start,
                            ReviewLog.reviewed_at < day_end,
                        )
                    )
                )
            ).scalar()
        if count > 0:
            streak_days += 1
            check_date = day_start
        else:
            break

    # today_reviews
    if join_conds:
        if is_category:
            today_reviews = (
                await db.execute(
                    select(func.count(ReviewLog.id))
                    .join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                    .join(Word, WordRecord.word_id == Word.id)
                    .join(WordCategoryLink, and_(*join_conds))
                    .where(
                        and_(
                            ReviewLog.user_id == current_user.id,
                            ReviewLog.reviewed_at >= now.replace(hour=0, minute=0, second=0, microsecond=0),
                        )
                    )
                )
            ).scalar()
        else:
            today_reviews = (
                await db.execute(
                    select(func.count(ReviewLog.id))
                    .join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                    .join(Word, WordRecord.word_id == Word.id)
                    .join(WordTag, and_(*join_conds))
                    .where(
                        and_(
                            ReviewLog.user_id == current_user.id,
                            ReviewLog.reviewed_at >= now.replace(hour=0, minute=0, second=0, microsecond=0),
                        )
                    )
                )
            ).scalar()
    else:
        today_reviews = (
            await db.execute(
                select(func.count(ReviewLog.id)).where(
                    and_(
                        ReviewLog.user_id == current_user.id,
                        ReviewLog.reviewed_at >= now.replace(hour=0, minute=0, second=0, microsecond=0),
                    )
                )
            )
        ).scalar()

    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = settings_result.scalar_one_or_none()
    daily_goal = settings.daily_goal if settings else 20

    not_started = 0
    if category_id:
        not_started_result = await db.execute(
            select(func.count(Word.id))
            .join(WordCategoryLink, WordCategoryLink.word_id == Word.id)
            .where(
                and_(
                    WordCategoryLink.category_id == category_id,
                    ~Word.id.in_(
                        select(WordRecord.word_id).where(
                            WordRecord.user_id == current_user.id
                        )
                    ),
                )
            )
        )
        not_started = not_started_result.scalar() or 0
    elif tag_id:
        not_started_result = await db.execute(
            select(func.count(Word.id))
            .join(WordTag, WordTag.word_id == Word.id)
            .where(
                and_(
                    WordTag.tag_id == tag_id,
                    ~Word.id.in_(
                        select(WordRecord.word_id).where(
                            WordRecord.user_id == current_user.id
                        )
                    ),
                )
            )
        )
        not_started = not_started_result.scalar() or 0
    else:
        not_started_result = await db.execute(
            select(func.count(Word.id)).where(
                ~Word.id.in_(
                    select(WordRecord.word_id).where(
                        WordRecord.user_id == current_user.id
                    )
                )
            )
        )
        not_started = not_started_result.scalar() or 0

    return DashboardStats(
        due_today=due_count or 0,
        mastered_words=mastered or 0,
        total_words=total_records or 0,
        not_started=not_started,
        total_reviews=total_reviews or 0,
        streak_days=streak_days,
        today_reviews=today_reviews or 0,
        heatmap_data=heatmap_data,
        daily_goal=daily_goal,
        daily_goal_progress=today_reviews or 0,
    )


@router.get("/detailed-stats", response_model=DetailedStats)
async def get_detailed_stats(
    days: int = Query(14, ge=7, le=90),
    tag_id: str | None = Query(None, description="按标签筛选词汇组"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now()

    def tag_join_rl():
        return (
            ReviewLog.word_record_id == WordRecord.id,
            WordRecord.word_id == Word.id,
            WordTag.word_id == Word.id,
            WordTag.tag_id == tag_id,
        )

    accuracy_trend = []
    for i in range(days - 1, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        if tag_id:
            total = (
                await db.execute(
                    select(func.count(ReviewLog.id))
                    .join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                    .join(Word, WordRecord.word_id == Word.id)
                    .join(WordTag, and_(*tag_join_rl()))
                    .where(
                        and_(
                            ReviewLog.user_id == current_user.id,
                            ReviewLog.reviewed_at >= day_start,
                            ReviewLog.reviewed_at < day_end,
                        )
                    )
                )
            ).scalar()

            correct = (
                await db.execute(
                    select(func.count(ReviewLog.id))
                    .join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                    .join(Word, WordRecord.word_id == Word.id)
                    .join(WordTag, and_(*tag_join_rl()))
                    .where(
                        and_(
                            ReviewLog.user_id == current_user.id,
                            ReviewLog.reviewed_at >= day_start,
                            ReviewLog.reviewed_at < day_end,
                            ReviewLog.quality >= 3,
                        )
                    )
                )
            ).scalar()
        else:
            total = (
                await db.execute(
                    select(func.count(ReviewLog.id)).where(
                        and_(
                            ReviewLog.user_id == current_user.id,
                            ReviewLog.reviewed_at >= day_start,
                            ReviewLog.reviewed_at < day_end,
                        )
                    )
                )
            ).scalar()

            correct = (
                await db.execute(
                    select(func.count(ReviewLog.id)).where(
                        and_(
                            ReviewLog.user_id == current_user.id,
                            ReviewLog.reviewed_at >= day_start,
                            ReviewLog.reviewed_at < day_end,
                            ReviewLog.quality >= 3,
                        )
                    )
                )
            ).scalar()

        accuracy = round((correct / total * 100), 1) if total > 0 else 0
        accuracy_trend.append({
            "date": day_start.strftime("%m/%d"),
            "accuracy": accuracy,
            "total": total or 0,
        })

    # mastery distribution
    def tag_join_wrd():
        return (
            WordRecord.word_id == Word.id,
            WordTag.word_id == Word.id,
            WordTag.tag_id == tag_id,
        )

    def make_query(conditions):
        if tag_id:
            return (
                select(func.count(WordRecord.id))
                .join(Word, WordRecord.word_id == Word.id)
                .join(WordTag, and_(*tag_join_wrd()))
                .where(and_(WordRecord.user_id == current_user.id, *conditions))
            )
        return (
            select(func.count(WordRecord.id)).where(
                and_(WordRecord.user_id == current_user.id, *conditions)
            )
        )

    new_words = (await db.execute(make_query([WordRecord.repetitions == 0]))).scalar()
    learning = (await db.execute(make_query([WordRecord.repetitions >= 1, WordRecord.repetitions < 3]))).scalar()
    familiar = (await db.execute(make_query([WordRecord.repetitions >= 3, WordRecord.repetitions < 5]))).scalar()
    mastered = (await db.execute(make_query([WordRecord.repetitions >= 5, WordRecord.easiness_factor >= 2.5]))).scalar()

    mastery_distribution = {
        "new_words": new_words or 0,
        "learning": learning or 0,
        "familiar": familiar or 0,
        "mastered": mastered or 0,
    }

    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = settings_result.scalar_one_or_none()
    daily_goal = settings.daily_goal if settings else 20

    if tag_id:
        today_reviews = (
            await db.execute(
                select(func.count(ReviewLog.id))
                .join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                .join(Word, WordRecord.word_id == Word.id)
                .join(WordTag, and_(*tag_join_rl()))
                .where(
                    and_(
                        ReviewLog.user_id == current_user.id,
                        ReviewLog.reviewed_at >= now.replace(hour=0, minute=0, second=0, microsecond=0),
                    )
                )
            )
        ).scalar()
    else:
        today_reviews = (
            await db.execute(
                select(func.count(ReviewLog.id)).where(
                    and_(
                        ReviewLog.user_id == current_user.id,
                        ReviewLog.reviewed_at >= now.replace(hour=0, minute=0, second=0, microsecond=0),
                    )
                )
            )
        ).scalar()

    daily_goal_progress = {
        "goal": daily_goal,
        "completed": today_reviews or 0,
        "percentage": round(min((today_reviews or 0) / daily_goal * 100, 100), 1),
    }

    recent_result = await db.execute(
        select(ReviewLog, WordRecord, Word)
        .join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
        .join(Word, WordRecord.word_id == Word.id)
        .where(ReviewLog.user_id == current_user.id)
        .order_by(ReviewLog.reviewed_at.desc())
        .limit(10)
    )
    recent_reviews = [
        {
            "word": word.word if word else "",
            "quality": log.quality,
            "reviewed_at": log.reviewed_at.isoformat(),
        }
        for log, record, word in recent_result.all()
    ]

    return DetailedStats(
        accuracy_trend=accuracy_trend,
        mastery_distribution=mastery_distribution,
        daily_goal_progress=daily_goal_progress,
        recent_reviews=recent_reviews,
    )


@router.get("/wrong-words")
async def get_wrong_words(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tag_id: str | None = Query(None, description="按标签筛选词汇组"),
    category_id: str | None = Query(None, description="按系统分类筛选"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subq = (
        select(
            ReviewLog.word_record_id,
            func.count(ReviewLog.id).label("wrong_count"),
            func.max(ReviewLog.reviewed_at).label("last_wrong_at"),
        )
        .where(
            and_(
                ReviewLog.user_id == current_user.id,
                ReviewLog.quality < 3,
            )
        )
        .group_by(ReviewLog.word_record_id)
        .subquery()
    )

    base_join = (
        select(WordRecord, subq.c.wrong_count, subq.c.last_wrong_at, Word)
        .join(subq, WordRecord.id == subq.c.word_record_id)
        .join(Word, WordRecord.word_id == Word.id)
        .where(WordRecord.user_id == current_user.id)
    )

    if category_id:
        base_join = (
            base_join
            .join(WordCategoryLink, WordCategoryLink.word_id == Word.id)
            .where(WordCategoryLink.category_id == category_id)
        )
    elif tag_id:
        from app.models.tag import WordTag
        base_join = (
            base_join
            .join(WordTag, WordTag.word_id == Word.id)
            .where(WordTag.tag_id == tag_id)
        )

    count_q = select(func.count()).select_from(base_join.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    result = await db.execute(
        base_join
        .order_by(subq.c.last_wrong_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    items = []
    for record, wrong_count, last_wrong_at, word in result.all():
        items.append({
            "word_record_id": str(record.id),
            "word_id": str(word.id),
            "word": word.word,
            "phonetic": word.phonetic,
            "definition": word.definition,
            "part_of_speech": word.part_of_speech,
            "wrong_count": wrong_count,
            "last_wrong_at": last_wrong_at.isoformat() if last_wrong_at else None,
            "easiness_factor": record.easiness_factor,
            "interval": record.interval,
            "repetitions": record.repetitions,
            "next_review_at": record.next_review_at.isoformat() if record.next_review_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/calendar")
async def get_calendar_data(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import calendar

    first_day = datetime(year, month, 1)
    if month == 12:
        last_day = datetime(year + 1, 1, 1)
    else:
        last_day = datetime(year, month + 1, 1)

    result = await db.execute(
        select(
            func.date(ReviewLog.reviewed_at).label("day"),
            func.count(ReviewLog.id).label("count"),
        )
        .where(
            and_(
                ReviewLog.user_id == current_user.id,
                ReviewLog.reviewed_at >= first_day,
                ReviewLog.reviewed_at < last_day,
            )
        )
        .group_by(func.date(ReviewLog.reviewed_at))
    )
    day_counts = {str(row.day): row.count for row in result.all()}

    cal = calendar.Calendar(firstweekday=0)
    weeks = []
    for week in cal.monthdatescalendar(year, month):
        week_data = []
        for d in week:
            date_str = d.isoformat()
            week_data.append({
                "date": date_str,
                "day": d.day,
                "month": d.month,
                "is_current_month": d.month == month,
                "count": day_counts.get(date_str, 0),
            })
        weeks.append(week_data)

    return {"year": year, "month": month, "weeks": weeks}
