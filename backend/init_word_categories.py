"""
初始化系统级单词分类
将现有的用户标签（考研词汇、中考词汇等）迁移为系统级分类
"""
import sqlite3
import uuid
from datetime import datetime

def init_categories():
    conn = sqlite3.connect('lexisync.db')
    cursor = conn.cursor()

    # 检查表是否存在
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='word_categories'")
    if not cursor.fetchone():
        print("word_categories 表不存在，请先运行后端服务器创建表")
        conn.close()
        return

    # 获取现有的系统级标签（假设这些是共享的）
    # 这里我们手动创建系统级分类
    categories = [
        {
            "id": str(uuid.uuid4()),
            "name": "小学词汇",
            "description": "人教版 PEP 3-6年级英语词汇",
            "color": "#f59e0b",
            "icon": "Smile",
            "display_order": 1,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "中考词汇",
            "description": "初中毕业生学业考试英语词汇",
            "color": "#38bdf8",
            "icon": "School",
            "display_order": 2,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "高考词汇",
            "description": "普通高等学校招生全国统一考试英语词汇",
            "color": "#818cf8",
            "icon": "BookOpen",
            "display_order": 3,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "四级词汇",
            "description": "大学英语四级考试词汇",
            "color": "#f472b6",
            "icon": "Award",
            "display_order": 4,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "六级词汇",
            "description": "大学英语六级考试词汇",
            "color": "#fb923c",
            "icon": "Trophy",
            "display_order": 5,
        },
        {
            "id": str(uuid.uuid4()),
            "name": "考研词汇",
            "description": "全国硕士研究生入学考试英语词汇大纲",
            "color": "#00e5bf",
            "icon": "GraduationCap",
            "display_order": 6,
        },
    ]

    # 插入分类
    for cat in categories:
        cursor.execute(
            """
            INSERT OR IGNORE INTO word_categories (id, name, description, color, icon, display_order, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (cat["id"], cat["name"], cat["description"], cat["color"], cat["icon"], cat["display_order"], True, datetime.now().isoformat())
        )
        print(f"✓ 创建分类: {cat['name']}")

    conn.commit()

    # 显示创建的分类
    cursor.execute("SELECT id, name, description FROM word_categories WHERE is_active = 1 ORDER BY display_order")
    print("\n系统级单词分类:")
    for row in cursor.fetchall():
        print(f"  {row[1]} (ID: {row[0]})")
        if row[2]:
            print(f"    描述: {row[2]}")

    conn.close()
    print("\n✓ 系统级单词分类初始化完成")
    print("\n注意：需要将现有单词关联到这些分类")
    print("可以通过管理后台或脚本来批量导入单词到分类")

if __name__ == "__main__":
    init_categories()
