/**
 * SokoAI — Next.js API Route: Clear Auth Cookies
 * POST /api/auth/clear-cookie
 */
import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ status: 'ok' });
  res.cookies.delete('sokoai_token');
  res.cookies.delete('sokoai_refresh');
  return res;
}
