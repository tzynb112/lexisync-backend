import uuid
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.study_plan import CustomStudyPlan

router = APIRouter(prefix="/api/custom-plans", tags=["Custom Study Plans"])


class CustomPlanCreate(BaseModel):
    title: str
    description: str | None = None
    tag_id: str | None = None
    target_words: int = 100
    start_date: str
    end_date: str
    daily_goal: int = 20


class CustomPlanUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    tag_id: str | None = None
    target_words: int | None = None
    start_date: str | None = None
    end_date: str | None = None
    daily_goal: int | None = None
    is_active: bool | None = None


class CustomPlanResponse(BaseModel):
    id: str
    title: str
    description: str | None
    tag_id: str | None
    tag_name: str | None
    target_words: int
    start_date: str
    end_date: str
    daily_goal: int
    completed_words: int
    is_active: bool
    progress_percent: int
    created_at: str
    updated_at: str


@router.get("", response_model=list[CustomPlanResponse])
async def list_custom_plans(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CustomStudyPlan)
        .where(CustomStudyPlan.user_id == current_user.id)
        .order_by(CustomStudyPlan.created_at.desc())
    )
    plans = result.scalars().all()

    response = []
    for plan in plans:
        tag_name = None
        if plan.tag_id:
            from app.models.tag import Tag
            tag_result = await db.execute(
                select(Tag.name).where(Tag.id == plan.tag_id)
            )
            tag_name = tag_result.scalar_one_or_none()

        progress = min(
            round((plan.completed_words / plan.target_words) * 100), 100
        ) if plan.target_words > 0 else 0

        response.append(CustomPlanResponse(
            id=plan.id,
            title=plan.title,
            description=plan.description,
            tag_id=plan.tag_id,
            tag_name=tag_name,
            target_words=plan.target_words,
            start_date=plan.start_date.isoformat(),
            end_date=plan.end_date.isoformat(),
            daily_goal=plan.daily_goal,
            completed_words=plan.completed_words,
            is_active=plan.is_active,
            progress_percent=progress,
            created_at=plan.created_at.isoformat(),
            updated_at=plan.updated_at.isoformat(),
        ))
    return response


@router.post("", response_model=CustomPlanResponse, status_code=201)
async def create_custom_plan(
    payload: CustomPlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start_date = datetime.strptime(payload.start_date, "%Y-%m-%d").date()
    end_date = datetime.strptime(payload.end_date, "%Y-%m-%d").date()

    if end_date < start_date:
        raise HTTPException(status_code=400, detail="结束日期不能早于开始日期")

    plan = CustomStudyPlan(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        tag_id=payload.tag_id,
        target_words=payload.target_words,
        start_date=start_date,
        end_date=end_date,
        daily_goal=payload.daily_goal,
    )
    db.add(plan)
    await db.flush()
    await db.refresh(plan)

    tag_name = None
    if plan.tag_id:
        from app.models.tag import Tag
        tag_result = await db.execute(
            select(Tag.name).where(Tag.id == plan.tag_id)
        )
        tag_name = tag_result.scalar_one_or_none()

    return CustomPlanResponse(
        id=plan.id,
        title=plan.title,
        description=plan.description,
        tag_id=plan.tag_id,
        tag_name=tag_name,
        target_words=plan.target_words,
        start_date=plan.start_date.isoformat(),
        end_date=plan.end_date.isoformat(),
        daily_goal=plan.daily_goal,
        completed_words=plan.completed_words,
        is_active=plan.is_active,
        progress_percent=0,
        created_at=plan.created_at.isoformat(),
        updated_at=plan.updated_at.isoformat(),
    )


@router.put("/{plan_id}", response_model=CustomPlanResponse)
async def update_custom_plan(
    plan_id: str,
    payload: CustomPlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CustomStudyPlan).where(
            and_(
                CustomStudyPlan.id == plan_id,
                CustomStudyPlan.user_id == current_user.id,
            )
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="计划未找到")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key in ("start_date", "end_date") and value:
            value = datetime.strptime(value, "%Y-%m-%d").date()
        setattr(plan, key, value)

    await db.flush()
    await db.refresh(plan)

    tag_name = None
    if plan.tag_id:
        from app.models.tag import Tag
        tag_result = await db.execute(
            select(Tag.name).where(Tag.id == plan.tag_id)
        )
        tag_name = tag_result.scalar_one_or_none()

    progress = min(
        round((plan.completed_words / plan.target_words) * 100), 100
    ) if plan.target_words > 0 else 0

    return CustomPlanResponse(
        id=plan.id,
        title=plan.title,
        description=plan.description,
        tag_id=plan.tag_id,
        tag_name=tag_name,
        target_words=plan.target_words,
        start_date=plan.start_date.isoformat(),
        end_date=plan.end_date.isoformat(),
        daily_goal=plan.daily_goal,
        completed_words=plan.completed_words,
        is_active=plan.is_active,
        progress_percent=progress,
        created_at=plan.created_at.isoformat(),
        updated_at=plan.updated_at.isoformat(),
    )


@router.delete("/{plan_id}", status_code=204)
async def delete_custom_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CustomStudyPlan).where(
            and_(
                CustomStudyPlan.id == plan_id,
                CustomStudyPlan.user_id == current_user.id,
            )
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="计划未找到")
    await db.delete(plan)


