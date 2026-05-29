"""
SokoAI v2 — SMS/WhatsApp Data Parser
Parses structured market price messages from madalali.

Supported format:
  #DATA_SOKO
  Soko: Kariakoo
  Mkoa: Dar es Salaam
  --- NAFAKA & VIWANDANI ---
  Mahindi (Kilo): 900
  ...
"""

import re
from datetime import datetime
from typing import Optional


# ─── Unit normalization ───────────────────────────────────────────
UNIT_MAP = {
    "kilo": "kg", "kg": "kg", "kgs": "kg",
    "lita": "lita", "liter": "lita", "litre": "lita",
    "lita 5": "lita_5", "liter 5": "lita_5",
    "gunia": "gunia", "mfuko": "gunia",
    "tenga": "tenga",
    "fungu": "fungu",
    "debe": "debe",
    "ndoo": "ndoo",
}

# Commodity name normalization (Swahili variants → standard name)
COMMODITY_MAP = {
    "mahindi": "Mahindi",
    "mchele": "Mchele",
    "maharage": "Maharage", "maharagwe": "Maharage", "beans": "Maharage",
    "viazi": "Viazi", "viazi mviringo": "Viazi",
    "ngano": "Ngano", "unga wa ngano": "Ngano",
    "sukari": "Sukari",
    "mafuta": "Mafuta ya Kupikia",
    "mafuta ya kupikia": "Mafuta ya Kupikia",
    "nyanya": "Nyanya",
    "vitunguu": "Vitunguu", "tunguu": "Vitunguu",
    "hoho": "Hoho",
    "karoti": "Karoti",
    "bamia": "Bamia",
    "kabichi": "Kabichi", "kabeji": "Kabichi",
    "spinachi": "Spinachi", "mchicha": "Mchicha",
    "pilipili": "Pilipili",
    "ndizi": "Ndizi",
    "embe": "Embe", "maembe": "Embe",
    "nanasi": "Nanasi",
    "papai": "Papai",
}

CATEGORY_KEYWORDS = {
    "NAFAKA": ["nafaka", "viwandani", "grain", "cereal"],
    "MBOGA":  ["mbogamboga", "mboga", "vegetable"],
    "MATUNDA": ["matunda", "fruit"],
    "SAMAKI": ["samaki", "fish"],
    "NYAMA":  ["nyama", "meat"],
}

HALI_MAP = {
    "nyingi": "Nyingi", "wingi": "Nyingi", "abundant": "Nyingi",
    "wastani": "Wastani", "normal": "Wastani", "kawaida": "Wastani",
    "chache": "Chache", "pungufu": "Chache", "scarce": "Chache",
    "haba": "Chache",
}


def normalize_unit(raw: str) -> str:
    raw = raw.lower().strip()
    for key, val in UNIT_MAP.items():
        if key in raw:
            return val
    return raw


def normalize_commodity(raw: str) -> str:
    key = raw.lower().strip()
    return COMMODITY_MAP.get(key, raw.title())


def normalize_hali(raw: str) -> str:
    key = raw.lower().strip()
    for k, v in HALI_MAP.items():
        if k in key:
            return v
    return raw.title()


def parse_sms(message: str, sender: Optional[str] = None,
              received_at: Optional[datetime] = None) -> Optional[dict]:
    """
    Parse a #DATA_SOKO WhatsApp message.
    Returns structured dict or None if message is not valid #DATA_SOKO format.
    """
    message = message.strip()

    # Must start with #DATA_SOKO trigger
    if "#DATA_SOKO" not in message.upper():
        return None

    result = {
        "source":      sender or "unknown",
        "received_at": (received_at or datetime.now()).isoformat(),
        "date":        (received_at or datetime.now()).strftime("%Y-%m-%d"),
        "soko":        None,
        "mkoa":        None,
        "hali_soko":   None,
        "items":       [],
        "raw":         message,
    }

    lines = message.splitlines()
    current_category = "GENERAL"

    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        # ── Section headers ─────────────────────────────────────
        upper = line.upper()
        if upper.startswith("---"):
            for cat, keywords in CATEGORY_KEYWORDS.items():
                if any(kw in upper.lower() for kw in keywords):
                    current_category = cat
                    break
            continue

        # ── Metadata ────────────────────────────────────────────
        if line.lower().startswith("soko:"):
            result["soko"] = line.split(":", 1)[1].strip().title()
            continue

        if line.lower().startswith("mkoa:"):
            result["mkoa"] = line.split(":", 1)[1].strip().title()
            continue

        if "hali ya mzigo" in line.lower() or "hali ya soko" in line.lower():
            val = line.split(":", 1)[1].strip() if ":" in line else ""
            result["hali_soko"] = normalize_hali(val)
            continue

        # ── Price line: "Commodity (Unit): Price" ────────────────
        # Matches: "Mahindi (Kilo): 900" or "Mafuta (Lita 5): 18500"
        price_match = re.match(
            r'^(.+?)\s*\(([^)]+)\)\s*:\s*([\d,]+)\s*$', line
        )
        if price_match:
            raw_commodity = price_match.group(1).strip()
            raw_unit      = price_match.group(2).strip()
            raw_price     = price_match.group(3).replace(",", "")

            try:
                price = float(raw_price)
            except ValueError:
                continue

            if price <= 0:
                continue

            result["items"].append({
                "commodity": normalize_commodity(raw_commodity),
                "unit":      normalize_unit(raw_unit),
                "price":     price,
                "category":  current_category,
            })
            continue

        # ── Simple "Commodity: Price" fallback ───────────────────
        simple_match = re.match(r'^([A-Za-z\s]+):\s*([\d,]+)\s*$', line)
        if simple_match:
            raw_commodity = simple_match.group(1).strip()
            raw_price = simple_match.group(2).replace(",", "")
            try:
                price = float(raw_price)
                if price > 0:
                    result["items"].append({
                        "commodity": normalize_commodity(raw_commodity),
                        "unit":      "kg",  # default unit
                        "price":     price,
                        "category":  current_category,
                    })
            except ValueError:
                pass

    # Validate: must have soko + at least one item
    if not result["soko"] or not result["items"]:
        return None

    return result


def parse_batch(messages: list[dict]) -> list[dict]:
    """
    Parse a batch of messages.
    Each message dict: {"text": str, "sender": str, "received_at": datetime}
    Returns list of valid parsed results.
    """
    parsed = []
    for msg in messages:
        result = parse_sms(
            message=msg.get("text", ""),
            sender=msg.get("sender"),
            received_at=msg.get("received_at"),
        )
        if result:
            parsed.append(result)
    return parsed
