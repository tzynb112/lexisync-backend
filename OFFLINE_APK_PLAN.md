# LexiSync 全离线手机/平板 APK 改造方案

## 一、改造目标

将 LexiSync 从 **客户端-服务器架构**（Next.js + FastAPI + SQLite）改造为 **纯本地单机架构**（Next.js(TypeScript) + IndexedDB），打包为 Android APK，实现：

- ✅ 完全离线运行（无需任何网络请求）
- ✅ 所有数据存储在本地
- ✅ 一个 APK 安装即用
- ✅ 数据和后端算法全部跑在手机端

## 二、当前架构 vs 目标架构

```
当前架构（C/S）                            目标架构（单机）
┌─────────────────┐                      ┌──────────────────────┐
│  手机浏览器       │                      │  手机 APK             │
│  ┌───────────┐   │     HTTP API         │  ┌────────────────┐  │
│  │ Next.js   │───┼──────────────────────┼─→│ Next.js (SSG)  │  │
│  │ 前端 UI   │   │                      │  │ - 全部页面     │  │
│  └───────────┘   │                      │  │ - 业务逻辑     │  │
└─────────────────┘                      │  │ - SM-2 算法    │  │
                                          │  └────────┬───────┘  │
┌─────────────────┐                      │           │          │
│  云服务器         │                      │  ┌────────▼───────┐  │
│  ┌───────────┐   │                      │  │  IndexedDB      │  │
│  │ FastAPI   │   │                      │  │  - words        │  │
│  │ Python    │   │                      │  │  - categories   │  │
│  └───────────┘   │                      │  │  - tags         │  │
│  ┌───────────┐   │                      │  │  - word_records │  │
│  │ SQLite    │   │                      │  │  - review_logs  │  │
│  └───────────┘   │                      │  │  - favorites    │  │
└─────────────────┘                      │  │  - settings     │  │
                                          │  │  - ...          │  │
                                          │  └────────────────┘  │
                                          └──────────────────────┘
```

## 三、工作量评估

| 模块 | 后端 Python 代码量 | 需要重写为 TS | 复杂度 |
|------|-------------------|--------------|--------|
| 数据库 Schema | ~350行（7个Model） | 定义 IndexedDB 表结构 | ⭐⭐ |
| SM-2 算法 | ~90行 | 直接翻译（已解耦，无依赖） | ⭐ |
| 认证系统 | ~80行 | 改为本地 PIN/免密 | ⭐ |
| 单词 API | ~600行 | 重写为本地查询 | ⭐⭐⭐ |
| 复习 API | ~1100行 | 重写为本地查询 | ⭐⭐⭐⭐ |
| 标签 API | ~360行 | 重写为本地查询 | ⭐⭐ |
| AI 上下文 | ~?行 | 在线时才可用，离线降级 | ⭐⭐⭐ |
| 排行榜 API | ~?行 | 离线时不可用（无其他用户） | ⭐ |
| 成就系统 | ~?行 | 重写为本地计算 | ⭐⭐ |
| 数据预置 | 10+个导入脚本 | 打包 json 种子数据到 APK | ⭐⭐⭐⭐ |

**总计估计：6-8周（单人开发），关键路径约 4 周**

## 四、详细实施步骤

### 阶段 1：创建数据访问层（DAL）— 替换 SQLAlchemy + FastAPI（预计 2 周）

#### 1.1 设计 IndexedDB 数据库（`src/lib/db/index.ts`）

封装 IndexedDB 操作，提供类似 SQL 的查询接口。

**需要创建的 7 个对象仓库（Object Store）：**

