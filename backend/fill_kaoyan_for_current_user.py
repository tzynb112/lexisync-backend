#!/usr/bin/env python3
"""
为当前登录用户的"考研词汇"标签，补充关联所有单词。
"""

import asyncio
import uuid
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.models.tag import Tag, WordTag
from app.models.word import Word


async def fill_for_user(user_id: str):
    async with async_session_factory() as db:
        # 1. 查找该用户的 "考研词汇" 标签
        result = await db.execute(
            select(Tag).where(
                and_(Tag.name == "考研词汇", Tag.user_id == user_id)
            ).limit(1)
        )
        kaoyan_tag = result.scalar_one_or_none()

        if not kaoyan_tag:
            print(f"用户 {user_id} 没有 '考研词汇' 标签")
            return

        print(f"找到标签: {kaoyan_tag.name} (ID: {kaoyan_tag.id}, 用户: {user_id})")

        # 2. 统计当前已关联的单词数
        count_result = await db.execute(
            select(func.count(WordTag.id)).where(WordTag.tag_id == kaoyan_tag.id)
        )
        current_count = count_result.scalar() or 0
        print(f"当前已关联 {current_count} 个单词")

        # 3. 查找所有未关联到该标签的单词
        subq = select(WordTag.word_id).where(WordTag.tag_id == kaoyan_tag.id).subquery()
        result = await db.execute(
            select(Word).where(Word.id.notin_(select(subq.c.word_id)))
        )
        words_to_add = result.scalars().all()

        if not words_to_add:
            print("所有单词已关联，无需补充")
            return

        print(f"需要补充关联 {len(words_to_add)} 个单词")

        # 4. 批量插入
        batch_size = 500
        total_added = 0
        for i in range(0, len(words_to_add), batch_size):
            batch = words_to_add[i:i + batch_size]
            for word in batch:
                word_tag = WordTag(
                    id=str(uuid.uuid4()),
                    word_id=word.id,
                    tag_id=kaoyan_tag.id,
                )
                db.add(word_tag)
            await db.flush()
            total_added += len(batch)
            print(f"  已处理 {total_added}/{len(words_to_add)} ...")

        await db.commit()
        print(f"\n完成！共补充关联 {total_added} 个单词")
        print(f"标签现在共有 {current_count + total_added} 个单词")


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("用法: python fill_kaoyan_for_current_user.py <user_id>")
        print("示例: python fill_kaoyan_for_current_user.py 915c2e4019064b47892617abe7a06e98")
        sys.exit(1)
    user_id = sys.argv[1]
    asyncio.run(fill_for_user(user_id))
