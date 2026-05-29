"""
SokoAI — Smart Alert Engine
Inatengeneza alerts tatu:
  1. Price Drop Alert  — bei imeshuka >10% → Nunua sasa
  2. Spike Alert       — bei imepanda ghafla → Mbadala zipo
  3. Trend Alert       — mwenendo wa wiki 8 → Panga mapema

Pia ina:
  - Substitute recommendations (bidhaa mbadala)
  - Tanzania Seasonal Calendar (misimu ya mvua/mavuno kwa mkoa)
  - WhatsApp digest ya kila wiki
"""

import psycopg2, psycopg2.extras
import os, json, logging
from datetime import date, datetime, timedelta
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("SokoAI.Alerts")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/sokoai")

def get_conn():
    return psycopg2.connect(DATABASE_URL)


# ── Tanzania Seasonal Calendar ────────────────────────────────────
# Misimu ya mvua na mavuno kwa kanda tofauti za Tanzania
TZ_SEASONS = {
    # Masika (mvua kubwa) — Machi-Mei, Pwani na Kaskazini
    "masika": {
        "months": [3, 4, 5],
        "regions": ["Dar es Salaam", "Tanga", "Pwani", "Morogoro", "Kilimanjaro", "Arusha"],
        "effect": "Bei za mboga hushuka (zinalimwa wingi). Bei za nafaka hupanda (barabara mbaya).",
        "price_impact": {"MBOGA": -0.15, "NAFAKA": 0.10},
    },
    # Vuli (mvua ndogo) — Oktoba-Desemba, Kaskazini
    "vuli": {
        "months": [10, 11, 12],
        "regions": ["Kilimanjaro", "Arusha", "Manyara", "Tanga"],
        "effect": "Mavuno madogo ya nafaka. Bei za chakula hushuka kidogo.",
        "price_impact": {"NAFAKA": -0.08, "MBOGA": -0.05},
    },
    # Kiangazi (ukame) — Juni-Septemba
    "kiangazi": {
        "months": [6, 7, 8, 9],
        "regions": ["ALL"],
        "effect": "Uhaba wa mboga freshi. Bei za mboga na matunda hupanda.",
        "price_impact": {"MBOGA": 0.20, "MATUNDA": 0.15, "NAFAKA": 0.05},
    },
    # Mavuno makubwa — Mei-Juli (kanda za juu)
    "mavuno": {
        "months": [5, 6, 7],
        "regions": ["Iringa", "Mbeya", "Songea", "Rukwa", "Njombe"],
        "effect": "Nafaka nyingi sokoni. Bei za mahindi, maharagwe, viazi hushuka sana.",
        "price_impact": {"NAFAKA": -0.25, "MBOGA": -0.10},
    },
}

def get_current_season(mkoa: str = "Dar es Salaam") -> Optional[dict]:
    month = datetime.now().month
    for season_name, data in TZ_SEASONS.items():
        if month in data["months"]:
            if "ALL" in data["regions"] or mkoa in data["regions"]:
                return {"season": season_name, **data}
    return None


# ── Substitute Commodities ────────────────────────────────────────
SUBSTITUTES = {
    "Nyanya":    ["Hoho", "Pilipili", "Karoti"],
    "Hoho":      ["Nyanya", "Pilipili"],
    "Vitunguu":  ["Kitunguu saumu", "Vitunguu maji"],
    "Mahindi":   ["Mchele", "Ngano", "Uwele"],
    "Mchele":    ["Mahindi", "Ngano", "Mtama"],
    "Sukari":    ["Asali", "Sukari Mbichi"],
    "Maharage":  ["Dengu", "Choroko", "Mbaazi"],
    "Viazi":     ["Muhogo", "Ndizi", "Viazi Vitamu"],
    "Mafuta ya Kupikia": ["Siagi ya Karanga", "Mafuta ya Nazi"],
    "Nyama":     ["Samaki", "Mayai", "Maharage"],
    "Samaki":    ["Nyama", "Mayai", "Viroboto"],
}

def get_substitutes(commodity: str, current_db_prices: dict) -> list[dict]:
    """
    Pata bidhaa mbadala + bei zao za sasa.
    current_db_prices: {commodity: price}
    """
    subs = SUBSTITUTES.get(commodity, [])
    result = []
    for sub in subs:
        price = current_db_prices.get(sub)
        result.append({
            "commodity": sub,
            "price":     price,
            "available": price is not None,
        })
    return result


