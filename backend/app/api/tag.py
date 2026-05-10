import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.word import Word
from app.models.tag import Tag, WordTag, FavoriteWord
from app.schemas.tag import (
    TagCreate,
    TagResponse,
    WordTagRequest,
    FavoriteToggle,
    UserSettingsUpdate,
    UserSettingsResponse,
)

router = APIRouter(prefix="/api/tags", tags=["Tags & Favorites"])


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    payload: TagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(Tag).where(
            and_(Tag.name == payload.name, or_(Tag.user_id == current_user.id, Tag.is_system == True))
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="标签已存在")

    tag = Tag(user_id=current_user.id, **payload.model_dump())
    db.add(tag)
    await db.flush()
    await db.refresh(tag)

    word_count = (
        await db.execute(
            select(func.count(WordTag.id)).where(WordTag.tag_id == tag.id)
        )
    ).scalar()

    return TagResponse(id=tag.id, name=tag.name, color=tag.color, word_count=word_count or 0, created_at=tag.created_at)


@router.get("", response_model=list[TagResponse])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 返回系统标签 + 当前用户的自定义标签
    result = await db.execute(
        select(Tag).where(
            or_(Tag.user_id == current_user.id, Tag.is_system == True)
        ).order_by(Tag.is_system.desc(), Tag.name)
    )
    tags = result.scalars().all()

    response = []
    for tag in tags:
        word_count = (
            await db.execute(
                select(func.count(WordTag.id)).where(WordTag.tag_id == tag.id)
            )
        ).scalar()
        response.append(
            TagResponse(
                id=tag.id, name=tag.name, color=tag.color,
                word_count=word_count or 0,
                is_system=tag.is_system,
                created_at=tag.created_at,
            )
        )
    return response


@router.post("/word-tag", status_code=status.HTTP_201_CREATED)
async def add_word_tag(
    payload: WordTagRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tag_result = await db.execute(
        select(Tag).where(
            and_(
                Tag.id == payload.tag_id,
                or_(Tag.user_id == current_user.id, Tag.is_system == True),
            )
        )
    )
    tag = tag_result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="标签未找到")

    existing = await db.execute(
        select(WordTag).where(
            and_(WordTag.word_id == payload.word_id, WordTag.tag_id == payload.tag_id)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="该单词已有此标签")

    word_tag = WordTag(word_id=payload.word_id, tag_id=payload.tag_id)
    db.add(word_tag)
    return {"detail": "标签添加成功"}


@router.delete("/word-tag", status_code=status.HTTP_204_NO_CONTENT)
async def remove_word_tag(
    payload: WordTagRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tag_result = await db.execute(
        select(Tag).where(
            and_(
                Tag.id == payload.tag_id,
                or_(Tag.user_id == current_user.id, Tag.is_system == True),
            )
        )
    )
    tag = tag_result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="标签未找到")

    result = await db.execute(
        select(WordTag).where(
            and_(WordTag.word_id == payload.word_id, WordTag.tag_id == payload.tag_id)
        )
    )
    word_tag = result.scalar_one_or_none()
    if not word_tag:
        raise HTTPException(status_code=404, detail="标签关联未找到")
    await db.delete(word_tag)


@router.post("/favorite", status_code=status.HTTP_201_CREATED)
async def toggle_favorite(
    payload: FavoriteToggle,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(FavoriteWord).where(
            and_(
                FavoriteWord.user_id == current_user.id,
                FavoriteWord.word_id == payload.word_id,
            )
        )
    )
    fav = existing.scalar_one_or_none()
    if fav:
        await db.delete(fav)
        return {"favorited": False}
    else:
        favorite = FavoriteWord(user_id=current_user.id, word_id=payload.word_id)
        db.add(favorite)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
        return {"favorited": True}


@router.get("/favorites", response_model=list[dict])
async def list_favorites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FavoriteWord)
        .where(FavoriteWord.user_id == current_user.id)
        .order_by(FavoriteWord.created_at.desc())
    )
    favorites = result.scalars().all()

    response = []
    for fav in favorites:
        word_result = await db.execute(select(Word).where(Word.id == fav.word_id))
        word = word_result.scalar_one_or_none()
        if word:
            response.append({
                "id": str(fav.id),
                "word_id": str(word.id),
                "word": word.word,
                "phonetic": word.phonetic,
                "definition": word.definition,
                "part_of_speech": word.part_of_speech,
                "created_at": fav.created_at.isoformat(),
            })
    return response


@router.get("/is-favorite/{word_id}")
async def is_favorite(
    word_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FavoriteWord).where(
            and_(
                FavoriteWord.user_id == current_user.id,
                FavoriteWord.word_id == word_id,
            )
        )
    )
    return {"is_favorite": result.scalar_one_or_none() is not None}


@router.get("/settings", response_model=UserSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.tag import UserSettings

    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        await db.flush()
        await db.refresh(settings)
    response = UserSettingsResponse.model_validate(settings)
    if response.openai_api_key:
        key = response.openai_api_key
        response.openai_api_key = key[:4] + '*' * (len(key) - 4) if len(key) > 8 else '****'
    return response


@router.put("/settings", response_model=UserSettingsResponse)
async def update_settings(
    payload: UserSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.tag import UserSettings

    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        await db.flush()
        await db.refresh(settings)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    await db.flush()
    await db.refresh(settings)
    response = UserSettingsResponse.model_validate(settings)
    if response.openai_api_key:
        key = response.openai_api_key
        response.openai_api_key = key[:4] + '*' * (len(key) - 4) if len(key) > 8 else '****'
    return response


@router.get("/stats")
async def get_tag_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(
            Tag.id,
            Tag.name,
            Tag.color,
            func.count(WordTag.word_id).label("word_count"),
        )
        .outerjoin(WordTag, and_(WordTag.tag_id == Tag.id))
        .where(or_(Tag.user_id == current_user.id, Tag.is_system == True))
        .group_by(Tag.id, Tag.name, Tag.color)
        .order_by(func.count(WordTag.word_id).desc())
    )
    return [
        {
            "id": str(row.id),
            "name": row.name,
            "color": row.color,
            "word_count": row.word_count,
        }
        for row in result.all()
    ]


# ==================== 动态路径路由放在最后 ====================

@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Tag).where(and_(Tag.id == tag_id, Tag.user_id == current_user.id))
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="标签未找到")
    if tag.is_system:
        raise HTTPException(status_code=403, detail="系统标签不可删除")
    await db.delete(tag)


@router.put("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: str,
    payload: TagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Tag).where(and_(Tag.id == tag_id, Tag.user_id == current_user.id))
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="标签未找到")
    if tag.is_system:
        raise HTTPException(status_code=403, detail="系统标签不可修改")

    duplicate = await db.execute(
        select(Tag).where(
            and_(
                Tag.name == payload.name,
                Tag.id != tag_id,
                or_(Tag.user_id == current_user.id, Tag.is_system == True),
            )
        )
    )
    if duplicate.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="标签名已存在")

    tag.name = payload.name
    if payload.color:
        tag.color = payload.color

    word_count = (
        await db.execute(
            select(func.count(WordTag.id)).where(WordTag.tag_id == tag.id)
        )
    ).scalar()

    await db.flush()
    await db.refresh(tag)

    return TagResponse(
        id=tag.id, name=tag.name, color=tag.color,
        word_count=word_count or 0, created_at=tag.created_at,
    )