@router.post("/{plan_id}/progress", response_model=CustomPlanResponse)
async def update_plan_progress(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CustomStudyPlan).where(
            and_(
                CustomStudyPlan.id == plan_id,
                CustomStudyPlan.user_id == current_user.id,
            )
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="计划未找到")

    if plan.tag_id:
        from app.models.review import WordRecord, ReviewLog
        from app.models.tag import WordTag
        from datetime import timedelta
        completed = (
            await db.execute(
                select(func.count(func.distinct(ReviewLog.word_record_id))).where(
                    and_(
                        ReviewLog.user_id == current_user.id,
                        ReviewLog.reviewed_at >= plan.start_date,
                        ReviewLog.reviewed_at < plan.end_date + timedelta(days=1),
                        ReviewLog.word_record_id.in_(
                            select(WordRecord.id).join(WordTag, WordTag.word_id == WordRecord.word_id).where(WordTag.tag_id == plan.tag_id)
                        ),
                    )
                )
            )
        ).scalar() or 0
    else:
        from app.models.review import WordRecord, ReviewLog
        from datetime import timedelta
        completed = (
            await db.execute(
                select(func.count(func.distinct(ReviewLog.word_record_id))).where(
                    and_(
                        ReviewLog.user_id == current_user.id,
                        ReviewLog.reviewed_at >= plan.start_date,
                        ReviewLog.reviewed_at < plan.end_date + timedelta(days=1),
                    )
                )
            )
        ).scalar() or 0

    plan.completed_words = completed
    await db.flush()
    await db.refresh(plan)

    tag_name = None
    if plan.tag_id:
        from app.models.tag import Tag
        tag_result = await db.execute(
            select(Tag.name).where(Tag.id == plan.tag_id)
        )
        tag_name = tag_result.scalar_one_or_none()

    progress = min(
        round((plan.completed_words / plan.target_words) * 100), 100
    ) if plan.target_words > 0 else 0

    return CustomPlanResponse(
        id=plan.id,
        title=plan.title,
        description=plan.description,
        tag_id=plan.tag_id,
        tag_name=tag_name,
        target_words=plan.target_words,
        start_date=plan.start_date.isoformat(),
        end_date=plan.end_date.isoformat(),
        daily_goal=plan.daily_goal,
        completed_words=plan.completed_words,
        is_active=plan.is_active,
        progress_percent=progress,
        created_at=plan.created_at.isoformat(),
        updated_at=plan.updated_at.isoformat(),
    )