| 表名 | 主键 | 索引 | 对应 Python Model |
|------|------|------|-------------------|
| `words` | `id` | `word`(unique), `language` | Word |
| `word_categories` | `id` | `name`(unique) | WordCategory |
| `word_category_links` | `id` | `word_id`, `category_id` | WordCategoryLink |
| `tags` | `id` | `name` | Tag |
| `word_tags` | `id` | `word_id`, `tag_id` | WordTag |
| `word_records` | `id` | `user_id+word_id`(composite) | WordRecord |
| `review_logs` | `id` | `user_id`, `word_record_id` | ReviewLog |
| `favorite_words` | `id` | `user_id+word_id`(composite) | FavoriteWord |
| `user_settings` | `id` | `user_id`(unique) | UserSettings |
| `word_notes` | `id` | `word_id` | WordNote |
| `word_relations` | `id` | `word_id` | WordRelation |
| `achievements` | `id` | `user_id` | Achievement |
| `study_plans` | `id` | `user_id`, `plan_date` | StudyPlan |
| `custom_plans` | `id` | `user_id` | CustomPlan |

**核心文件：**
- `src/lib/db/index.ts` — 数据库初始化、连接管理
- `src/lib/db/tables.ts` — 表结构定义、版本迁移
- `src/lib/db/query.ts` — 查询构建器（支持 where、orderBy、limit、offset、join 模拟）

关键接口设计：

```typescript
// 查询接口示例（模仿 SQLAlchemy 风格）
interface DBQuery<T> {
  where(conditions: Partial<T> | ((item: T) => boolean)): DBQuery<T>
  orderBy(field: keyof T, dir: 'asc' | 'desc'): DBQuery<T>
  limit(n: number): DBQuery<T>
  offset(n: number): DBQuery<T>
  all(): Promise<T[]>
  first(): Promise<T | null>
  count(): Promise<number>
}

// 数据访问对象
class WordsDAO {
  async search(q: string, filters: {...}): Promise<Word[]> {...}
  async getById(id: string): Promise<Word | null> {...}
  async create(data: Partial<Word>): Promise<Word> {...}
}
class ReviewDAO {
  async getDueWords(userId: string, limit: number): Promise<DueWord[]> {...}
  async submitFeedback(recordId: string, quality: number): Promise<WordRecord> {...}
  async getStats(userId: string): Promise<DashboardStats> {...}
}
```

#### 1.2 数据访问对象（DAO）列表

为每个业务模块创建 DAO：

| DAO | 方法数 | 说明 |
|-----|--------|------|
| `WordsDAO` | ~15 | CRUD + 搜索 + 分类筛选 + 导出 |
| `ReviewDAO` | ~12 | 待复习单词、提交反馈、统计数据、日历数据、错词本 |
| `TagsDAO` | ~10 | CRUD + 单词标签管理 + 收藏 |
| `AuthDAO` | ~3 | 用户创建、验证（离线版简化） |
| `AchievementDAO` | ~4 | 成就检查、列表 |
| `StudyPlanDAO` | ~6 | 学习计划 CRUD |
| `SettingsDAO` | ~4 | 用户设置读写 |

---

### 阶段 2：移植核心业务逻辑（预计 1.5 周）

#### 2.1 SM-2 算法移植（`src/lib/sm2.ts`）— ⭐ 最简单，纯函数

Python 代码 `90行` → TypeScript `~80行`，完全直译

```typescript
interface SM2Result {
  interval: number
  easinessFactor: number
  repetitions: number
  nextReviewAt: Date
}

function calculateSM2(
  quality: number,
  previousInterval: number,
  previousEasinessFactor: number,
  previousRepetitions: number,
): SM2Result {
  // ... 完全相同的算法逻辑
}
```

**仅在 `review.dao.ts` 中调用，无其他依赖。**

#### 2.2 复习引擎移植（`src/lib/services/review-service.ts`）— ⭐⭐⭐ 核心

将 `review.py` 中的逻辑移植：

```
review.py 功能                             对应 TS 实现
────────────────────────────────────────────────────────
GET /api/review/due                        ReviewService.getDueWords()
POST /api/review/feedback                   ReviewService.submitFeedback()
POST /api/review/test-feedback              ReviewService.submitTestFeedback()
POST /api/review/words/{id}/start           ReviewService.startLearning()
POST /api/review/start-all                  ReviewService.startAll()
GET /api/review/choice-test                 ReviewService.generateChoiceTest()
GET /api/review/spelling-test               ReviewService.generateSpellingTest()
GET /api/review/stats                       ReviewService.getStats()
GET /api/review/detailed-stats              ReviewService.getDetailedStats()
GET /api/review/wrong-words                 ReviewService.getWrongWords()
GET /api/review/calendar                    ReviewService.getCalendarData()
```

