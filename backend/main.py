import os
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import asyncpg

DATABASE_URL = os.environ.get("DATABASE_URL")

pool: Optional[asyncpg.Pool] = None


async def init_db(p: asyncpg.Pool):
    async with p.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS interval_progress (
                user_id BIGINT NOT NULL,
                interval_id TEXT NOT NULL,
                bar INTEGER NOT NULL DEFAULT 0,
                mastered BOOLEAN NOT NULL DEFAULT FALSE,
                correct_count INTEGER NOT NULL DEFAULT 0,
                wrong_count INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, interval_id)
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS interval_settings (
                user_id BIGINT PRIMARY KEY,
                enabled_intervals TEXT NOT NULL,
                fixed_root INTEGER,
                direction_mode TEXT NOT NULL DEFAULT 'both',
                instrument TEXT NOT NULL DEFAULT 'piano'
            )
        """)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
    await init_db(pool)
    yield
    await pool.close()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Telegram Mini App - сузить до конкретного домена после деплоя фронта
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Models ----------

class SettingsPayload(BaseModel):
    enabled_intervals: list[str]
    fixed_root: Optional[int] = None
    direction_mode: str = "both"
    instrument: str = "piano"


class AnswerPayload(BaseModel):
    interval_id: str
    is_correct: bool
    new_bar: int
    mastered: bool


# ---------- Settings ----------

@app.get("/api/{user_id}/settings")
async def get_settings(user_id: int):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM interval_settings WHERE user_id = $1", user_id
        )
        if not row:
            return {
                "enabled_intervals": ["M3", "P5", "P8"],
                "fixed_root": None,
                "direction_mode": "both",
                "instrument": "piano",
            }
        return {
            "enabled_intervals": json.loads(row["enabled_intervals"]),
            "fixed_root": row["fixed_root"],
            "direction_mode": row["direction_mode"],
            "instrument": row["instrument"],
        }


@app.put("/api/{user_id}/settings")
async def put_settings(user_id: int, payload: SettingsPayload):
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO interval_settings (user_id, enabled_intervals, fixed_root, direction_mode, instrument)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                enabled_intervals = EXCLUDED.enabled_intervals,
                fixed_root = EXCLUDED.fixed_root,
                direction_mode = EXCLUDED.direction_mode,
                instrument = EXCLUDED.instrument
            """,
            user_id,
            json.dumps(payload.enabled_intervals),
            payload.fixed_root,
            payload.direction_mode,
            payload.instrument,
        )
    return {"ok": True}


# ---------- Progress ----------

@app.get("/api/{user_id}/progress")
async def get_progress(user_id: int):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM interval_progress WHERE user_id = $1", user_id
        )
        return {
            r["interval_id"]: {
                "bar": r["bar"],
                "mastered": r["mastered"],
                "correct_count": r["correct_count"],
                "wrong_count": r["wrong_count"],
            }
            for r in rows
        }


@app.post("/api/{user_id}/answer")
async def post_answer(user_id: int, payload: AnswerPayload):
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO interval_progress (user_id, interval_id, bar, mastered, correct_count, wrong_count)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id, interval_id) DO UPDATE SET
                bar = EXCLUDED.bar,
                mastered = EXCLUDED.mastered,
                correct_count = interval_progress.correct_count + EXCLUDED.correct_count,
                wrong_count = interval_progress.wrong_count + EXCLUDED.wrong_count
            """,
            user_id,
            payload.interval_id,
            payload.new_bar,
            payload.mastered,
            1 if payload.is_correct else 0,
            0 if payload.is_correct else 1,
        )
    return {"ok": True}


@app.get("/")
async def health():
    return {"status": "ok"}
