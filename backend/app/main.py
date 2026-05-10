from contextlib import asynccontextmanager
import os
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth, words, review, ai_context, tag, achievement, word_note, word_relation, study_plan, leaderboard, learning_path, custom_plan
from app.database import engine, Base
from app.models import User, Word, WordRecord, ReviewLog, Tag, WordTag, FavoriteWord, UserSettings, Achievement, WordNote, WordRelation, StudyPlan, CustomStudyPlan, LearningPath, LearningPathWord
from app.seed import seed_categories
from app.database import async_session_factory


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session_factory() as session:
        await seed_categories(session)
    yield
    await engine.dispose()


app = FastAPI(
    title="LexiSync API",
    description="AI驱动词汇学习系统 - SM-2间隔重复算法",
    version="2.0.0",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "capacitor://localhost",
    "https://localhost",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if not os.getenv("RAILWAY_ENVIRONMENT") else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Date"],
)

app.include_router(auth.router)
app.include_router(words.router)
app.include_router(review.router)
app.include_router(ai_context.router)
app.include_router(tag.router)
app.include_router(achievement.router)
app.include_router(word_note.router)
app.include_router(word_relation.router)
app.include_router(study_plan.router)
app.include_router(custom_plan.router)
app.include_router(leaderboard.router)
app.include_router(learning_path.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "*"
        headers["Access-Control-Allow-Headers"] = "*"

    print(f"[ERROR] {request.method} {request.url.path}: {exc}")
    traceback.print_exc()

    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误", "error": str(exc)},
        headers=headers,
    )


@app.options("/{path:path}")
async def options_handler(path: str, request: Request):
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "*"
        headers["Access-Control-Allow-Headers"] = "*"
    return JSONResponse(content={"ok": True}, headers=headers)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "LexiSync API", "version": "2.0.0"}