`复习 API（~1100 行 Python）` → `~1500 行 TypeScript`

#### 2.3 单词管理移植（`src/lib/services/word-service.ts`）— ⭐⭐

```
words.py 功能                               对应 TS 实现
────────────────────────────────────────────────────────
GET /api/words                              WordService.search()
GET /api/words/{id}                         WordService.getDetail()
GET /api/words/categories                   WordService.listCategories()
GET /api/words/categories/{id}              WordService.getCategoryDetail()
GET /api/words/search                       WordService.quickSearch()
POST /api/words/import                      WordService.importWords()
POST /api/words/import/csv                  WordService.importCSV()
GET /api/words/export/data                  WordService.exportData()
```

`单词 API（~600 行 Python）` → `~800 行 TypeScript`

#### 2.4 标签系统移植（`src/lib/services/tag-service.ts`）— ⭐⭐

```
tag.py 功能                                 对应 TS 实现
────────────────────────────────────────────────────────
POST /api/tags                             TagService.create()
GET /api/tags                              TagService.list()
PUT /api/tags/{id}                         TagService.update()
DELETE /api/tags/{id}                      TagService.delete()
POST /api/tags/word-tag                    TagService.addWordTag()
DELETE /api/tags/word-tag                  TagService.removeWordTag()
POST /api/tags/favorite                    TagService.toggleFavorite()
GET /api/tags/favorites                    TagService.listFavorites()
```

`标签 API（~360 行 Python）` → `~500 行 TypeScript`

#### 2.5 用户/认证系统（简化版）— ⭐

离线模式下不再需要 JWT Token。简化方案：

```typescript
// 离线版"用户"概念
interface LocalUser {
  id: string        // 固定值 'local-user'
  username: string   // 本地用户名
  createdAt: string
}

// 启动时自动创建，无需登录
const DEFAULT_USER: LocalUser = {
  id: 'local-user',
  username: '本地用户',
  createdAt: new Date().toISOString(),
}
```

所有 DAO 操作的 `userId` 都使用这个固定值。

---

### 阶段 3：前端改造 — 数据流替换（预计 1 周）

#### 3.1 替换 API 调用层

**核心原则：不改变任何 UI 组件的接口**

创建 `src/lib/services/index.ts`，保持与 `api.ts` 完全相同的方法签名：

```typescript
// 改造前（api.ts）
const words = await api.words.list(q, page, filters)

// 改造后（services/index.ts）
const words = await wordService.list(q, page, filters)
// 返回相同的数据结构！
```

使用**适配器模式**，先让两者并存：

```typescript
// src/lib/services/adapter.ts
import { api } from '../api'
import { wordService } from './word-service'

export const wordsAPI = {
  list: async (q?: string, page?: number, filters?: any) => {
    if (isOnline()) {
      return api.words.list(q, page, filters)
    }
    return wordService.list(q, page, filters)
  },
  // ... 每个方法都这样包装
}
```

**最终目标是完全移除 `api.ts` 中的远程调用。**

#### 3.2 逐页面替换计划

| 文件 | 替换的 API 调用数 | 影响范围 |
|------|------------------|---------|
| `dashboard/page.tsx` | ~5 | 首页仪表盘 |
| `study/page.tsx` | ~8 | 学习模式（核心） |
| `words/page.tsx` | ~6 | 单词管理 |
| `words/[id]/page.tsx` | ~4 | 单词详情 |
| `groups/page.tsx` | ~5 | 词汇组管理 |
| `stats/page.tsx` | ~3 | 详细统计 |
| `wrong-words/page.tsx` | ~2 | 错词本 |
| `settings/page.tsx` | ~3 | 设置 |
| `study-plan/page.tsx` | ~3 | 学习计划 |
| `leaderboard/page.tsx` | ~1 | 排行榜（离线不可用） |
| `learning-paths/page.tsx` | ~3 | 学习路径 |

