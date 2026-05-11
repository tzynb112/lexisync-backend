# LexiSync - 智能词汇学习系统
一个现代化的跨平台词汇学习应用，帮助用户高效掌握英语词汇。

## 🌟 核心特色功能
### 📚 多级别词汇库
覆盖从小学到专业考试的完整词汇体系，共 11 个分类：

- 基础阶段 ：小学词汇 (~700)、中考词汇 (~2000)
- 中学阶段 ：高考词汇 (~3500)
- 大学阶段 ：四级词汇 (~4000)、六级词汇 (~5500)、考研词汇 (~6000)
- 专业阶段 ：专四词汇、专八词汇
- 出国考试 ：TOEFL 词汇、GRE 词汇、IELTS 词汇
### 🎯 智能学习模式
- 艾宾浩斯记忆曲线 ：科学规划复习周期
- 随机/顺序学习 ：灵活选择学习方式
- 难度自适应 ：根据答题情况调整难度
### 💾 个性化学习体验
- 收藏夹功能 ：收藏重点词汇，方便复习
- 学习进度追踪 ：记录学习数据，可视化进度
- 主题切换 ：支持亮色/暗色模式
- 语言切换 ：中英文界面一键切换
### 📖 丰富的词汇信息
- 音标与发音 ：标准发音示范
- 详细释义 ：中英文解释
- 例句展示 ：真实语境应用
- 词根词缀 ：帮助理解记忆
### 🔄 跨平台同步
- 📱 Android 移动端 ：随时随地学习
- 🌐 Web 端 ：大屏沉浸式学习
- ✨ 数据同步 ：学习进度云端保存
## 🛠️ 技术栈
- 前端 : Next.js 15 + React 18 + Tailwind CSS 3
- 后端 : FastAPI + Python 3.11
- 数据库 : PostgreSQL
- 移动端 : Capacitor 8.3.3
## 🚀 快速开始
### 前端开发
```
cd frontend
npm install
npm run dev
```
### 后端开发
```
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
### 打包 APK
```
cd frontend
npm run build
npx cap sync
cd android
./gradlew assembleRelease
```
## 📁 项目结构
```
LexiSync/
├── frontend/          # Next.js 前端应用
│   ├── src/
│   │   ├── app/       # 页面组件
│   │   └── components/ # 公共组件
│   └── android/       # Capacitor Android 项目
└── backend/           # FastAPI 后端服务
    ├── main.py        # 主入口
    ├── models/        # 数据库模型
    └── routers/       # API 路由
```
## 🔗 部署链接
- 后端服务 : https://lexisync-backend-production.up.railway.app
