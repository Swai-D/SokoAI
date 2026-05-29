"""
SokoAI v2 — REST API
Built with FastAPI. Provides current prices, history, forecasts,
and a webhook endpoint for WhatsApp SMS ingestion.

Endpoints:
  GET  /api/v1/prices          — bei za leo
  GET  /api/v1/prices/history  — historia ya bei
  GET  /api/v1/forecast        — utabiri wa wiki 8
  GET  /api/v1/commodities     — orodha ya bidhaa
  GET  /api/v1/masoko          — orodha ya masoko
  POST /api/v1/webhook/sms     — ingiza ujumbe wa mdalali
  POST /api/v1/admin/api-key   — tengeneza API key mpya
  GET  /health                 — health check
"""

from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from sms_parser.sms_parser import parse_sms
from api.database import (
    get_latest_prices, get_price_history, get_forecasts,
    ingest_sms, validate_api_key, create_api_key, get_conn
)

# ─── App setup ────────────────────────────────────────────────────
app = FastAPI(
    title="SokoAI API",
    description="API ya Bei za Masoko Tanzania — Powered by SokoAI",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "change-this-secret")


# ─── Auth dependency ──────────────────────────────────────────────
async def require_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    """Validate API key from X-API-Key header."""
    client = validate_api_key(x_api_key)
    if not client:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "invalid_api_key",
                "message": "API key batili au imefika kikomo cha maombi ya leo.",
                "info": "Wasiliana na SokoAI kupata key: sokoai.tz"
            }
        )
    return client


# ─── Request/Response models ──────────────────────────────────────
class SMSWebhook(BaseModel):
    message: str
    sender: Optional[str] = None
    received_at: Optional[datetime] = None

class CreateKeyRequest(BaseModel):
    client_name: str
    plan: str = "free"
    admin_secret: str


# ─── Helpers ──────────────────────────────────────────────────────
def price_row_to_dict(row: dict) -> dict:
    """Serialize a DB row for API response (handle date objects)."""
    r = dict(row)
    if hasattr(r.get("date"), "isoformat"):
        r["date"] = r["date"].isoformat()
    if hasattr(r.get("generated_at"), "isoformat"):
        r["generated_at"] = r["generated_at"].isoformat()
    return r


def get_alert(current: float, pred_4w: float) -> dict:
    if current == 0:
        return {"code": "IMARA", "message": "Hakuna data ya kutosha"}
    change = ((pred_4w - current) / current) * 100
    if change > 5:
        return {"code": "NUNUA_SASA",
                "message": f"Bei inatarajiwa kupanda {change:.1f}% wiki 4 zijazo"}
    elif change < -5:
        return {"code": "SUBIRI",
                "message": f"Bei inatarajiwa kushuka {abs(change):.1f}% wiki 4 zijazo"}
    return {"code": "IMARA", "message": "Bei iko imara — hakuna mabadiliko makubwa"}


# ─── Endpoints ────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "SokoAI API v2", "time": datetime.now().isoformat()}


@app.get("/api/v1/prices")
def get_prices(
    bidhaa:    Optional[str] = Query(None, description="Jina la bidhaa, e.g. Nyanya"),
    soko:      Optional[str] = Query(None, description="Jina la soko, e.g. Kariakoo"),
    mkoa:      Optional[str] = Query(None, description="Mkoa, e.g. Dar es Salaam"),
    client=Depends(require_api_key),
):
    """
    Bei za leo kwa bidhaa / soko / mkoa.
    Bila filter — inarudisha bei zote za hivi karibuni.
    """
    rows = get_latest_prices(commodity=bidhaa, soko=soko, mkoa=mkoa)
    if not rows:
        raise HTTPException(status_code=404, detail={
            "error": "not_found",
            "message": f"Hakuna bei zilizopatikana kwa vigezo vilivyotolewa.",
        })

    return {
        "status":  "success",
        "count":   len(rows),
        "tarehe":  datetime.now().strftime("%Y-%m-%d"),
        "data":    [price_row_to_dict(r) for r in rows],
    }


@app.get("/api/v1/prices/history")
def get_history(
    bidhaa: str = Query(..., description="Jina la bidhaa (lazima)"),
    soko:   Optional[str] = Query(None),
    siku:   int = Query(90, ge=7, le=365, description="Idadi ya siku (7-365)"),
    client=Depends(require_api_key),
):
    """Historia ya bei kwa bidhaa fulani, na chati-ready data."""
    rows = get_price_history(commodity=bidhaa, soko=soko, days=siku)
    if not rows:
        raise HTTPException(status_code=404, detail={
            "error": "not_found",
            "message": f"Hakuna historia ya bei kwa '{bidhaa}'.",
        })

    prices = [price_row_to_dict(r) for r in rows]
    price_values = [r["price"] for r in rows]

    return {
        "status":   "success",
        "bidhaa":   bidhaa,
        "soko":     soko or "Masoko yote",
        "siku":     siku,
        "takwimu": {
            "bei_ya_chini": min(price_values),
            "bei_ya_juu":   max(price_values),
            "wastani":      round(sum(price_values) / len(price_values), 2),
        },
        "historia": prices,
    }