**总计：约 43 处 API 调用需要替换**

#### 3.3 改造顺序（按页面依赖）

```
第1步: Dashboard（最简单的读操作）
第2步: Words + WordDetail（读写分离，先读后写）
第3步: Groups/Tags（标签和分类管理）
第4步: Study（核心复习流程，最复杂）
第5步: Stats + WrongWords（纯统计查询）
第6步: Settings + StudyPlan（简单的读写）
第7步: LearningPaths + Leaderboard（次要功能）
```

---

### 阶段 4：种子数据打包（预计 1 周）

这是**工作量最大**的部分。当前所有系统词汇都存储在 SQLite 中，需要打包到 APK。

#### 4.1 导出种子数据

```bash
# 从当前数据库导出所有系统词汇为 JSON
# words.json — 所有单词
# word_categories.json — 系统分类
# word_category_links.json — 分类关联
# tags.json — 系统标签
# word_tags.json — 标签关联
```

导出脚本（在现有后端运行一次）：

```python
# scripts/export_seed_data.py
import json
# ... 从数据库读取所有表，导出为 JSON 文件
# 输出到 frontend/public/seed/
```

#### 4.2 种子数据量估计

| 数据集 | 预估大小 | 说明 |
|--------|---------|------|
| 小学词汇 | ~10,000 条 | 已导入的 PEP 词汇 |
| 中考词汇 | ~1,600 条 | 已导入 |
| 高考词汇 | ~3,500 条 | 已导入 |
| CET-4 词汇 | ~4,600 条 | 已导入 |
| CET-6 词汇 | ~2,200 条 | 已导入 |
| 考研词汇 | ~5,000 条 | 已导入 |
| 雅思词汇 | ~? 条 | 已导入 |
| 托福词汇 | ~? 条 | 已导入 |
| **总计** | **~50,000 条** | JSON 格式约 **5-8MB** |

#### 4.3 首次启动初始化

```typescript
// src/lib/db/seed.ts
export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase()

  // 检查是否已初始化
  const existing = await db.get('words', 'seed_version')
  if (existing) return

  // 显示初始化进度
  // 1. 加载 words.json
  // 2. 加载 word_categories.json
  // 3. 加载 word_category_links.json
  // 4. 写入 IndexedDB

  // 使用事务批量写入
  const tx = db.transaction(['words', 'word_categories', ...], 'readwrite')
  for (const word of seedData.words) {
    tx.objectStore('words').add(word)
  }
  // ...

  // 标记初始化完成
  await db.put('meta', { key: 'seed_version', value: '1.0' })
}
```

---

### 阶段 5：AI 功能处理（预计 3 天）

AI 生成例句功能需要 OpenAI API，离线时不可用。

**降级方案：**

```typescript
interface AIService {
  generateContext(word: string, definition: string): Promise<AIContext | null>
}

// 在线时：调用 API（或客户端直接调用 OpenAI）
// 离线时：返回 null，UI 隐藏 AI 相关按钮
class OfflineAIService implements AIService {
  async generateContext(): Promise<null> {
    return null  // 离线降级
  }
}

class OnlineAIService implements AIService {
  async generateContext(word: string, definition: string): Promise<AIContext> {
    // 直接从前端调用 OpenAI API（不经过后端）
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      headers: { Authorization: `Bearer ${apiKey}` },
      // ...
    })
    return parseResponse(response)
  }
}
```

**或者在首次有网时预生成并缓存例句**，离线时使用缓存。

---

### 阶段 6：Capacitor 打包配置（预计 1 周）

#### 6.1 安装依赖

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init LexiSync com.lexisync.app
npx cap add android
```

#### 6.2 适配 Next.js 静态导出

```javascript
// next.config.js
const nextConfig = {
  output: 'export',  // 静态导出
  trailingSlash: true,
  images: { unoptimized: true },
}

module.exports = nextConfig
```

#### 6.3 设置文件

```xml
<!-- android/app/src/main/res/xml/file_paths.xml -->
<paths>
  <files-path name="seed" path="assets/seed/" />
