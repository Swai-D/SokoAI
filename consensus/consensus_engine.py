"""
SokoAI — Consensus Engine
Inachukua bei kutoka madalali 3+ na kutoa wastani unaotegemewa.

Matatizo inayosuluhisha:
  1. Mdalali mmoja anaweza kutuma bei ya makosa / udanganyifu
  2. Bei moja inaweza kuwa ya soko tofauti (Kariakoo vs Tandale)
  3. Wakati tofauti wa kutuma (asubuhi vs mchana = bei tofauti)

Jinsi inavyofanya kazi:
  - Inakusanya submissions za soko moja kwa siku moja
  - Inahesabu Outlier Score kwa kila submission
  - Inapunguza uzito wa outliers
  - Inatoa Consensus Price + Confidence Score
"""

import pandas as pd
import numpy as np
from datetime import datetime, date, timedelta
from typing import Optional
import psycopg2, psycopg2.extras, os, logging
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("SokoAI.Consensus")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/sokoai")

def get_conn():
    return psycopg2.connect(DATABASE_URL)


# ── Schema addition ───────────────────────────────────────────────
CONSENSUS_SCHEMA = """
CREATE TABLE IF NOT EXISTS consensus_prices (
    id               SERIAL PRIMARY KEY,
    date             DATE NOT NULL,
    soko             TEXT NOT NULL,
    commodity        TEXT NOT NULL,
    consensus_price  NUMERIC(12,2) NOT NULL,
    submissions_used INT NOT NULL,
    submissions_total INT NOT NULL,
    confidence       NUMERIC(5,3) NOT NULL,   -- 0.0 to 1.0
    price_min        NUMERIC(12,2),
    price_max        NUMERIC(12,2),
    price_std        NUMERIC(12,2),
    outliers_rejected INT DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (date, soko, commodity)
);

-- Dalali quality scores (inakua kwa wakati)
CREATE TABLE IF NOT EXISTS dalali_scores (
    id            SERIAL PRIMARY KEY,
    sender        TEXT NOT NULL UNIQUE,
    soko          TEXT,
    total_submissions INT DEFAULT 0,
    accurate_submissions INT DEFAULT 0,
    quality_score NUMERIC(5,3) DEFAULT 0.5,  -- 0.0 to 1.0
    last_submission TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consensus_date_soko ON consensus_prices(date, soko);
CREATE INDEX IF NOT EXISTS idx_consensus_commodity ON consensus_prices(commodity);
"""

def init_consensus_schema():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(CONSENSUS_SCHEMA)
        conn.commit()
    log.info("✅ Consensus schema initialized.")


# ── Outlier Detection ─────────────────────────────────────────────
def detect_outliers_iqr(prices: list[float], multiplier: float = 1.5) -> list[bool]:
    """
    IQR method ya outlier detection.
    Returns list ya booleans — True = outlier.
    Kama submissions chini ya 3, hakuna outlier (data ndogo sana).
    """
    if len(prices) < 3:
        return [False] * len(prices)

    arr = np.array(prices)
    q1, q3 = np.percentile(arr, 25), np.percentile(arr, 75)
    iqr = q3 - q1

    if iqr == 0:
        # Bei zote zinafanana — hakuna outlier
        return [False] * len(prices)

    lower = q1 - multiplier * iqr
    upper = q3 + multiplier * iqr
    return [p < lower or p > upper for p in prices]


def compute_weights(
    prices: list[float],
    senders: list[str],
    quality_scores: dict[str, float],
    is_outlier: list[bool],
) -> list[float]:
    """
    Hesabu uzito kwa kila submission.
    Outliers wanapata uzito wa 0.1 (hawafutiwi kabisa — inawezekana ni bei ya kweli).
    Dalali wenye quality score nzuri wanapata uzito zaidi.
    """
    weights = []
    for i, (price, sender, outlier) in enumerate(zip(prices, senders, is_outlier)):
        base_weight = 0.1 if outlier else 1.0
        quality = quality_scores.get(sender, 0.5)  # default 0.5 kwa mpya
        weight = base_weight * (0.5 + quality)      # range: 0.05 - 1.5
        weights.append(weight)

    total = sum(weights)
    return [w / total for w in weights]  # normalize


def consensus_price(
    prices: list[float],
    weights: list[float],
    is_outlier: list[bool],
) -> tuple[float, float]:
    """
    Weighted average + confidence score.
    Confidence = 1 - (coefficient of variation ya bei zisizo outlier)
    """
    # Weighted mean
    wmean = sum(p * w for p, w in zip(prices, weights))

    # Confidence: inategemea jinsi bei zinavyofanana
    clean = [p for p, o in zip(prices, is_outlier) if not o]
    if len(clean) < 2:
        confidence = 0.5
    else:
        std = np.std(clean)
        mean = np.mean(clean)
        cv = std / mean if mean > 0 else 1.0  # coefficient of variation
        # CV ya 0 = confidence 1.0, CV ya 0.5+ = confidence 0.3
        confidence = max(0.3, 1.0 - (cv * 1.4))

    return round(wmean, 2), round(min(confidence, 1.0), 3)