@app.get("/api/v1/forecast")
def get_forecast(
    bidhaa: str = Query(..., description="Jina la bidhaa (lazima)"),
    soko:   Optional[str] = Query(None),
    mkoa:   Optional[str] = Query(None, description="Mkoa (optional)"),
    client=Depends(require_api_key),
):
    """
    Utabiri wa bei kwa wiki 8 zijazo.
    Inatoa pia smart alert: NUNUA_SASA / SUBIRI / IMARA.
    """
    forecasts = get_forecasts(commodity=bidhaa, soko=soko)
    if not forecasts:
        raise HTTPException(status_code=404, detail={
            "error": "not_found",
            "message": f"Hakuna utabiri kwa '{bidhaa}'. Jaribu tena baadaye.",
        })

    # Current price for alert calculation
    current_rows = get_latest_prices(commodity=bidhaa, soko=soko)
    current_price = float(current_rows[0]["price"]) if current_rows else 0.0

    weekly = {}
    for f in forecasts:
        weekly[f"wiki_{f['week_ahead']}"] = float(f["predicted"])

    pred_4w = weekly.get("wiki_4", current_price)
    alert   = get_alert(current_price, pred_4w)

    # Reason generation based on forecast trend
    if weekly.get("wiki_4", 0) > weekly.get("wiki_1", 0):
        sababu = "Mwenendo wa bei unaonyesha ongezeko — msimu wa mahitaji makubwa unakaribia."
    elif weekly.get("wiki_4", 0) < weekly.get("wiki_1", 0):
        sababu = "Mwenendo wa bei unaonyesha kupungua — msimu wa mavuno unategemewa."
    else:
        sababu = "Bei inatarajiwa kubaki imara kwa wiki zijazo."

    return {
        "status":        "success",
        "bidhaa":        bidhaa,
        "soko":          soko or "DSM (wastani)",
        "bei_ya_sasa":   current_price,
        "utabiri_wa_bei": weekly,
        "alert":          alert,
        "sababu":         sababu,
        "model":          forecasts[0].get("model_version", "v2") if forecasts else "v2",
        "tarehe_utabiri": forecasts[0]["generated_at"].isoformat() if forecasts and hasattr(forecasts[0].get("generated_at"), "isoformat") else None,
    }


@app.get("/api/v1/commodities")
def list_commodities(client=Depends(require_api_key)):
    """Orodha ya bidhaa zote zilizo kwenye database."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT commodity, category, unit
                FROM market_prices
                ORDER BY category, commodity
            """)
            rows = cur.fetchall()
    return {
        "status": "success",
        "count":  len(rows),
        "bidhaa": [{"jina": r[0], "kategoria": r[1], "kipimo": r[2]} for r in rows],
    }


@app.get("/api/v1/masoko")
def list_masoko(
    mkoa: Optional[str] = Query(None),
    client=Depends(require_api_key),
):
    """Orodha ya masoko yote kwenye database."""
    params = {}
    where = ""
    if mkoa:
        where = "WHERE LOWER(mkoa) = LOWER(%(mkoa)s)"
        params["mkoa"] = mkoa

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT DISTINCT soko, mkoa, MAX(date) as last_update
                FROM market_prices
                {where}
                GROUP BY soko, mkoa
                ORDER BY mkoa, soko
            """, params)
            rows = cur.fetchall()
    return {
        "status": "success",
        "count":  len(rows),
        "masoko": [{"soko": r[0], "mkoa": r[1], "tarehe_data": str(r[2])} for r in rows],
    }


@app.post("/api/v1/webhook/sms")
def receive_sms(payload: SMSWebhook):
    """
    Webhook endpoint — inapokea ujumbe wa WhatsApp/SMS kutoka kwa madalali.
    Hii endpoint HAINA auth (madalali hawapaswi kuwa na API key).
    Unaweza kulinda kwa IP whitelist kwenye nginx.
    """
    parsed = parse_sms(
        message=payload.message,
        sender=payload.sender,
        received_at=payload.received_at,
    )

    if not parsed:
        raise HTTPException(status_code=400, detail={
            "error":   "invalid_format",
            "message": "Ujumbe haujaanzia na #DATA_SOKO au una muundo mbaya.",
            "mfano":   "#DATA_SOKO\nSoko: Kariakoo\nMkoa: Dar es Salaam\n--- NAFAKA ---\nMahindi (Kilo): 900",
        })

    result = ingest_sms(parsed)

    return {
        "status":        "success",
        "message":       f"Asante! Bei {result['records_saved']} za {parsed['soko']} zimehifadhiwa.",
        "submission_id": result["submission_id"],
        "records_saved": result["records_saved"],
        "soko":          parsed["soko"],
        "tarehe":        parsed["date"],
    }


@app.post("/api/v1/admin/api-key")
def generate_api_key(req: CreateKeyRequest):
    """Admin endpoint — tengeneza API key mpya kwa mteja."""
    if req.admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Siri ya admin si sahihi.")

    if req.plan not in ["free", "basic", "pro", "enterprise"]:
        raise HTTPException(status_code=400, detail="Plan lazima iwe: free, basic, pro, enterprise")

    raw_key = create_api_key(client_name=req.client_name, plan=req.plan)
    rate_limits = {"free": 100, "basic": 1000, "pro": 10000, "enterprise": 100000}

    return {
        "status":      "success",
        "api_key":     raw_key,
        "client_name": req.client_name,
        "plan":        req.plan,
        "rate_limit":  f"{rate_limits[req.plan]} requests/siku",
        "note":        "Hifadhi key hii vizuri — haitaonyeshwa tena.",
    }
