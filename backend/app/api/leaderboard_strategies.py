from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from sqlalchemy import select, func, and_

from app.models.user import User
from app.models.review import ReviewLog, WordRecord
from app.models.tag import WordTag


class LeaderboardStrategy(ABC):
    """排行榜查询策略抽象基类"""

    @abstractmethod
    def build_leaderboard_query(
        self,
        since: Optional[datetime],
        limit: int,
        tag_id: Optional[str] = None,
    ):
        """构建排行榜查询"""
        pass

    @abstractmethod
    def build_user_score_query(
        self,
        user_id: str,
        since: Optional[datetime],
        tag_id: Optional[str] = None,
    ):
        """构建用户分数查询"""
        pass

    @abstractmethod
    def build_rank_query(self, user_score: int, since: Optional[datetime] = None, tag_id: Optional[str] = None):
        """构建排名计算查询（统计分数高于 user_score 的用户数）"""
        pass


class ReviewsStrategy(LeaderboardStrategy):
    """按复习次数排序的策略"""

    def build_leaderboard_query(
        self,
        since: Optional[datetime],
        limit: int,
        tag_id: Optional[str] = None,
    ):
        query = (
            select(User.id, User.username, func.count(ReviewLog.id).label("score"))
            .join(ReviewLog, ReviewLog.user_id == User.id)
            .where(User.is_active == True)
        )
        if since:
            query = query.where(ReviewLog.reviewed_at >= since)
        if tag_id:
            query = (
                query.join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                .where(
                    WordRecord.word_id.in_(
                        select(WordTag.word_id).where(WordTag.tag_id == tag_id)
                    )
                )
            )
        return (
            query.group_by(User.id, User.username)
            .order_by(func.count(ReviewLog.id).desc())
            .limit(limit)
        )

    def build_user_score_query(
        self,
        user_id: str,
        since: Optional[datetime],
        tag_id: Optional[str] = None,
    ):
        query = select(func.count(ReviewLog.id)).where(ReviewLog.user_id == user_id)
        if since:
            query = query.where(ReviewLog.reviewed_at >= since)
        if tag_id:
            query = (
                query.join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                .where(
                    WordRecord.word_id.in_(
                        select(WordTag.word_id).where(WordTag.tag_id == tag_id)
                    )
                )
            )
        return query

    def build_rank_query(self, user_score: int, since: Optional[datetime] = None, tag_id: Optional[str] = None):
        query = (
            select(User.id)
            .join(ReviewLog, ReviewLog.user_id == User.id)
            .where(User.is_active == True)
        )
        if since:
            query = query.where(ReviewLog.reviewed_at >= since)
        if tag_id:
            query = (
                query.join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                .where(
                    WordRecord.word_id.in_(
                        select(WordTag.word_id).where(WordTag.tag_id == tag_id)
                    )
                )
            )
        base = (
            query.group_by(User.id)
            .having(func.count(ReviewLog.id) > user_score)
        )
        return select(func.count()).select_from(base.subquery())


