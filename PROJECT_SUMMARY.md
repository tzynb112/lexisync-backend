# LexiSync 项目总结

> 生成时间：2026-05-06
> 用途：开新对话前给 AI 的上下文参考

---

## 1. 项目架构

| 层级 | 技术栈 | 端口 |
|------|--------|------|
| 前端 | Next.js 15.5.15 + React + Tailwind CSS + Framer Motion | 3000 |
| 后端 | FastAPI + SQLAlchemy(async) + aiosqlite + JWT | 8000 |
| 数据库 | SQLite (`lexisync.db`) | - |

## 2. 核心功能状态

### ✅ 已完成
- [x] 用户注册/登录/JWT 认证
- [x] 词汇浏览（分页、搜索、按分组筛选）
- [x] **SM-2 间隔重复算法**（艾宾浩斯记忆曲线）
  - 闪卡模式、选择题模式、拼写模式
  - 自动计算下次复习时间（1天→6天→11天→26天→64天...）
- [x] 单词收藏/取消收藏
- [x] 单词标签分组管理
- [x] 学习统计（热力图、 streak、准确率趋势）
- [x] 周计划 + 自定义计划
- [x] 排行榜（全部/按分组）
- [x] 设置页面（每日目标、学习模式、发音开关等）
- [x] 发音功能（有道 TTS + 浏览器 SpeechSynthesis 兜底）
- [x] 全局分组选择器（GroupContext）
- [x] 系统级词汇分类模型（WordCategory/WordCategoryLink）API 已创建但未在前端使用

### 📦 内置词汇数据

| 分组 | 单词数 | 来源 |
|------|--------|------|
| 全部词汇 | **6,013** | 所有单词的合集 |
| 考研词汇 | 5,917 | 原有数据 |
| 中考词汇 | 2,055 | 原有数据 |
| 小学词汇 | **605** | 人教版 PEP 3-6年级 |
| 四级词汇 | 545 | 原有数据 |

### ⚠️ 已知问题 / 待优化
- [ ] **系统级词汇分类**（WordCategory）只建了模型和 API，未在前端使用。用户要求考研/中考/小学等应该是系统级而非用户级
- [ ] 学习页面的"全部开始"按钮会把整个分组的单词加入 SM-2，对于大分组（如考研 5900+）可能太多
- [ ] 自定义计划目前只是独立记录，与周计划的联动较浅
- [ ] 没有单词编辑功能（只能删除后重新添加）
- [ ] 发音功能依赖外部 TTS，网络不好时会 fallback 到浏览器合成

---

## 3. 关键文件位置

### 后端核心
| 文件 | 作用 |
|------|------|
| `backend/app/main.py` | FastAPI 入口，CORS， lifespan |
| `backend/app/core/deps.py` | JWT 认证依赖 `get_current_user` |
| `backend/app/core/security.py` | JWT encode/decode + bcrypt |
| `backend/app/core/sm2.py` | **SM-2 间隔重复算法** |
| `backend/app/api/review.py` | 复习 API（due/stats/feedback/start-all） |
| `backend/app/api/words.py` | 单词 CRUD + 分类 API |
| `backend/app/api/tag.py` | 标签/分组 API（注意路由顺序！动态路由放最后） |
| `backend/app/api/study_plan.py` | 周计划 API |
| `backend/app/api/custom_plan.py` | 自定义计划 API |
| `backend/app/api/auth.py` | 登录/注册 |
| `backend/app/models/word.py` | Word, WordCategory, WordCategoryLink 模型 |
| `backend/app/models/tag.py` | Tag, WordTag, UserSettings, FavoriteWord 模型 |
| `backend/app/models/review.py` | WordRecord, ReviewLog 模型 |
| `backend/app/database.py` | 数据库连接（SQLite） |
| `backend/.env` | DATABASE_URL, SECRET_KEY, ALGORITHM |

