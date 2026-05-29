"""
SokoAI v2 — FastAPI Main (with Redis Cache)
Bei endpoints zimewekwa cache kwa Redis.
Invalidation inafanyika baada ya SMS mpya au retrain.
"""

from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sms_parser.sms_parser import parse_sms
from api.database import (
    get_latest_prices, get_price_history, get_forecasts,
    ingest_sms, validate_api_key, create_api_key, get_conn,
)
from api.auth_routes import router as auth_router, get_current_user, require_admin
from cache.redis_cache import (
    cache_get, cache_set, cache_delete_pattern,
    cache_key, invalidate_prices, invalidate_forecasts,
    redis_health, close_redis,
    TTL_PRICES, TTL_FORECAST, TTL_HISTORY, TTL_META, TTL_ALERTS,
)

# ── Lifespan (startup / shutdown) ─────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("✅ SokoAI API starting — Redis connecting...")
    yield
    await close_redis()
    print("👋 SokoAI API shutting down.")

app = FastAPI(
    title="SokoAI API",
    description="API ya Bei za Masoko Tanzania — Powered by SokoAI v2",
    version="2.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(auth_router)

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "change-this-secret")


# ── Auth ─────────────────────────────────────────────────────────
async def require_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    client = validate_api_key(x_api_key)
    if not client:
        raise HTTPException(status_code=401, detail={
            "error":   "invalid_api_key",
            "message": "API key batili au imefika kikomo cha maombi ya leo.",
        })
    return client


# ── Models ────────────────────────────────────────────────────────
class SMSWebhook(BaseModel):
    message:     str
    sender:      Optional[str] = None
    received_at: Optional[datetime] = None

class CreateKeyRequest(BaseModel):
    client_name:  str
    plan:         str = "free"
    admin_secret: str


# ── Helpers ───────────────────────────────────────────────────────
def serialize(rows):
    out = []
    for r in rows:
        d = dict(r)
        for k, v in d.items():
            if hasattr(v, "isoformat"):
                d[k] = v.isoformat()
        out.append(d)
    return out

def get_alert_msg(current, pred_4w):
    if not current or current == 0:
        return {"code": "IMARA", "message": "Hakuna data ya kutosha"}
    change = ((pred_4w - current) / current) * 100
    if change > 5:
        return {"code": "NUNUA_SASA", "message": f"Bei inatarajiwa kupanda {change:.1f}% wiki 4 zijazo"}
    elif change < -5:
        return {"code": "SUBIRI", "message": f"Bei inatarajiwa kushuka {abs(change):.1f}% wiki 4 zijazo"}
    return {"code": "IMARA", "message": "Bei iko imara — hakuna mabadiliko makubwa"}


# ── Endpoints ─────────────────────────────────────────────────────

@app.get("/health")
async def health():
    redis = await redis_health()
    return {
        "status":  "ok",
        "version": "2.1.0",
        "time":    datetime.now().isoformat(),
        "redis":   redis,
    }


@app.get("/api/v1/prices")
async def get_prices(
    bidhaa: Optional[str] = Query(None),
    soko:   Optional[str] = Query(None),
    mkoa:   Optional[str] = Query(None),
    client=Depends(require_api_key),
):
    key = cache_key("prices", bidhaa, soko, mkoa)
    cached = await cache_get(key)
    if cached:
        return {**cached, "cache": "hit"}

    rows = get_latest_prices(commodity=bidhaa, soko=soko, mkoa=mkoa)
    if not rows:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Hakuna bei zilizopatikana."})

    result = {
        "status": "success",
        "count":  len(rows),
        "tarehe": datetime.now().strftime("%Y-%m-%d"),
        "data":   serialize(rows),
        "cache":  "miss",
    }
    await cache_set(key, result, TTL_PRICES)
    return result


@app.get("/api/v1/prices/history")
async def get_history(
    bidhaa: str = Query(...),
    soko:   Optional[str] = Query(None),
    siku:   int = Query(90, ge=7, le=365),
    client=Depends(require_api_key),
):
    key = cache_key("history", bidhaa, soko, siku)
    cached = await cache_get(key)
    if cached:
        return {**cached, "cache": "hit"}

    rows = get_price_history(commodity=bidhaa, soko=soko, days=siku)
    if not rows:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": f"Hakuna historia kwa '{bidhaa}'."})

    prices = [float(r["price"]) for r in rows]
    result = {
        "status":   "success",
        "bidhaa":   bidhaa,
        "soko":     soko or "Masoko yote",
        "siku":     siku,
        "takwimu": {
            "bei_ya_chini": min(prices),
            "bei_ya_juu":   max(prices),
            "wastani":      round(sum(prices)/len(prices), 2),
        },
        "historia": serialize(rows),
        "cache":    "miss",
    }
    await cache_set(key, result, TTL_HISTORY)
    return result


@app.get("/api/v1/forecast")
async def get_forecast(
    bidhaa: str = Query(...),
    soko:   Optional[str] = Query(None),
    client=Depends(require_api_key),
):
    key = cache_key("forecast", bidhaa, soko)
    cached = await cache_get(key)
    if cached:
        return {**cached, "cache": "hit"}

    forecasts = get_forecasts(commodity=bidhaa, soko=soko)
    if not forecasts:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": f"Hakuna utabiri kwa '{bidhaa}'."})

    cur_rows = get_latest_prices(commodity=bidhaa, soko=soko)
    current  = float(cur_rows[0]["price"]) if cur_rows else 0.0
    weekly   = {f"wiki_{f['week_ahead']}": float(f["predicted"]) for f in forecasts}
    pred_4w  = weekly.get("wiki_4", current)
    alert    = get_alert_msg(current, pred_4w)

    result = {
        "status":          "success",
        "bidhaa":          bidhaa,
        "soko":            soko or "DSM (wastani)",
        "bei_ya_sasa":     current,
        "utabiri_wa_bei":  weekly,
        "alert":           alert,
        "sababu":          "Mwenendo wa bei unaonyesha mabadiliko ya msimu." if abs(pred_4w-current) > current*0.05 else "Bei inatarajiwa kubaki imara.",
        "model":           "Prophet+XGBoost v2",
        "cache":           "miss",
    }
    await cache_set(key, result, TTL_FORECAST)
    return result


