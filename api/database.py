"""
SokoAI v2 — Database Layer
PostgreSQL schema + helper functions for market price data.
Uses psycopg2 directly (no ORM overhead for speed).
"""

import os
import psycopg2
import psycopg2.extras
from datetime import datetime, date
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/sokoai"
)


def get_conn():
    return psycopg2.connect(DATABASE_URL)


# ─── Schema ───────────────────────────────────────────────────────
SCHEMA_SQL = """
-- Raw SMS submissions from madalali
CREATE TABLE IF NOT EXISTS sms_submissions (
    id           SERIAL PRIMARY KEY,
    sender       TEXT,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soko         TEXT NOT NULL,
    mkoa         TEXT,
    hali_soko    TEXT,
    raw_message  TEXT,
    parsed       BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Normalized price records (one row per commodity per soko per day)
CREATE TABLE IF NOT EXISTS market_prices (
    id            SERIAL PRIMARY KEY,
    date          DATE NOT NULL,
    soko          TEXT NOT NULL,
    mkoa          TEXT,
    commodity     TEXT NOT NULL,
    category      TEXT,            -- NAFAKA / MBOGA / MATUNDA etc
    price         NUMERIC(12, 2) NOT NULL,
    unit          TEXT NOT NULL,
    hali_soko     TEXT,            -- Nyingi / Wastani / Chache
    source        TEXT DEFAULT 'sms',   -- sms | wizara | manual
    submission_id INT REFERENCES sms_submissions(id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (date, soko, commodity, unit, source)
);

-- ML predictions
CREATE TABLE IF NOT EXISTS predictions (
    id            SERIAL PRIMARY KEY,
    generated_at  TIMESTAMPTZ DEFAULT NOW(),
    commodity     TEXT NOT NULL,
    mkoa          TEXT,
    soko          TEXT,
    target_date   DATE NOT NULL,
    week_ahead    INT NOT NULL,
    predicted     NUMERIC(12, 2) NOT NULL,
    model_version TEXT DEFAULT 'v2'
);

-- API keys for external clients
CREATE TABLE IF NOT EXISTS api_keys (
    id          SERIAL PRIMARY KEY,
    key_hash    TEXT UNIQUE NOT NULL,
    client_name TEXT NOT NULL,
    plan        TEXT DEFAULT 'free',   -- free | basic | pro | enterprise
    requests_today INT DEFAULT 0,
    requests_total BIGINT DEFAULT 0,
    rate_limit  INT DEFAULT 100,       -- requests per day
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    last_used   TIMESTAMPTZ
);

-- Indexes for API query performance
CREATE INDEX IF NOT EXISTS idx_prices_date_commodity ON market_prices(date, commodity);
CREATE INDEX IF NOT EXISTS idx_prices_soko           ON market_prices(soko);
CREATE INDEX IF NOT EXISTS idx_prices_commodity      ON market_prices(commodity);
CREATE INDEX IF NOT EXISTS idx_predictions_commodity ON predictions(commodity, target_date);
"""


def init_db():
    """Create all tables if they don't exist."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SCHEMA_SQL)
        conn.commit()
    print("✅ Database initialized.")


# ─── Writes ───────────────────────────────────────────────────────
def save_sms_submission(parsed: dict) -> int:
    """Save a parsed SMS submission. Returns submission ID."""
    sql = """
        INSERT INTO sms_submissions (sender, received_at, soko, mkoa, hali_soko, raw_message, parsed)
        VALUES (%(source)s, %(received_at)s, %(soko)s, %(mkoa)s, %(hali_soko)s, %(raw)s, TRUE)
        RETURNING id
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, parsed)
            sub_id = cur.fetchone()[0]
        conn.commit()
    return sub_id


def save_price_records(parsed: dict, submission_id: int):
    """Save individual commodity prices from a parsed SMS."""
    sql = """
        INSERT INTO market_prices
            (date, soko, mkoa, commodity, category, price, unit, hali_soko, source, submission_id)
        VALUES
            (%(date)s, %(soko)s, %(mkoa)s, %(commodity)s, %(category)s,
             %(price)s, %(unit)s, %(hali_soko)s, 'sms', %(submission_id)s)
        ON CONFLICT (date, soko, commodity, unit, source)
        DO UPDATE SET price = EXCLUDED.price, hali_soko = EXCLUDED.hali_soko
    """
    rows = []
    for item in parsed["items"]:
        rows.append({
            "date":          parsed["date"],
            "soko":          parsed["soko"],
            "mkoa":          parsed["mkoa"],
            "commodity":     item["commodity"],
            "category":      item["category"],
            "price":         item["price"],
            "unit":          item["unit"],
            "hali_soko":     parsed["hali_soko"],
            "submission_id": submission_id,
        })

    with get_conn() as conn:
        with conn.cursor() as cur:
            psycopg2.extras.execute_batch(cur, sql, rows)
        conn.commit()
    return len(rows)