### 前端核心
| 文件 | 作用 |
|------|------|
| `frontend/src/lib/api.ts` | 所有 API 封装（**API_BASE = 'http://localhost:8000'**） |
| `frontend/src/lib/auth.tsx` | 登录/注册/AuthContext |
| `frontend/src/contexts/GroupContext.tsx` | 全局分组选择状态 |
| `frontend/src/components/AppShell.tsx` | 布局壳（含分组选择器） |
| `frontend/src/components/Flashcard.tsx` | 闪卡组件 |
| `frontend/src/components/SpeakButton.tsx` | 发音按钮 |
| `frontend/src/app/dashboard/page.tsx` | 仪表板 |
| `frontend/src/app/words/page.tsx` | 词汇列表（分页、筛选、添加、删除） |
| `frontend/src/app/study/page.tsx` | 学习页面（模式选择 + 三种学习模式） |
| `frontend/src/app/study-plan/page.tsx` | 计划页面（周计划 + 自定义计划） |
| `frontend/src/app/settings/page.tsx` | 设置页面 |
| `frontend/src/app/stats/page.tsx` | 统计详情 |
| `frontend/src/app/leaderboard/page.tsx` | 排行榜 |

---

## 4. 重要修复记录（避免重复踩坑）

### 修复 1：UUID 类型不匹配导致 "User not found"
- **问题**：新注册用户登录后所有 API 返回 401 "User not found"
- **根因**：`User.id` 列是 `String(36)`，但 `deps.py` 用 `uuid.UUID(user_id)` 查询，SQLite 无法匹配
- **修复**：`deps.py` 第 35 行改为 `User.id == user_id`（字符串比较）

### 修复 2：删除标签 204 报错
- **问题**：DELETE 返回 204 No Content，前端 `res.json()` 解析失败
- **修复**：`api.ts` 对 204 状态码特殊处理，直接返回 `undefined`

### 修复 3：标签路由顺序冲突
- **问题**：`PUT /{tag_id}` 拦截了 `PUT /settings`
- **修复**：所有动态路由 `/{tag_id}` 必须放在文件最后

### 修复 4：Next.js 代理丢失 Authorization Header
- **问题**：通过 `localhost:3000` 代理到后端时，Authorization 头被丢弃
- **修复**：`api.ts` 中 `API_BASE` 改为直接指向 `'http://localhost:8000'`

### 修复 5：word_tags 重复记录
- **问题**：考研词汇显示 11834 个（实际 5917），每个单词被添加了 2 次
- **修复**：删除 7960 条重复记录，添加 `UNIQUE INDEX` 约束

---

## 5. 启动命令

```bash
# 后端（Terminal 1）
cd d:\trae\LexiSync\backend
C:\Python314\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 前端（Terminal 2）
cd d:\trae\LexiSync\frontend
npm run dev
```

---

## 6. 数据库关键表结构

```
users          - 用户表（id: String PK）
words          - 单词表（id, word, definition, phonetic, part_of_speech）
tags           - 标签/分组表（id, name, color, user_id）
word_tags      - 单词-标签关联（word_id, tag_id, UNIQUE 约束）
word_records   - 用户学习记录（user_id, word_id, interval, easiness_factor, repetitions, next_review_at）
review_logs    - 复习日志（user_id, word_record_id, quality, interval_before/after...）
word_categories      - 系统分类表（id, name, description, color...）
word_category_links  - 单词-系统分类关联
user_settings  - 用户设置（daily_goal, preferred_study_mode, enable_sound...）
study_plans    - 周计划（user_id, plan_date, target_words, completed_words）
custom_study_plans - 自定义计划（user_id, title, description, tag_id, daily_goal...）
favorite_words - 收藏单词
word_notes     - 单词笔记
```

---

## 7. 用户原始需求（持续迭代中）

1. 像百词斩/扇贝一样的背单词体验
2. 词汇分组管理（考研/中考/小学等）
3. 系统级词汇分类（非用户级）
4. SM-2 间隔重复 + 清晰显示复习状态
5. 周计划与自定义计划联动
6. 发音功能
7. 单词可删除、添加时自动归入当前分组
