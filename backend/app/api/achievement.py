from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.review import WordRecord, ReviewLog
from app.models.achievement import Achievement

router = APIRouter(prefix="/api/achievements", tags=["Achievements"])

ACHIEVEMENT_DEFS = [
    {"key": "first_word", "name": "初识词汇", "description": "开始学习第一个单词", "icon": "book-open", "tier": 1},
    {"key": "words_10", "name": "词汇学徒", "description": "累计学习10个单词", "icon": "book-marked", "tier": 1},
    {"key": "words_50", "name": "词汇达人", "description": "累计学习50个单词", "icon": "library", "tier": 2},
    {"key": "words_100", "name": "词汇大师", "description": "累计学习100个单词", "icon": "book-copy", "tier": 3},
    {"key": "first_review", "name": "初次复习", "description": "完成第一次复习", "icon": "brain", "tier": 1},
    {"key": "reviews_10", "name": "勤学苦练", "description": "累计完成10次复习", "icon": "zap", "tier": 1},
    {"key": "reviews_50", "name": "学无止境", "description": "累计完成50次复习", "icon": "flame", "tier": 2},
    {"key": "reviews_100", "name": "学霸降临", "description": "累计完成100次复习", "icon": "trophy", "tier": 3},
    {"key": "streak_3", "name": "三日坚持", "description": "连续学习3天", "icon": "calendar-check", "tier": 1},
    {"key": "streak_7", "name": "一周达人", "description": "连续学习7天", "icon": "calendar-heart", "tier": 2},
    {"key": "streak_30", "name": "月度之星", "description": "连续学习30天", "icon": "star", "tier": 3},
    {"key": "master_10", "name": "初窥门径", "description": "掌握10个单词", "icon": "graduation-cap", "tier": 2},
    {"key": "master_50", "name": "融会贯通", "description": "掌握50个单词", "icon": "award", "tier": 3},
    {"key": "perfect_day", "name": "完美一天", "description": "一天内正确率100%", "icon": "sparkles", "tier": 2},
    {"key": "tag_creator", "name": "分类达人", "description": "创建第一个标签", "icon": "tag", "tier": 1},
    {"key": "collector", "name": "收藏家", "description": "收藏10个单词", "icon": "heart", "tier": 1},
]


@router.get("")
async def get_achievements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Achievement).where(Achievement.user_id == current_user.id)
    )
    unlocked = result.scalars().all()
    unlocked_keys = {a.key: a for a in unlocked}

    all_achievements = []
    for ad in ACHIEVEMENT_DEFS:
        ua = unlocked_keys.get(ad["key"])
        all_achievements.append({
            "key": ad["key"],
            "name": ad["name"],
            "description": ad["description"],
            "icon": ad["icon"],
            "tier": ad["tier"],
            "unlocked": ua is not None,
            "unlocked_at": ua.unlocked_at.isoformat() if ua else None,
        })

    return all_achievements


@router.post("/check")
async def check_achievements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Achievement).where(Achievement.user_id == current_user.id)
    )
    existing = result.scalars().all()
    existing_keys = {a.key for a in existing}

    total_words = (await db.execute(
        select(func.count(WordRecord.id)).where(WordRecord.user_id == current_user.id)
    )).scalar() or 0

    total_reviews = (await db.execute(
        select(func.count(ReviewLog.id)).where(ReviewLog.user_id == current_user.id)
    )).scalar() or 0

    mastered = (await db.execute(
        select(func.count(WordRecord.id)).where(
            WordRecord.user_id == current_user.id,
            WordRecord.repetitions >= 5,
            WordRecord.easiness_factor >= 2.5,
        )
    )).scalar() or 0

    from app.models.tag import Tag, FavoriteWord
    tag_count = (await db.execute(
        select(func.count(Tag.id)).where(Tag.user_id == current_user.id)
    )).scalar() or 0

    fav_count = (await db.execute(
        select(func.count(FavoriteWord.id)).where(FavoriteWord.user_id == current_user.id)
    )).scalar() or 0

    from datetime import datetime, timedelta
    now = datetime.now()

    streak = 0
    for i in range(90):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = (await db.execute(
            select(func.count(ReviewLog.id)).where(
                ReviewLog.user_id == current_user.id,
                ReviewLog.reviewed_at >= day_start,
                ReviewLog.reviewed_at < day_end,
            )
        )).scalar() or 0
        if count > 0:
            streak += 1
        else:
            break

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    today_total = (await db.execute(
        select(func.count(ReviewLog.id)).where(
            ReviewLog.user_id == current_user.id,
            ReviewLog.reviewed_at >= today_start,
            ReviewLog.reviewed_at < today_end,
        )
    )).scalar() or 0
    today_correct = (await db.execute(
        select(func.count(ReviewLog.id)).where(
            ReviewLog.user_id == current_user.id,
            ReviewLog.reviewed_at >= today_start,
            ReviewLog.reviewed_at < today_end,
            ReviewLog.quality >= 3,
        )
    )).scalar() or 0

    checks = {
        "first_word": total_words >= 1,
        "words_10": total_words >= 10,
        "words_50": total_words >= 50,
        "words_100": total_words >= 100,
        "first_review": total_reviews >= 1,
        "reviews_10": total_reviews >= 10,
        "reviews_50": total_reviews >= 50,
        "reviews_100": total_reviews >= 100,
        "streak_3": streak >= 3,
        "streak_7": streak >= 7,
        "streak_30": streak >= 30,
        "master_10": mastered >= 10,
        "master_50": mastered >= 50,
        "perfect_day": today_total > 0 and today_correct == today_total,
        "tag_creator": tag_count >= 1,
        "collector": fav_count >= 10,
    }

    newly_unlocked = []
    for ad in ACHIEVEMENT_DEFS:
        key = ad["key"]
        if key not in existing_keys and checks.get(key, False):
            ach = Achievement(
                user_id=current_user.id,
                key=key,
                name=ad["name"],
                description=ad["description"],
                icon=ad["icon"],
                tier=ad["tier"],
            )
            db.add(ach)
            newly_unlocked.append({
                "key": key,
                "name": ad["name"],
                "description": ad["description"],
                "icon": ad["icon"],
                "tier": ad["tier"],
            })

    await db.flush()
    return {"newly_unlocked": newly_unlocked}