# ── Main consensus computation ────────────────────────────────────
def compute_consensus_for_date(target_date: date = None) -> dict:
    """
    Hesabu consensus prices kwa siku moja.
    Default = leo.
    Returns stats za kila (soko, commodity) iliyohesabiwa.
    """
    if target_date is None:
        target_date = date.today()

    date_str = target_date.strftime("%Y-%m-%d")
    log.info(f"Computing consensus for {date_str}...")

    # Chukua submissions za siku hii
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT mp.soko, mp.commodity, mp.price, mp.unit,
                       mp.category, ss.sender, ss.id as submission_id
                FROM market_prices mp
                LEFT JOIN sms_submissions ss ON mp.submission_id = ss.id
                WHERE mp.date = %(date)s AND mp.source = 'sms'
                ORDER BY mp.soko, mp.commodity
            """, {"date": date_str})
            rows = cur.fetchall()

            # Chukua quality scores za madalali
            cur.execute("SELECT sender, quality_score FROM dalali_scores")
            quality_scores = {r["sender"]: float(r["quality_score"]) for r in cur.fetchall()}

    if not rows:
        log.warning(f"Hakuna data ya SMS kwa {date_str}")
        return {"date": date_str, "processed": 0, "groups": []}

    df = pd.DataFrame(rows)
    results = []
    to_insert = []

    # Group kwa soko + commodity
    for (soko, commodity), group in df.groupby(["soko", "commodity"]):
        prices  = group["price"].astype(float).tolist()
        senders = group["sender"].fillna("unknown").tolist()

        is_outlier = detect_outliers_iqr(prices)
        weights    = compute_weights(prices, senders, quality_scores, is_outlier)
        c_price, confidence = consensus_price(prices, weights, is_outlier)

        n_outliers = sum(is_outlier)
        n_used     = len(prices) - n_outliers
        unit       = group["unit"].iloc[0]
        category   = group["category"].iloc[0]

        results.append({
            "soko":              soko,
            "commodity":         commodity,
            "unit":              unit,
            "category":          category,
            "consensus_price":   c_price,
            "submissions_used":  n_used,
            "submissions_total": len(prices),
            "outliers_rejected": n_outliers,
            "confidence":        confidence,
            "price_min":         round(min(prices), 2),
            "price_max":         round(max(prices), 2),
            "price_std":         round(float(np.std(prices)), 2),
        })

        to_insert.append({
            "date":               date_str,
            "soko":               soko,
            "commodity":          commodity,
            "consensus_price":    c_price,
            "submissions_used":   n_used,
            "submissions_total":  len(prices),
            "confidence":         confidence,
            "price_min":          min(prices),
            "price_max":          max(prices),
            "price_std":          float(np.std(prices)),
            "outliers_rejected":  n_outliers,
        })

        if n_outliers:
            log.warning(
                f"  ⚠ {soko}/{commodity}: {n_outliers} outlier(s) rejected "
                f"(prices: {[round(p) for p in prices]})"
            )
        else:
            log.info(
                f"  ✓ {soko}/{commodity}: TZS {c_price:,.0f} "
                f"(conf={confidence:.2f}, n={len(prices)})"
            )

    # Save consensus prices to DB
    if to_insert:
        _save_consensus(to_insert)
        _update_market_prices_from_consensus(to_insert, date_str)

    log.info(f"Consensus done: {len(results)} groups processed for {date_str}")
    return {
        "date":      date_str,
        "processed": len(results),
        "groups":    results,
    }


def _save_consensus(rows: list[dict]):
    sql = """
        INSERT INTO consensus_prices
            (date, soko, commodity, consensus_price, submissions_used,
             submissions_total, confidence, price_min, price_max, price_std, outliers_rejected)
        VALUES
            (%(date)s, %(soko)s, %(commodity)s, %(consensus_price)s,
             %(submissions_used)s, %(submissions_total)s, %(confidence)s,
             %(price_min)s, %(price_max)s, %(price_std)s, %(outliers_rejected)s)
        ON CONFLICT (date, soko, commodity)
        DO UPDATE SET
            consensus_price    = EXCLUDED.consensus_price,
            submissions_used   = EXCLUDED.submissions_used,
            submissions_total  = EXCLUDED.submissions_total,
            confidence         = EXCLUDED.confidence,
            price_min          = EXCLUDED.price_min,
            price_max          = EXCLUDED.price_max,
            price_std          = EXCLUDED.price_std,
            outliers_rejected  = EXCLUDED.outliers_rejected
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            psycopg2.extras.execute_batch(cur, sql, rows)
        conn.commit()