</paths>
```

#### 6.4 构建与打包命令

```bash
# 1. 构建前端
npm run build

# 2. 复制到 Capacitor
npx cap copy

# 3. 打开 Android Studio 打包 APK
npx cap open android
# 或在 Android Studio 中:
# Build → Build Bundle(s) / APK(s) → Build APK(s)
```

#### 6.5 APK 体积估计

| 组件 | 预估大小 |
|------|---------|
| Next.js 静态文件 | ~500KB |
| 种子数据 JSON | ~8MB |
| Capacitor 壳 | ~3MB |
| WebView 运行时 | ~20MB（系统自带） |
| **APK 总大小** | **~12-15MB** |

---

### 阶段 7：PC 端调试流程（预计 2 周）

用户要求先在 PC 上调试好再打包，因此设计双模式运行：

#### 7.1 开发模式配置

```typescript
// src/lib/env.ts
export const APP_MODE = {
  isOffline: process.env.NEXT_PUBLIC_APP_MODE === 'offline',
  // 开发时通过环境变量切换
}
```

```bash
# 原有模式（连接后端）
npm run dev

# 离线模式（纯本地，不需要后端）
NEXT_PUBLIC_APP_MODE=offline npm run dev
```

#### 7.2 逐步调试顺序

```
Step 1: 在 PC 上用离线模式启动
Step 2: 验证 IndexedDB 初始化 + 种子数据导入
Step 3: 测试 Dashboard 页面（纯读取）
Step 4: 测试单词搜索/列表页面
Step 5: 测试标签 CRUD
Step 6: 测试「开始学习」功能
Step 7: 测试「闪卡模式」完整流程
Step 8: 测试「选择题模式」完整流程
Step 9: 测试「拼写模式」完整流程
Step 10: 测试统计数据页面
Step 11: 测试错词本
Step 12: 测试设置页面
Step 13: 测试学习计划
Step 14: 测试数据导出功能
Step 15: 边缘情况测试（大量数据、快速操作等）
```

#### 7.3 推荐的调试工具

- **Chrome DevTools → Application → IndexedDB**：直接查看本地数据库内容
- **React DevTools**：查看组件状态
- **新建 `src/lib/dev.ts`**：开发工具函数

```typescript
// 开发时用，可输出调试信息到控制台
export const DevTools = {
  async dumpAllData() {
    const db = await getDatabase()
    for (const store of objectStores) {
      const all = await db.getAll(store)
      console.log(`[DB] ${store}: ${all.length} records`)
    }
  },

  async resetDatabase() {
    // 重置数据库（清楚所有用户数据，重新导入种子）
    await clearDatabase()
    await initializeDatabase()
  },

  async simulateProgress(wordCount: number) {
    // 模拟学习进度（用于测试统计页面）
    // ...
  },
}
```

---

## 五、文件变更清单

### 新建文件（约 25 个）

```
src/lib/db/index.ts              ← IndexedDB 初始化和连接管理
src/lib/db/tables.ts             ← 表结构定义
src/lib/db/query.ts              ← 查询构建器
src/lib/db/dao/words.dao.ts      ← 单词数据访问
src/lib/db/dao/review.dao.ts     ← 复习数据访问
src/lib/db/dao/tags.dao.ts       ← 标签数据访问
src/lib/db/dao/auth.dao.ts       ← 用户数据访问
src/lib/db/dao/settings.dao.ts   ← 设置数据访问
src/lib/db/dao/achievement.dao.ts ← 成就数据访问
src/lib/db/dao/study-plan.dao.ts ← 学习计划数据访问
src/lib/db/dao/plan.dao.ts       ← 自定义计划数据访问
src/lib/db/dao/notes.dao.ts      ← 单词笔记数据访问
src/lib/db/dao/relations.dao.ts  ← 单词关系数据访问
src/lib/services/sm2.ts          ← SM-2 算法移植
src/lib/services/review-service.ts  ← 复习业务逻辑
src/lib/services/word-service.ts    ← 单词业务逻辑
src/lib/services/tag-service.ts     ← 标签业务逻辑
src/lib/services/ai-service.ts      ← AI 离线降级
src/lib/services/achievement-service.ts ← 成就系统
src/lib/services/study-plan-service.ts  ← 学习计划
src/lib/db/seed.ts               ← 种子数据导入
src/lib/db/seed-data/             ← 种子数据目录（JSON 文件）
src/lib/env.ts                   ← 运行模式配置
src/lib/dev.ts                   ← 开发调试工具
```

### 修改文件（约 15 个）

```
src/lib/timeSync.ts              ← 移除服务器时间同步，改用本地时间
src/lib/api.ts                   ← 保留作为在线模式备用或逐步替换
src/app/dashboard/page.tsx       ← 替换 api 调用为 service 调用
src/app/study/page.tsx           ← 替换 api 调用（最复杂）
src/app/words/page.tsx           ← 替换 api 调用
src/app/words/[id]/page.tsx      ← 替换 api 调用
src/app/groups/page.tsx          ← 替换 api 调用
src/app/stats/page.tsx           ← 替换 api 调用
src/app/wrong-words/page.tsx     ← 替换 api 调用
src/app/settings/page.tsx        ← 替换 api 调用
src/app/study-plan/page.tsx      ← 替换 api 调用
src/app/leaderboard/page.tsx     ← 离线降级
src/app/learning-paths/page.tsx  ← 替换 api 调用
src/app/page.tsx                 ← 替换 api 调用
next.config.js                   ← 添加静态导出配置
```

### 无需修改的文件

```
src/components/*                  ← 纯 UI 组件，不变
src/contexts/*                    ← Context 层不变
src/types/index.ts                ← 类型定义不变
src/app/layout.tsx                ← 布局不变
src/app/login/page.tsx            ← 登录页（离线版简化或保留）
```

---

## 六、风险与注意事项

### 风险 1：IndexedDB 性能
- IndexedDB 在处理 5 万条以上数据时，复杂 JOIN 查询可能变慢
- **对策**：建立合适的索引；对于统计类查询，预计算并缓存结果

### 风险 2：种子数据大小
- 5-8MB 的 JSON 文件首次加载可能需要 1-3 秒
- **对策**：显示加载进度条；使用流式读取

### 风险 3：SM-2 算法一致性
- Python 和 TypeScript 的浮点运算可能有微小差异
- **对策**：编写单元测试，对比 Python 和 TS 版本在相同输入下的输出

### 风险 4：Capacitor 与 Next.js 兼容性
- Next.js 的某些特性（如 Server Components）在静态导出时不可用
- **对策**：当前已经是纯 Client Components，问题不大

### 风险 5：数据迁移
- 如果用户之前在线使用过，需要将旧数据导入本地
- **对策**：第一次启动时提供「从服务器导入数据」选项

---

## 七、分阶段交付计划

```
第 1-2 周  ████████░░░░░░░░░░░░  Phase 1: 数据访问层 (DAL)
第 3-4 周  ████████████░░░░░░░░  Phase 2: 业务逻辑移植
第 5 周    ████████████████░░░░  Phase 3: 前端数据流替换
第 6 周    ████████████████████  Phase 4: 种子数据打包
第 7 周    ████████████████████  Phase 5: AI + 离线降级
第 8 周    ████████████████████  Phase 6: Capacitor + APK
          ─────────────────────
并行      全过程 PC 端调试验证
```

---

## 八、开发环境要求

```
Node.js >= 18
npm >= 9
Android Studio (用于打包 APK)
JDK 17
Android SDK API Level 33+
```

---

## 九、下一步行动

1. **✅ 你确认方案** — 如果没问题，告诉我"开始"
2. **Phase 1 启动** — 我先创建 `src/lib/db/` 目录，实现 IndexedDB 封装
3. **PC 调试** — 每完成一个阶段你都可以 `npm run dev` 在浏览器测试

---

> **准备好了吗？确认后我开始 Phase 1：创建数据访问层。每个阶段完成后你都可以在 PC 上调试验证。**
