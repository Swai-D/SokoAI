"""
SokoAI — Redis Cache Layer
Inafunika FastAPI endpoints zote za mara nyingi kutumika.

Strategy:
  - Bei za leo      → TTL dakika 30 (zinabadilika asubuhi)
  - Forecasts       → TTL masaa 6  (zinabadilika baada ya retrain)
  - History         → TTL masaa 24 (haibadiliki mara nyingi)
  - Commodities     → TTL masaa 24
  - Masoko list     → TTL masaa 24
"""

import redis.asyncio as aioredis
import json, os, hashlib, logging
from functools import wraps
from typing import Optional, Callable, Any
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("SokoAI.Cache")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# TTL constants (seconds)
TTL_PRICES    = 60 * 30       # 30 min
TTL_FORECAST  = 60 * 60 * 6   # 6 hours
TTL_HISTORY   = 60 * 60 * 24  # 24 hours
TTL_META      = 60 * 60 * 24  # 24 hours
TTL_ALERTS    = 60 * 15       # 15 min — alerts ziwe fresh zaidi

_redis: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(
            REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
            protocol=2,
        )
    return _redis


async def close_redis():
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None


# ── Cache key builder ─────────────────────────────────────────────
def cache_key(*parts) -> str:
    """Build a consistent cache key from parts."""
    raw = ":".join(str(p).lower().strip() for p in parts if p is not None)
    return f"sokoai:{raw}"


# ── Core get/set ─────────────────────────────────────────────────
async def cache_get(key: str) -> Optional[Any]:
    try:
        r = await get_redis()
        val = await r.get(key)
        if val:
            log.debug(f"CACHE HIT  {key}")
            return json.loads(val)
        log.debug(f"CACHE MISS {key}")
        return None
    except Exception as e:
        log.warning(f"Redis get failed ({key}): {e}")
        return None


async def cache_set(key: str, value: Any, ttl: int) -> bool:
    try:
        r = await get_redis()
        await r.setex(key, ttl, json.dumps(value, default=str))
        log.debug(f"CACHE SET  {key} TTL={ttl}s")
        return True
    except Exception as e:
        log.warning(f"Redis set failed ({key}): {e}")
        return False


async def cache_delete(key: str):
    try:
        r = await get_redis()
        await r.delete(key)
        log.debug(f"CACHE DEL  {key}")
    except Exception as e:
        log.warning(f"Redis delete failed ({key}): {e}")


async def cache_delete_pattern(pattern: str):
    """Delete all keys matching a pattern (e.g. 'sokoai:prices:*')"""
    try:
        r = await get_redis()
        keys = await r.keys(f"sokoai:{pattern}")
        if keys:
            await r.delete(*keys)
            log.info(f"CACHE PURGE {len(keys)} keys matching '{pattern}'")
    except Exception as e:
        log.warning(f"Redis pattern delete failed: {e}")


# ── Invalidation helpers ──────────────────────────────────────────
async def invalidate_prices(commodity: str = None, soko: str = None):
    """Call this after new SMS data is ingested."""
    if commodity and soko:
        await cache_delete(cache_key("prices", commodity, soko))
    elif commodity:
        await cache_delete_pattern(f"prices:{commodity}:*")
    else:
        await cache_delete_pattern("prices:*")
    await cache_delete_pattern("alerts:*")


async def invalidate_forecasts(commodity: str = None):
    """Call this after model retraining."""
    if commodity:
        await cache_delete(cache_key("forecast", commodity))
    else:
        await cache_delete_pattern("forecast:*")
    await cache_delete_pattern("alerts:*")


# ── Decorator for endpoint caching ───────────────────────────────
def cached(ttl: int, key_fn: Callable = None):
    """
    Decorator for FastAPI endpoint functions.
    Usage:
        @cached(ttl=TTL_PRICES, key_fn=lambda commodity, soko, **kw: cache_key("prices", commodity, soko))
        async def get_prices(commodity, soko, ...):
            ...
    """
    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            if key_fn:
                key = key_fn(*args, **kwargs)
            else:
                sig = f"{fn.__name__}:{args}:{sorted(kwargs.items())}"
                key = f"sokoai:auto:{hashlib.md5(sig.encode()).hexdigest()[:12]}"

            cached_val = await cache_get(key)
            if cached_val is not None:
                return cached_val

            result = await fn(*args, **kwargs)
            await cache_set(key, result, ttl)
            return result
        return wrapper
    return decorator


# ── Health check ─────────────────────────────────────────────────
async def redis_health() -> dict:
    try:
        r = await get_redis()
        await r.ping()
        info = await r.info("memory")
        keys = await r.dbsize()
        return {
            "status":    "ok",
            "keys":      keys,
            "memory_mb": round(info.get("used_memory", 0) / 1024 / 1024, 2),
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}
