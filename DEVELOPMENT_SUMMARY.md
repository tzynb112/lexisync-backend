# LexiSync 开发总结

## 项目概述
LexiSync 是一个 AI 驱动的词汇学习系统，基于 SM-2 间隔重复算法，专为考研英语词汇学习设计。

## 技术栈
- **前端**: Next.js 14 + React + TypeScript + Tailwind CSS + Framer Motion
- **后端**: FastAPI + SQLAlchemy 2.0 + SQLite + Uvicorn
- **算法**: SM-2 间隔重复算法

## 已完成功能

### 核心学习功能
- [x] 闪卡模式（自评 0-5 分）
- [x] 选择题测试（四选一）
- [x] 拼写模式（深度记忆）
- [x] SM-2 算法自动计算复习间隔
- [x] 学习日历热力图
- [x] 错题本功能
- [x] 每日学习目标设定

### 词汇管理
- [x] 词汇库浏览与搜索
- [x] 单词详情页（词源、例句、标签）
- [x] 收藏单词功能
- [x] 单词笔记
- [x] 单词关联（同义词、反义词）
- [x] 标签分类管理
- [x] CSV/JSON 批量导入导出

### 考研词汇专项
- [x] 考研大纲 5500 词汇完整导入
- [x] 词汇按标签分类（CET-4、考研核心等）
- [x] 学习路径（Learning Paths）

### AI 功能
- [x] AI 语境生成（编程 + 遥感领域例句）
- [x] 前端配置 OpenAI API Key
- [x] API Key 显示/隐藏切换
- [x] AI 语境开关控制

### 用户系统
- [x] 用户注册/登录（JWT Token）
- [x] 用户设置持久化
- [x] 学习统计面板
- [x] 成就系统
- [x] 排行榜

### 设置功能
- [x] 每日复习目标（5-100 个滑动调节）
- [x] 默认学习模式选择（闪卡/选择/拼写）
- [x] 音效开关
- [x] AI 语境开关
- [x] 学习提醒开关 + 时间设置
- [x] OpenAI API Key 配置

### 部署与启动
- [x] Next.js API 代理解决 CORS
- [x] SQLite WAL 模式解决并发
- [x] Service Worker 缓存策略优化
- [x] 一键启动脚本（start.bat / start_backend.bat / start_frontend.bat）
- [x] 一键停止脚本（stop.bat）

## 修复的关键问题

### 1. CORS 跨域问题
- **问题**: 前端直接请求后端 API 被浏览器拦截
- **解决**: Next.js rewrites 配置代理，所有 `/api/*` 请求转发到后端

### 2. bcrypt 密码长度限制
- **问题**: 密码超过 72 字节报错
- **解决**: SHA256 预哈希后再 bcrypt

### 3. 数据库模型外键缺失
- **问题**: WordRelation 表缺少外键约束导致 500 错误
- **解决**: 添加 ForeignKey 约束

### 4. "全部完成" 无单词可学
- **问题**: word_records 表初始化数据不正确
- **解决**: 清空并重新创建正确的初始记录

### 5. 时区不一致
- **问题**: 后端 UTC 与数据库本地时间混用
- **解决**: 统一使用本地时间（timezone=False）

### 6. UUID 类型兼容
- **问题**: PostgreSQL UUID 类型在 SQLite 不兼容
- **解决**: 全部改为 String(36) 存储

### 7. AI 语境生成异常
- **问题**: 硬编码 fallback 模板生成不当内容
- **解决**: 禁用默认 AI 生成，改为用户配置 API Key 后启用

### 8. SQLite 并发锁定
- **问题**: 多请求同时访问数据库锁定
- **解决**: 启用 WAL 模式 + busy_timeout=5000

### 9. 启动脚本闪退
- **问题**: chcp 65001 UTF-8 编码不支持 + 引号嵌套错误
- **解决**: 去掉中文编码切换，使用纯英文输出，简化 start 命令

### 10. Tailwind 无效类名
- **问题**: `translate-x-5.5` 不是有效 Tailwind 类
- **解决**: 改为 `translate-x-5` + `translate-x-0`，调整开关尺寸

## 项目文件结构
```
LexiSync/
├── start.bat              # 一键启动器
├── start_backend.bat      # 启动后端
├── start_frontend.bat     # 启动前端
├── stop.bat               # 停止服务
├── backend/
│   ├── app/
│   │   ├── api/           # API 路由
│   │   ├── core/          # 安全、依赖
│   │   ├── models/        # 数据库模型
│   │   ├── schemas/       # Pydantic 模型
│   │   └── services/      # AI 服务
│   ├── lexisync.db        # SQLite 数据库
│   └── requirements.txt   # Python 依赖
└── frontend/
    ├── src/
    │   ├── app/           # Next.js 页面
    │   ├── components/    # 公共组件
    │   ├── hooks/         # 自定义 Hooks
    │   └── lib/           # API 客户端、工具
    └── public/            # 静态资源
```

## 启动方式
1. 双击 `start.bat` 一键启动前后端
2. 或分别运行 `start_backend.bat` 和 `start_frontend.bat`
3. 停止服务运行 `stop.bat`

## 访问地址
- 前端: http://localhost:3000
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs
