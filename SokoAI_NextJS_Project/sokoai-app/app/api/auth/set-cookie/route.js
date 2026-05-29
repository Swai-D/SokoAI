/**
 * SokoAI — Next.js API Route: Set Auth Cookies
 * POST /api/auth/set-cookie
 * Inaweka HttpOnly cookies kwa usalama — JS haiwezi kusoma cookies hizi
 */
import { NextResponse } from 'next/server';

const IS_PROD = process.env.NODE_ENV === 'production';

export async function POST(request) {
  const { token, refresh } = await request.json();
  if (!token) return NextResponse.json({ error: 'Token inahitajika' }, { status: 400 });

  const res = NextResponse.json({ status: 'ok' });

  // Access token — inaisha siku 7
  res.cookies.set('sokoai_token', token, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7,
    path:     '/',
  });

  // Refresh token — inaisha siku 30
  if (refresh) {
    res.cookies.set('sokoai_refresh', refresh, {
      httpOnly: true,
      secure:   IS_PROD,
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 30,
      path:     '/',
    });
  }

  return res;
}