class MasteredStrategy(LeaderboardStrategy):
    """按掌握单词数排序的策略"""

    def build_leaderboard_query(
        self,
        since: Optional[datetime],
        limit: int,
        tag_id: Optional[str] = None,
    ):
        conditions = [
            WordRecord.repetitions >= 5,
            WordRecord.easiness_factor >= 2.5,
            User.is_active == True,
        ]
        if tag_id:
            conditions.append(
                WordRecord.word_id.in_(
                    select(WordTag.word_id).where(WordTag.tag_id == tag_id)
                )
            )
        base = (
            select(User.id, User.username, func.count(WordRecord.id).label("score"))
            .join(WordRecord, WordRecord.user_id == User.id)
            .where(and_(*conditions))
            .group_by(User.id, User.username)
            .order_by(func.count(WordRecord.id).desc())
            .limit(limit)
        )
        return base

    def build_user_score_query(
        self,
        user_id: str,
        since: Optional[datetime],
        tag_id: Optional[str] = None,
    ):
        conditions = [
            WordRecord.user_id == user_id,
            WordRecord.repetitions >= 5,
            WordRecord.easiness_factor >= 2.5,
        ]
        if tag_id:
            conditions.append(
                WordRecord.word_id.in_(
                    select(WordTag.word_id).where(WordTag.tag_id == tag_id)
                )
            )
        return select(func.count(WordRecord.id)).where(and_(*conditions))

    def build_rank_query(self, user_score: int, since: Optional[datetime] = None, tag_id: Optional[str] = None):
        conditions = [
            WordRecord.repetitions >= 5,
            WordRecord.easiness_factor >= 2.5,
            User.is_active == True,
        ]
        if tag_id:
            conditions.append(
                WordRecord.word_id.in_(
                    select(WordTag.word_id).where(WordTag.tag_id == tag_id)
                )
            )
        base = (
            select(User.id)
            .join(WordRecord, WordRecord.user_id == User.id)
            .where(and_(*conditions))
            .group_by(User.id)
            .having(func.count(WordRecord.id) > user_score)
        )
        return select(func.count()).select_from(base.subquery())


class StreakStrategy(LeaderboardStrategy):
    """按连续学习天数排序的策略（使用总复习次数）"""

    def build_leaderboard_query(
        self,
        since: Optional[datetime],
        limit: int,
        tag_id: Optional[str] = None,
    ):
        query = (
            select(User.id, User.username, func.count(ReviewLog.id).label("score"))
            .join(ReviewLog, ReviewLog.user_id == User.id)
            .where(User.is_active == True)
        )
        if since:
            query = query.where(ReviewLog.reviewed_at >= since)
        if tag_id:
            query = (
                query.join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                .where(
                    WordRecord.word_id.in_(
                        select(WordTag.word_id).where(WordTag.tag_id == tag_id)
                    )
                )
            )
        return (
            query.group_by(User.id, User.username)
            .order_by(func.count(ReviewLog.id).desc())
            .limit(limit)
        )

    def build_user_score_query(
        self,
        user_id: str,
        since: Optional[datetime],
        tag_id: Optional[str] = None,
    ):
        query = select(func.count(ReviewLog.id)).where(ReviewLog.user_id == user_id)
        if since:
            query = query.where(ReviewLog.reviewed_at >= since)
        if tag_id:
            query = (
                query.join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                .where(
                    WordRecord.word_id.in_(
                        select(WordTag.word_id).where(WordTag.tag_id == tag_id)
                    )
                )
            )
        return query

    def build_rank_query(self, user_score: int, since: Optional[datetime] = None, tag_id: Optional[str] = None):
        query = (
            select(User.id)
            .join(ReviewLog, ReviewLog.user_id == User.id)
            .where(User.is_active == True)
        )
        if since:
            query = query.where(ReviewLog.reviewed_at >= since)
        if tag_id:
            query = (
                query.join(WordRecord, ReviewLog.word_record_id == WordRecord.id)
                .where(
                    WordRecord.word_id.in_(
                        select(WordTag.word_id).where(WordTag.tag_id == tag_id)
                    )
                )
            )
        base = (
            query.group_by(User.id)
            .having(func.count(ReviewLog.id) > user_score)
        )
        return select(func.count()).select_from(base.subquery())


class LeaderboardStrategyFactory:
    """排行榜策略工厂"""

    _strategies = {
        "reviews": ReviewsStrategy,
        "mastered": MasteredStrategy,
        "streak": StreakStrategy,
    }

    @classmethod
    def get_strategy(cls, sort_by: str) -> LeaderboardStrategy:
        strategy_class = cls._strategies.get(sort_by)
        if not strategy_class:
            raise ValueError(f"Unknown sort_by: {sort_by}")
        return strategy_class()