def ingest_sms(parsed: dict) -> dict:
    """Full pipeline: save submission + price records."""
    sub_id = save_sms_submission(parsed)
    n = save_price_records(parsed, sub_id)
    return {"submission_id": sub_id, "records_saved": n}


def save_predictions(predictions: list[dict]):
    """Bulk-save ML predictions."""
    sql = """
        INSERT INTO predictions
            (commodity, mkoa, soko, target_date, week_ahead, predicted, model_version)
        VALUES
            (%(commodity)s, %(mkoa)s, %(soko)s, %(target_date)s,
             %(week_ahead)s, %(predicted)s, %(model_version)s)
        ON CONFLICT (generated_at::DATE, commodity, soko, week_ahead)
        DO UPDATE SET predicted = EXCLUDED.predicted
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            psycopg2.extras.execute_batch(cur, sql, predictions)
        conn.commit()


# ─── Reads ────────────────────────────────────────────────────────
def get_latest_prices(commodity: Optional[str] = None,
                      soko: Optional[str] = None,
                      mkoa: Optional[str] = None,
                      limit: int = 50) -> list[dict]:
    """Get latest price records, with optional filters."""
    conditions = ["1=1"]
    params = {}

    if commodity:
        conditions.append("LOWER(commodity) = LOWER(%(commodity)s)")
        params["commodity"] = commodity
    if soko:
        conditions.append("LOWER(soko) = LOWER(%(soko)s)")
        params["soko"] = soko
    if mkoa:
        conditions.append("LOWER(mkoa) = LOWER(%(mkoa)s)")
        params["mkoa"] = mkoa

    params["limit"] = limit
    where = " AND ".join(conditions)

    sql = f"""
        SELECT DISTINCT ON (commodity, soko)
            date, soko, mkoa, commodity, category, price, unit, hali_soko, source
        FROM market_prices
        WHERE {where}
        ORDER BY commodity, soko, date DESC
        LIMIT %(limit)s
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]


def get_price_history(commodity: str, soko: Optional[str] = None,
                      days: int = 90) -> list[dict]:
    """Get price history for a commodity over N days."""
    params = {"commodity": commodity, "days": days}
    soko_filter = ""
    if soko:
        soko_filter = "AND LOWER(soko) = LOWER(%(soko)s)"
        params["soko"] = soko

    sql = f"""
        SELECT date, soko, commodity, price, unit, hali_soko
        FROM market_prices
        WHERE LOWER(commodity) = LOWER(%(commodity)s)
          {soko_filter}
          AND date >= CURRENT_DATE - %(days)s
        ORDER BY date ASC
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]


def get_forecasts(commodity: str, soko: Optional[str] = None) -> list[dict]:
    """Get latest ML forecasts for a commodity."""
    params = {"commodity": commodity}
    soko_filter = ""
    if soko:
        soko_filter = "AND LOWER(soko) = LOWER(%(soko)s)"
        params["soko"] = soko

    sql = f"""
        SELECT target_date, week_ahead, predicted, model_version, generated_at
        FROM predictions
        WHERE LOWER(commodity) = LOWER(%(commodity)s)
          {soko_filter}
          AND generated_at::DATE = (
              SELECT MAX(generated_at::DATE) FROM predictions
              WHERE LOWER(commodity) = LOWER(%(commodity)s)
          )
        ORDER BY week_ahead ASC
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]


def count_new_rows_since(since_date: date) -> int:
    """Count new price rows added since a given date (for retraining gate)."""
    sql = "SELECT COUNT(*) FROM market_prices WHERE created_at::DATE >= %(since)s"
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, {"since": since_date})
            return cur.fetchone()[0]


# ─── API key management ───────────────────────────────────────────
import hashlib
import secrets

def create_api_key(client_name: str, plan: str = "free") -> str:
    """Generate and store a new API key. Returns the raw key."""
    raw_key = "soko_" + secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    rate_limits = {"free": 100, "basic": 1000, "pro": 10000, "enterprise": 100000}

    sql = """
        INSERT INTO api_keys (key_hash, client_name, plan, rate_limit)
        VALUES (%(hash)s, %(name)s, %(plan)s, %(limit)s)
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, {
                "hash": key_hash, "name": client_name,
                "plan": plan, "limit": rate_limits.get(plan, 100)
            })
        conn.commit()
    return raw_key


def validate_api_key(raw_key: str) -> Optional[dict]:
    """Validate API key and increment usage. Returns client info or None."""
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    sql = """
        UPDATE api_keys
        SET requests_today = requests_today + 1,
            requests_total = requests_total + 1,
            last_used = NOW()
        WHERE key_hash = %(hash)s
          AND is_active = TRUE
          AND requests_today < rate_limit
        RETURNING client_name, plan, rate_limit, requests_today
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, {"hash": key_hash})
            row = cur.fetchone()
        conn.commit()
    return dict(row) if row else None


if __name__ == "__main__":
    init_db()