@app.get("/api/v1/commodities")
async def list_commodities(client=Depends(require_api_key)):
    key = cache_key("commodities")
    cached = await cache_get(key)
    if cached:
        return {**cached, "cache": "hit"}

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT commodity, category, unit FROM market_prices ORDER BY category, commodity")
            rows = cur.fetchall()

    result = {
        "status": "success",
        "count":  len(rows),
        "bidhaa": [{"jina": r[0], "kategoria": r[1], "kipimo": r[2]} for r in rows],
    }
    await cache_set(key, result, TTL_META)
    return result


@app.get("/api/v1/masoko")
async def list_masoko(mkoa: Optional[str] = Query(None), client=Depends(require_api_key)):
    key = cache_key("masoko", mkoa)
    cached = await cache_get(key)
    if cached:
        return {**cached, "cache": "hit"}

    params, where = {}, ""
    if mkoa:
        where = "WHERE LOWER(mkoa) = LOWER(%(mkoa)s)"
        params["mkoa"] = mkoa

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT DISTINCT soko, mkoa, MAX(date) last_update
                FROM market_prices {where}
                GROUP BY soko, mkoa ORDER BY mkoa, soko
            """, params)
            rows = cur.fetchall()

    result = {
        "status": "success",
        "count":  len(rows),
        "masoko": [{"soko": r[0], "mkoa": r[1], "tarehe_data": str(r[2])} for r in rows],
    }
    await cache_set(key, result, TTL_META)
    return result


@app.get("/api/v1/alerts")
async def get_all_alerts(client=Depends(require_api_key)):
    """Smart alerts za bidhaa zote — kwa dashboard ya frontend."""
    key = cache_key("alerts", "all")
    cached = await cache_get(key)
    if cached:
        return {**cached, "cache": "hit"}

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT ON (commodity) commodity, price, unit, date
                FROM market_prices ORDER BY commodity, date DESC
            """)
            cur_prices = {r[0]: {"price": float(r[1]), "unit": r[2]} for r in cur.fetchall()}

            cur.execute("""
                SELECT DISTINCT ON (commodity) commodity, week_ahead, predicted
                FROM predictions WHERE generated_at::DATE = (SELECT MAX(generated_at::DATE) FROM predictions)
                AND week_ahead = 4 ORDER BY commodity, generated_at DESC
            """)
            pred_4w = {r[0]: float(r[2]) for r in cur.fetchall()}

    alerts = []
    for commodity, cp in cur_prices.items():
        current = cp["price"]
        p4w     = pred_4w.get(commodity, current)
        alert   = get_alert_msg(current, p4w)
        alerts.append({
            "commodity":     commodity,
            "label":         commodity,
            "current_price": current,
            "pred_4w":       p4w,
            "unit":          cp["unit"],
            "alert":         alert["code"],
            "message":       alert["message"],
        })

    result = {"status": "success", "alerts": alerts}
    await cache_set(key, result, TTL_ALERTS)
    return result


@app.post("/api/v1/webhook/sms")
async def receive_sms(payload: SMSWebhook):
    """Webhook ya madalali — hakuna API key inahitajika."""
    parsed = parse_sms(
        message=payload.message,
        sender=payload.sender,
        received_at=payload.received_at,
    )
    if not parsed:
        raise HTTPException(status_code=400, detail={
            "error":   "invalid_format",
            "message": "Ujumbe haujaanzia na #DATA_SOKO au una muundo mbaya.",
        })

    result = ingest_sms(parsed)

    # Invalidate cache kwa soko hili
    for item in parsed["items"]:
        await invalidate_prices(commodity=item["commodity"], soko=parsed["soko"])

    return {
        "status":        "success",
        "message":       f"Asante! Bei {result['records_saved']} za {parsed['soko']} zimehifadhiwa.",
        "submission_id": result["submission_id"],
        "records_saved": result["records_saved"],
        "soko":          parsed["soko"],
        "tarehe":        parsed["date"],
    }


@app.post("/api/v1/admin/api-key")
async def generate_api_key(req: CreateKeyRequest):
    if req.admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Siri ya admin si sahihi.")
    raw_key = create_api_key(client_name=req.client_name, plan=req.plan)
    rate_limits = {"free":100,"basic":1000,"pro":10000,"enterprise":100000}
    return {
        "status":      "success",
        "api_key":     raw_key,
        "client_name": req.client_name,
        "plan":        req.plan,
        "rate_limit":  f"{rate_limits.get(req.plan,100)} requests/siku",
    }


@app.post("/api/v1/admin/cache/clear")
async def clear_cache(user=Depends(require_admin)):
    """Admin only — futa cache yote."""
    await cache_delete_pattern("*")
    return {"status": "success", "message": "Cache imefutwa yote."}


@app.post("/api/v1/admin/cache/invalidate-forecasts")
async def invalidate_all_forecasts(user=Depends(require_admin)):
    """Itwa baada ya retrain — invalidate forecasts zote."""
    await invalidate_forecasts()
    return {"status": "success", "message": "Forecast cache imefutwa — itajengwa upya."}
