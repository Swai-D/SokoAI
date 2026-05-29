"""
SokoAI v2 — Auth Routes (FastAPI)
Endpoints:
  POST /api/v1/auth/register  — akaunti mpya + API key
  POST /api/v1/auth/login     — ingia, pata JWT token
  GET  /api/v1/auth/me        — taarifa za akaunti yangu
  POST /api/v1/auth/refresh   — refresh JWT token
  POST /api/v1/auth/logout    — futa session
  PUT  /api/v1/auth/password  — badilisha nenosiri
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from typing import Optional
import bcrypt, jwt, os, secrets, hashlib, psycopg2, psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

JWT_SECRET  = os.getenv("JWT_SECRET", "change-this-jwt-secret-in-production")
JWT_ALGO    = "HS256"
JWT_EXPIRE  = 60 * 24 * 7   # 7 days in minutes
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/sokoai")

PLAN_LIMITS = {"free": 100, "basic": 1000, "pro": 10000, "enterprise": 100000}

# ── DB schema additions ────────────────────────────────────────────
USERS_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    org           TEXT,
    password_hash TEXT NOT NULL,
    role          TEXT DEFAULT 'client',   -- client | admin
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    last_login    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    INT REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link api_keys to users
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
"""

def get_conn():
    return psycopg2.connect(DATABASE_URL)

def init_auth_schema():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(USERS_SCHEMA)
        conn.commit()


# ── Helpers ───────────────────────────────────────────────────────
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def create_access_token(user_id: int, email: str, role: str) -> str:
    payload = {
        "sub":   str(user_id),
        "email": email,
        "role":  role,
        "exp":   datetime.utcnow() + timedelta(minutes=JWT_EXPIRE),
        "iat":   datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def create_refresh_token() -> tuple[str, str]:
    """Returns (raw_token, hashed_token)"""
    raw = secrets.token_urlsafe(48)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail={"error": "token_expired", "message": "Token imeisha muda wake. Ingia tena."})
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail={"error": "invalid_token", "message": "Token si sahihi."})

def gen_api_key(client_name: str, plan: str, user_id: int, email: str) -> str:
    raw_key  = "soko_" + secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    limit    = PLAN_LIMITS.get(plan, 100)
    sql = """
        INSERT INTO api_keys (key_hash, client_name, plan, rate_limit, user_id, email)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (key_hash, client_name, plan, limit, user_id, email))
        conn.commit()
    return raw_key


# ── Auth dependency ───────────────────────────────────────────────
async def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"error": "missing_token", "message": "Bearer token inahitajika."})
    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    return {"user_id": int(payload["sub"]), "email": payload["email"], "role": payload["role"]}

async def require_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Admin pekee wanaweza kufanya hivi."})
    return user


# ── Request / Response models ─────────────────────────────────────
class RegisterRequest(BaseModel):
    name:     str
    email:    EmailStr
    password: str
    org:      Optional[str] = None
    plan:     str = "free"

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password:     str


# ── Endpoints ─────────────────────────────────────────────────────
@router.post("/register")
def register(req: RegisterRequest):
    """Akaunti mpya — inatengeneza user + API key moja kwa moja."""
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail={"error": "weak_password", "message": "Nenosiri lazima liwe na herufi 8+."})
    if req.plan not in PLAN_LIMITS:
        raise HTTPException(status_code=400, detail={"error": "invalid_plan", "message": "Plan lazima iwe: free, basic, pro, enterprise."})

    pw_hash = hash_password(req.password)

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users (name, email, org, password_hash) VALUES (%s, %s, %s, %s) RETURNING id",
                    (req.name, req.email, req.org, pw_hash)
                )
                user_id = cur.fetchone()[0]
            conn.commit()
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail={"error": "email_taken", "message": "Barua pepe hii tayari imetumika. Ingia badala yake."})

    # Generate API key
    api_key = gen_api_key(
        client_name=req.name + (f" ({req.org})" if req.org else ""),
        plan=req.plan, user_id=user_id, email=req.email,
    )

    # Issue tokens
    access_token = create_access_token(user_id, req.email, "client")
    raw_refresh, hashed_refresh = create_refresh_token()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
                (user_id, hashed_refresh, datetime.utcnow() + timedelta(days=30))
            )
        conn.commit()

    return {
        "status":        "success",
        "message":       f"Karibu SokoAI, {req.name}!",
        "access_token":  access_token,
        "refresh_token": raw_refresh,
        "token_type":    "Bearer",
        "api_key":       api_key,
        "plan":          req.plan,
        "rate_limit":    PLAN_LIMITS[req.plan],
    }


@router.post("/login")
def login(req: LoginRequest):
    """Ingia na email + nenosiri. Inarudisha JWT + API key."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE email = %s AND is_active = TRUE", (req.email,))
            user = cur.fetchone()

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail={"error": "invalid_credentials", "message": "Barua pepe au nenosiri si sahihi."})

    # Fetch their active API key
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT plan, rate_limit FROM api_keys WHERE user_id = %s AND is_active = TRUE LIMIT 1",
                (user["id"],)
            )
            key_row = cur.fetchone()
            # Update last login
            cur.execute("UPDATE users SET last_login = NOW() WHERE id = %s", (user["id"],))
        conn.commit()

    access_token = create_access_token(user["id"], user["email"], user["role"])
    raw_refresh, hashed_refresh = create_refresh_token()

    with get_conn() as conn:
        with conn.cursor() as cur:
            # Remove old refresh tokens for this user
            cur.execute("DELETE FROM refresh_tokens WHERE user_id = %s", (user["id"],))
            cur.execute(
                "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
                (user["id"], hashed_refresh, datetime.utcnow() + timedelta(days=30))
            )
        conn.commit()

    return {
        "status":        "success",
        "access_token":  access_token,
        "refresh_token": raw_refresh,
        "token_type":    "Bearer",
        "user": {
            "id":    user["id"],
            "name":  user["name"],
            "email": user["email"],
            "role":  user["role"],
            "plan":  key_row["plan"] if key_row else "free",
        },
    }


