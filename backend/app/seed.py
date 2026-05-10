from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.database import async_session_factory
from app.models.category import WordCategory
from app.models.category_link import WordCategoryLink


CATEGORIES_SEED = [
    {
        "name": "小学词汇",
        "description": "人教版 PEP 3-6年级英语词汇",
        "color": "#f59e0b",
        "icon": "Smile",
        "display_order": 1,
    },
    {
        "name": "中考词汇",
        "description": "初中毕业生学业考试英语词汇",
        "color": "#38bdf8",
        "icon": "School",
        "display_order": 2,
    },
    {
        "name": "高考词汇",
        "description": "普通高等学校招生全国统一考试英语词汇",
        "color": "#818cf8",
        "icon": "BookOpen",
        "display_order": 3,
    },
    {
        "name": "四级词汇",
        "description": "大学英语四级考试词汇",
        "color": "#6ee7b7",
        "icon": "GraduationCap",
        "display_order": 4,
    },
    {
        "name": "六级词汇",
        "description": "大学英语六级考试词汇",
        "color": "#c084fc",
        "icon": "Award",
        "display_order": 5,
    },
    {
        "name": "考研词汇",
        "description": "全国硕士研究生入学考试英语词汇",
        "color": "#fb7185",
        "icon": "Flame",
        "display_order": 6,
    },
    {
        "name": "专四词汇",
        "description": "英语专业四级考试词汇",
        "color": "#fbbf24",
        "icon": "PenTool",
        "display_order": 7,
    },
    {
        "name": "专八词汇",
        "description": "英语专业八级考试词汇",
        "color": "#a78bfa",
        "icon": "Star",
        "display_order": 8,
    },
    {
        "name": "GRE词汇",
        "description": "美国研究生入学考试词汇",
        "color": "#f87171",
        "icon": "Globe",
        "display_order": 9,
    },
    {
        "name": "IELTS词汇",
        "description": "雅思考试词汇",
        "color": "#60a5fa",
        "icon": "Plane",
        "display_order": 10,
    },
    {
        "name": "TOEFL词汇",
        "description": "托福考试词汇",
        "color": "#34d399",
        "icon": "Bookmark",
        "display_order": 11,
    },
]


async def seed_categories(session: AsyncSession) -> int:
    """Initialize system word categories. Returns count of categories created."""
    result = await session.execute(select(WordCategory).limit(1))
    if result.scalar_one_or_none() is not None:
        return 0

    created = 0
    for cat_data in CATEGORIES_SEED:
        category = WordCategory(**cat_data)
        session.add(category)
        created += 1

    await session.commit()
    return created


async def run_seed():
    """Entry point for seeding. Called during app startup."""
    async with async_session_factory() as session:
        count = await seed_categories(session)
        if count > 0:
            print(f"🌱 Seeded {count} system categories")