'use client';
/**
 * SokoAI — Auth Context + Hooks
 * Tumia: import { useAuth } from '@/lib/auth'
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext(null);

const API = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000' : '');

// ── Token helpers ─────────────────────────────────────────────────
function saveTokens(access, refresh) {
  // HttpOnly cookies kwa production — zinatumika na middleware
  // Hapa tunaset via API route inayoweka cookies server-side
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('sokoai_access', access);
    localStorage.setItem('sokoai_refresh', refresh);
  }
}

function clearTokens() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('sokoai_access');
    localStorage.removeItem('sokoai_refresh');
    localStorage.removeItem('sokoai_api_key');
  }
}

function getAccessToken() {
  return typeof window !== 'undefined'
    ? sessionStorage.getItem('sokoai_access') : null;
}

// ── Auth fetch (with auto-refresh) ───────────────────────────────
let isRefreshing = false;
let refreshQueue = [];

async function authFetch(path, opts = {}) {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers ?? {}),
  };

  let res = await fetch(`${API}${path}`, { ...opts, headers });

  // Token expired — try refresh once
  if (res.status === 401 && !isRefreshing) {
    const refreshToken = localStorage.getItem('sokoai_refresh');
    if (!refreshToken) throw new Error('Session imeisha. Ingia tena.');

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const r = await fetch(`${API}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!r.ok) throw new Error('Refresh failed');
        const data = await r.json();
        sessionStorage.setItem('sokoai_access', data.access_token);
        refreshQueue.forEach(cb => cb(data.access_token));
        refreshQueue = [];
        isRefreshing = false;

        // Retry original request
        return fetch(`${API}${path}`, {
          ...opts,
          headers: { ...headers, Authorization: `Bearer ${data.access_token}` },
        });
      } catch {
        isRefreshing = false;
        refreshQueue = [];
        clearTokens();
        throw new Error('Session imeisha. Ingia tena.');
      }
    } else {
      // Queue this request until refresh completes
      return new Promise((resolve, reject) => {
        refreshQueue.push(newToken => {
          fetch(`${API}${path}`, {
            ...opts,
            headers: { ...headers, Authorization: `Bearer ${newToken}` },
          }).then(resolve).catch(reject);
        });
      });
    }
  }

  return res;
}


// ── Provider ─────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [apiKey, setApiKey]   = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load user on mount
  useEffect(() => {
    const token = getAccessToken();
    if (!token) { setLoading(false); return; }

    authFetch('/api/v1/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          setUser(data.user);
          setApiKey(data.api_key);
          if (data.api_key) {
            localStorage.setItem('sokoai_api_key',
              localStorage.getItem('sokoai_api_key') ?? '');
          }
        }
      })
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const register = useCallback(async ({ name, email, password, org, plan }) => {
    const res = await fetch(`${API}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, org, plan }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail?.message ?? 'Registration imeshindwa.');

    saveTokens(data.access_token, data.refresh_token);
    localStorage.setItem('sokoai_api_key', data.api_key);
    setUser({ name, email, role: 'client', plan });
    setApiKey({ plan: data.plan, rate_limit: data.rate_limit });

    // Set HttpOnly cookie via Next.js API route
    await fetch('/api/auth/set-cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: data.access_token, refresh: data.refresh_token }),
    });

    return data;
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail?.message ?? 'Login imeshindwa.');

    saveTokens(data.access_token, data.refresh_token);
    setUser(data.user);

    await fetch('/api/auth/set-cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: data.access_token, refresh: data.refresh_token }),
    });

    return data;
  }, []);

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('sokoai_refresh');
    const token   = getAccessToken();
    if (token && refresh) {
      await fetch(`${API}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ refresh_token: refresh }),
      }).catch(() => {});
    }
    await fetch('/api/auth/clear-cookie', { method: 'POST' });
    clearTokens();
    setUser(null); setApiKey(null);
    router.push('/auth');
  }, [router]);

  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    const res = await authFetch('/api/v1/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail?.message ?? 'Imeshindwa.');
    return data;
  }, []);

  return (
    <AuthContext.Provider value={{ user, apiKey, loading, register, login, logout, changePassword, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth lazima itumike ndani ya AuthProvider');
  return ctx;
}
