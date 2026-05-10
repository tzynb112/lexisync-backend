import hashlib
from datetime import datetime, date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.study_plan import StudyPlan
from app.models.review import ReviewLog

router = APIRouter(prefix="/api/study-plans", tags=["Study Plans"])


class StudyPlanCreate(BaseModel):
    plan_date: str
    target_words: int = 20
    note: str | None = None


class StudyPlanUpdate(BaseModel):
    target_words: int | None = None
    note: str | None = None


class StudyPlanResponse(BaseModel):
    id: str
    plan_date: str
    target_words: int
    completed_words: int
    note: str | None
    created_at: str
    updated_at: str


class WeekPlanResponse(BaseModel):
    daily_goal: int
    plans: list[StudyPlanResponse]


@router.get("/week", response_model=WeekPlanResponse)
async def get_week_plans(
    start_date: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.tag import UserSettings

    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    user_settings = settings_result.scalar_one_or_none()
    daily_goal = user_settings.daily_goal if user_settings else 20

    if start_date:
        week_start = datetime.strptime(start_date, "%Y-%m-%d").date()
    else:
        today = datetime.now().date()
        week_start = today - timedelta(days=today.weekday())

    week_end = week_start + timedelta(days=6)

    result = await db.execute(
        select(StudyPlan)
        .where(
            and_(
                StudyPlan.user_id == current_user.id,
                StudyPlan.plan_date >= week_start,
                StudyPlan.plan_date <= week_end,
            )
        )
        .order_by(StudyPlan.plan_date)
    )
    plans = result.scalars().all()

    existing_dates = {p.plan_date for p in plans}
    all_plans = list(plans)

    for i in range(7):
        d = week_start + timedelta(days=i)
        if d not in existing_dates:
            deterministic_id = hashlib.md5(f"{current_user.id}:{d.isoformat()}".encode()).hexdigest()
            all_plans.append(StudyPlan(
                id=deterministic_id,
                user_id=current_user.id,
                plan_date=d,
                target_words=daily_goal,
                completed_words=0,
            ))

    all_plans.sort(key=lambda p: p.plan_date)

    response_plans = []
    for p in all_plans:
        day_start = datetime(p.plan_date.year, p.plan_date.month, p.plan_date.day)
        day_end = day_start + timedelta(days=1)

        completed = (
            await db.execute(
                select(func.count(ReviewLog.id)).where(
                    and_(
                        ReviewLog.user_id == current_user.id,
                        ReviewLog.reviewed_at >= day_start,
                        ReviewLog.reviewed_at < day_end,
                    )
                )
            )
        ).scalar() or 0

        response_plans.append(StudyPlanResponse(
            id=p.id,
            plan_date=p.plan_date.isoformat(),
            target_words=p.target_words,
            completed_words=completed,
            note=p.note,
            created_at=p.created_at.isoformat() if p.created_at else datetime.now().isoformat(),
            updated_at=p.updated_at.isoformat() if p.updated_at else datetime.now().isoformat(),
        ))

    return WeekPlanResponse(daily_goal=daily_goal, plans=response_plans)


@router.post("", response_model=StudyPlanResponse, status_code=201)
async def create_or_update_plan(
    payload: StudyPlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan_date = datetime.strptime(payload.plan_date, "%Y-%m-%d").date()

    existing = (await db.execute(
        select(StudyPlan).where(
            and_(
                StudyPlan.user_id == current_user.id,
                StudyPlan.plan_date == plan_date,
            )
        )
    )).scalar_one_or_none()

    if existing:
        existing.target_words = payload.target_words
        if payload.note is not None:
            existing.note = payload.note
        await db.flush()
        await db.refresh(existing)

        day_start = datetime(plan_date.year, plan_date.month, plan_date.day)
        day_end = day_start + timedelta(days=1)
        completed = (
            await db.execute(
                select(func.count(ReviewLog.id)).where(
                    and_(
                        ReviewLog.user_id == current_user.id,
                        ReviewLog.reviewed_at >= day_start,
                        ReviewLog.reviewed_at < day_end,
                    )
                )
            )
        ).scalar() or 0

        return StudyPlanResponse(
            id=existing.id,
            plan_date=existing.plan_date.isoformat(),
            target_words=existing.target_words,
            completed_words=completed,
            note=existing.note,
            created_at=existing.created_at.isoformat(),
            updated_at=existing.updated_at.isoformat(),
        )

    plan = StudyPlan(
        user_id=current_user.id,
        plan_date=plan_date,
        target_words=payload.target_words,
        note=payload.note,
    )
    db.add(plan)
    await db.flush()
    await db.refresh(plan)

    return StudyPlanResponse(
        id=plan.id,
        plan_date=plan.plan_date.isoformat(),
        target_words=plan.target_words,
        completed_words=0,
        note=plan.note,
        created_at=plan.created_at.isoformat(),
        updated_at=plan.updated_at.isoformat(),
    )