# ── Alert Computation ─────────────────────────────────────────────
def compute_price_change(commodity: str, soko: Optional[str] = None,
                         days_back: int = 7) -> Optional[dict]:
    """Hesabu mabadiliko ya bei kwa siku N zilizopita."""
    params = {"commodity": commodity, "days": days_back}
    soko_filter = ""
    if soko:
        soko_filter = "AND LOWER(soko) = LOWER(%(soko)s)"
        params["soko"] = soko

    sql = f"""
        SELECT date, AVG(price) as price
        FROM market_prices
        WHERE LOWER(commodity) = LOWER(%(commodity)s)
          {soko_filter}
          AND date >= CURRENT_DATE - %(days)s
        GROUP BY date ORDER BY date ASC
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

    if len(rows) < 2:
        return None

    old_price = float(rows[0]["price"])
    new_price = float(rows[-1]["price"])
    change_pct = ((new_price - old_price) / old_price) * 100

    return {
        "old_price":   round(old_price, 2),
        "new_price":   round(new_price, 2),
        "change_pct":  round(change_pct, 2),
        "days_back":   days_back,
        "is_spike":    change_pct > 15,
        "is_drop":     change_pct < -10,
    }


def get_forecast_trend(commodity: str) -> Optional[dict]:
    """Toa mwenendo wa wiki 8 kutoka predictions."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT week_ahead, predicted, target_date
                FROM predictions
                WHERE LOWER(commodity) = LOWER(%(commodity)s)
                  AND generated_at::DATE = (SELECT MAX(generated_at::DATE) FROM predictions)
                ORDER BY week_ahead ASC
            """, {"commodity": commodity})
            rows = cur.fetchall()

    if not rows:
        return None

    prices = [float(r["predicted"]) for r in rows]
    first, last = prices[0], prices[-1]
    trend_pct = ((last - first) / first) * 100 if first > 0 else 0

    return {
        "week_1":    round(first, 0),
        "week_8":    round(last, 0),
        "trend_pct": round(trend_pct, 2),
        "is_rising": trend_pct > 5,
        "is_falling": trend_pct < -5,
        "weekly":    [{"week": r["week_ahead"], "price": float(r["predicted"]),
                       "date": str(r["target_date"])} for r in rows],
    }


def generate_alerts(mkoa: str = "Dar es Salaam") -> list[dict]:
    """
    Tengeneza alerts zote kwa bidhaa zote.
    Inarudisha list ya alerts zilizopangwa kwa priority.
    """
    # Chukua bidhaa zote
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT commodity, category FROM market_prices")
            commodities = cur.fetchall()

            # Bei za sasa kwa substitutes
            cur.execute("""
                SELECT DISTINCT ON (commodity) commodity, price
                FROM market_prices ORDER BY commodity, date DESC
            """)
            current_prices = {r[0]: float(r[1]) for r in cur.fetchall()}

    season = get_current_season(mkoa)
    alerts = []

    for commodity, category in commodities:
        change = compute_price_change(commodity, days_back=7)
        trend  = get_forecast_trend(commodity)

        if not change and not trend:
            continue

        alert_list = []

        # ── 1. Price Drop Alert ──────────────────────────────────
        if change and change["is_drop"]:
            alert_list.append({
                "type":     "PRICE_DROP",
                "priority": 1,
                "title":    f"💚 Bei ya {commodity} imeshuka!",
                "message":  (f"Bei imeshuka {abs(change['change_pct']):.1f}% wiki hii. "
                             f"Sasa TZS {change['new_price']:,.0f} (ilikuwa {change['old_price']:,.0f}). "
                             "Nunua sasa kabla haijapanda tena."),
                "action":   "NUNUA_SASA",
                "savings":  round(change["old_price"] - change["new_price"], 0),
            })

        # ── 2. Spike Alert ───────────────────────────────────────
        if change and change["is_spike"]:
            subs = get_substitutes(commodity, current_prices)
            available_subs = [s for s in subs if s["available"]]
            sub_msg = ""
            if available_subs:
                sub_names = ", ".join(s["commodity"] for s in available_subs[:2])
                sub_msg = f" Fikiria kutumia: {sub_names}."

            alert_list.append({
                "type":        "SPIKE",
                "priority":    1,
                "title":       f"🔴 Bei ya {commodity} imepanda sana!",
                "message":     (f"Bei imepanda {change['change_pct']:.1f}% wiki hii. "
                               f"Sasa TZS {change['new_price']:,.0f}.{sub_msg}"),
                "action":      "SUBIRI_AU_BADILISHA",
                "substitutes": available_subs[:3],
            })

        # ── 3. Trend Alert (wiki 8) ──────────────────────────────
        if trend and (trend["is_rising"] or trend["is_falling"]):
            direction = "kupanda" if trend["is_rising"] else "kushuka"
            emoji     = "📈" if trend["is_rising"] else "📉"
            action    = "NUNUA_SASA" if trend["is_rising"] else "SUBIRI"

            alert_list.append({
                "type":      "TREND",
                "priority":  2,
                "title":     f"{emoji} {commodity} inatarajiwa {direction}",
                "message":   (f"Bei itaenda {direction} {abs(trend['trend_pct']):.1f}% "
                             f"katika wiki 8 zijazo. "
                             f"Wiki 1: TZS {trend['week_1']:,.0f} → Wiki 8: TZS {trend['week_8']:,.0f}."),
                "action":    action,
                "trend_pct": trend["trend_pct"],
                "forecast":  trend["weekly"],
            })

        # ── 4. Seasonal Alert ────────────────────────────────────
        if season and category in season.get("price_impact", {}):
            impact = season["price_impact"][category]
            if abs(impact) >= 0.10:
                direction = "kupanda" if impact > 0 else "kushuka"
                emoji     = "🌧️" if season["season"] == "masika" else "☀️"
                alert_list.append({
                    "type":     "SEASONAL",
                    "priority": 3,
                    "title":    f"{emoji} Msimu wa {season['season'].title()} unaathiri bei",
                    "message":  (f"Katika msimu huu, bei za {category.lower()} "
                                f"huwa na mwelekeo wa {direction} ~{abs(impact*100):.0f}%. "
                                f"{season['effect']}"),
                    "action":   "ANGALIA",
                    "season":   season["season"],
                })

        if alert_list:
            alerts.append({
                "commodity": commodity,
                "category":  category,
                "alerts":    sorted(alert_list, key=lambda x: x["priority"]),
                "current_price": current_prices.get(commodity),
            })

    # Panga kwa priority — SPIKE na DROP kwanza
    alerts.sort(key=lambda x: min(a["priority"] for a in x["alerts"]))
    log.info(f"Generated {len(alerts)} commodity alerts")
    return alerts


# ── Weekly Digest ─────────────────────────────────────────────────
def generate_weekly_digest(mkoa: str = "Dar es Salaam") -> dict:
    """
    Tengeneza muhtasari wa wiki kwa WhatsApp.
    Itatumwa kila Jumanne asubuhi.
    """
    alerts = generate_alerts(mkoa)
    season = get_current_season(mkoa)

    # Bidhaa bora za wiki (zilizoshuka zaidi)
    drops  = []
    spikes = []
    for a in alerts:
        for al in a["alerts"]:
            if al["type"] == "PRICE_DROP":
                drops.append({"commodity": a["commodity"], **al})
            elif al["type"] == "SPIKE":
                spikes.append({"commodity": a["commodity"], **al})

    # Format WhatsApp message
    lines = [
        f"📊 *SokoAI — Ripoti ya Wiki*",
        f"📅 {datetime.now().strftime('%d %B %Y')}",
        f"📍 {mkoa}",
        "",
    ]

    if season:
        lines += [f"🌿 *Msimu: {season['season'].upper()}*", season["effect"], ""]

    if drops:
        lines.append("💚 *BEI ZILIZOSHUKA — Fursa za Kununua:*")
        for d in drops[:3]:
            lines.append(f"  • {d['commodity']}: ↓ {abs(d.get('change_pct',0)):.1f}%")
        lines.append("")

    if spikes:
        lines.append("🔴 *BEI ZILIZOPANDA — Angalia:*")
        for s in spikes[:3]:
            lines.append(f"  • {s['commodity']}: ↑ {s.get('change_pct',0):.1f}%")
        lines.append("")

    lines += [
        "📱 Angalia bei zote: sokoai.tz",
        "_Tuma #DATA_SOKO kutuma bei za soko lako_",
    ]

    return {
        "date":    datetime.now().strftime("%Y-%m-%d"),
        "mkoa":    mkoa,
        "message": "\n".join(lines),
        "drops":   drops[:5],
        "spikes":  spikes[:5],
        "season":  season,
        "total_alerts": len(alerts),
    }


# ── DB Schema for alerts ──────────────────────────────────────────
ALERTS_SCHEMA = """
CREATE TABLE IF NOT EXISTS smart_alerts (
    id           SERIAL PRIMARY KEY,
    commodity    TEXT NOT NULL,
    alert_type   TEXT NOT NULL,  -- PRICE_DROP | SPIKE | TREND | SEASONAL
    priority     INT DEFAULT 2,
    title        TEXT NOT NULL,
    message      TEXT NOT NULL,
    action       TEXT,
    data         JSONB,
    mkoa         TEXT,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    expires_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_commodity ON smart_alerts(commodity);
CREATE INDEX IF NOT EXISTS idx_alerts_active    ON smart_alerts(is_active, created_at);
"""

def save_alerts(alerts: list[dict], mkoa: str = "Dar es Salaam"):
    """Hifadhi alerts DB — invalidate za zamani kwanza."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE smart_alerts SET is_active = FALSE WHERE mkoa = %s", (mkoa,))
            for a in alerts:
                for al in a["alerts"]:
                    cur.execute("""
                        INSERT INTO smart_alerts
                            (commodity, alert_type, priority, title, message, action, data, mkoa, expires_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s, NOW() + INTERVAL '24 hours')
                    """, (
                        a["commodity"], al["type"], al["priority"],
                        al["title"], al["message"], al["action"],
                        json.dumps({k:v for k,v in al.items()
                                    if k not in ("title","message","action","type","priority")}),
                        mkoa,
                    ))
        conn.commit()


if __name__ == "__main__":
    digest = generate_weekly_digest()
    print("\n" + "="*60)
    print(digest["message"])
    print("="*60)
    print(f"\n{digest['total_alerts']} commodities zina alerts")