@router.get("/me")
def get_me(user=Depends(get_current_user)):
    """Taarifa za akaunti ya mtumiaji aliyeingia."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, name, email, org, role, created_at, last_login FROM users WHERE id = %s",
                (user["user_id"],)
            )
            u = cur.fetchone()
            cur.execute(
                """SELECT plan, rate_limit, requests_today, requests_total, created_at
                   FROM api_keys WHERE user_id = %s AND is_active = TRUE LIMIT 1""",
                (user["user_id"],)
            )
            key = cur.fetchone()

    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "status": "success",
        "user":   dict(u),
        "api_key": dict(key) if key else None,
    }


@router.post("/refresh")
def refresh_token(body: dict):
    """Pata access token mpya kwa kutumia refresh token."""
    raw_refresh = body.get("refresh_token")
    if not raw_refresh:
        raise HTTPException(status_code=400, detail={"error": "missing_token"})

    token_hash = hashlib.sha256(raw_refresh.encode()).hexdigest()
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """SELECT rt.user_id, u.email, u.role
                   FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id
                   WHERE rt.token_hash = %s AND rt.expires_at > NOW()""",
                (token_hash,)
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=401, detail={"error": "invalid_refresh_token", "message": "Ingia tena."})

    access_token = create_access_token(row["user_id"], row["email"], row["role"])
    return {"access_token": access_token, "token_type": "Bearer"}


@router.post("/logout")
def logout(body: dict, user=Depends(get_current_user)):
    """Futa refresh token ya mtumiaji."""
    raw_refresh = body.get("refresh_token", "")
    token_hash  = hashlib.sha256(raw_refresh.encode()).hexdigest()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM refresh_tokens WHERE user_id = %s AND token_hash = %s",
                        (user["user_id"], token_hash))
        conn.commit()
    return {"status": "success", "message": "Umetoka vizuri."}


@router.put("/password")
def change_password(req: PasswordChangeRequest, user=Depends(get_current_user)):
    """Badilisha nenosiri."""
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail={"error": "weak_password", "message": "Nenosiri lazima liwe na herufi 8+."})

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash FROM users WHERE id = %s", (user["user_id"],))
            row = cur.fetchone()

    if not row or not verify_password(req.current_password, row[0]):
        raise HTTPException(status_code=401, detail={"error": "wrong_password", "message": "Nenosiri la sasa si sahihi."})

    new_hash = hash_password(req.new_password)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, user["user_id"]))
            # Invalidate all refresh tokens
            cur.execute("DELETE FROM refresh_tokens WHERE user_id = %s", (user["user_id"],))
        conn.commit()

    return {"status": "success", "message": "Nenosiri limebadilishwa. Ingia tena."}
