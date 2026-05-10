from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.api.leaderboard_strategies import LeaderboardStrategyFactory

router = APIRouter(prefix="/api/leaderboard", tags=["Leaderboard"])


@router.get("")
async def get_leaderboard(
    period: str = Query("week", pattern="^(week|month|all)$"),
    sort_by: str = Query("reviews", pattern="^(reviews|streak|mastered)$"),
    limit: int = Query(20, ge=5, le=50),
    tag_id: str | None = Query(None, description="按标签筛选词汇组"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now()

    if period == "week":
        since = now - timedelta(days=7)
    elif period == "month":
        since = now - timedelta(days=30)
    else:
        since = None

    strategy = LeaderboardStrategyFactory.get_strategy(sort_by)

    result = await db.execute(strategy.build_leaderboard_query(since, limit, tag_id))

    leaderboard = []
    for rank, row in enumerate(result.all(), 1):
        leaderboard.append({
            "rank": rank,
            "user_id": str(row.id),
            "username": row.username,
            "score": row.score,
            "is_current_user": row.id == current_user.id,
        })

    current_user_rank = None
    for entry in leaderboard:
        if entry["is_current_user"]:
            current_user_rank = entry["rank"]
            break

    if current_user_rank is None:
        user_score_result = await db.execute(
            strategy.build_user_score_query(current_user.id, since, tag_id)
        )
        user_score = user_score_result.scalar() or 0

        rank_result = (
            await db.execute(
                strategy.build_rank_query(user_score, since, tag_id)
            )
        ).scalar() or 0

        current_user_rank = rank_result + 1

    return {
        "leaderboard": leaderboard,
        "current_user_rank": current_user_rank,
        "period": period,
        "sort_by": sort_by,
    }