def _update_market_prices_from_consensus(rows: list[dict], date_str: str):
    """
    Badilisha market_prices za SMS source na consensus prices.
    Hii inafanya model training itumie data safi.
    """
    sql = """
        UPDATE market_prices
        SET price = %(consensus_price)s
        WHERE date = %(date)s
          AND soko = %(soko)s
          AND commodity = %(commodity)s
          AND source = 'sms'
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            psycopg2.extras.execute_batch(cur, sql, rows)
        conn.commit()


# ── Dalali quality tracking ───────────────────────────────────────
def update_dalali_scores():
    """
    Hesabu upya quality scores za madalali kulingana na
    jinsi bei zao zinavyokaribiana na consensus.
    Itwe mara moja kwa wiki.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Linganisha bei za kila mdalali na consensus ya siku hiyo
            cur.execute("""
                SELECT
                    ss.sender,
                    mp.soko,
                    AVG(ABS(mp.price - cp.consensus_price) / NULLIF(cp.consensus_price, 0)) as avg_deviation,
                    COUNT(*) as submissions
                FROM market_prices mp
                JOIN sms_submissions ss ON mp.submission_id = ss.id
                JOIN consensus_prices cp
                    ON cp.date = mp.date
                    AND cp.soko = mp.soko
                    AND cp.commodity = mp.commodity
                WHERE mp.source = 'sms'
                  AND mp.date >= CURRENT_DATE - 30
                  AND ss.sender IS NOT NULL
                GROUP BY ss.sender, mp.soko
                HAVING COUNT(*) >= 3
            """)
            rows = cur.fetchall()

    updated = 0
    for r in rows:
        # deviation ya 0% = score 1.0, deviation ya 20%+ = score 0.2
        deviation = float(r["avg_deviation"] or 0)
        score = max(0.2, 1.0 - (deviation * 4))

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO dalali_scores (sender, soko, quality_score, total_submissions, last_submission)
                    VALUES (%(sender)s, %(soko)s, %(score)s, %(subs)s, NOW())
                    ON CONFLICT (sender) DO UPDATE SET
                        quality_score = 0.7 * dalali_scores.quality_score + 0.3 * EXCLUDED.quality_score,
                        total_submissions = dalali_scores.total_submissions + EXCLUDED.total_submissions,
                        last_submission = NOW()
                """, {"sender": r["sender"], "soko": r["soko"],
                      "score": round(score, 3), "subs": r["submissions"]})
            conn.commit()
        updated += 1

    log.info(f"✅ Updated quality scores for {updated} madalali")
    return updated


# ── FastAPI endpoint data ─────────────────────────────────────────
def get_consensus_prices(
    commodity: Optional[str] = None,
    soko: Optional[str] = None,
    target_date: date = None,
) -> list[dict]:
    """Toa consensus prices kutoka DB (si raw submissions)."""
    if target_date is None:
        target_date = date.today()

    conditions = ["date = %(date)s"]
    params = {"date": target_date.strftime("%Y-%m-%d")}

    if commodity:
        conditions.append("LOWER(commodity) = LOWER(%(commodity)s)")
        params["commodity"] = commodity
    if soko:
        conditions.append("LOWER(soko) = LOWER(%(soko)s)")
        params["soko"] = soko

    sql = f"""
        SELECT date, soko, commodity, consensus_price as price, unit,
               submissions_used, confidence, price_min, price_max, outliers_rejected
        FROM consensus_prices cp
        LEFT JOIN LATERAL (
            SELECT unit FROM market_prices
            WHERE date = cp.date AND soko = cp.soko AND commodity = cp.commodity
            LIMIT 1
        ) u ON TRUE
        WHERE {' AND '.join(conditions)}
        ORDER BY soko, commodity
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]


if __name__ == "__main__":
    import sys
    init_consensus_schema()
    if len(sys.argv) > 1 and sys.argv[1] == "--scores":
        update_dalali_scores()
    else:
        result = compute_consensus_for_date()
        print(f"\n✅ Consensus: {result['processed']} groups")
        for g in result["groups"]:
            flag = "⚠️" if g["outliers_rejected"] else "✓"
            print(f"  {flag} {g['soko']:12} {g['commodity']:20} "
                  f"TZS {g['consensus_price']:>8,.0f}  "
                  f"conf={g['confidence']:.2f}  "
                  f"n={g['submissions_total']}")
