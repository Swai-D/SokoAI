/**
 * SokoAI — Next.js Middleware
 * Inalinda routes zote za /admin na /dashboard
 * Inatumia JWT iliyohifadhiwa kwenye cookies
 */
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'change-this-jwt-secret-in-production'
);

// Routes zinazohitaji auth
const PROTECTED = ['/admin', '/dashboard'];

// Routes za admin pekee
const ADMIN_ONLY = ['/admin'];

// Routes ambazo logged-in users hawapaswi kuona (kama login)
const AUTH_ROUTES = ['/auth'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some(p => pathname.startsWith(p));
  const isAdminOnly = ADMIN_ONLY.some(p => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some(p => pathname.startsWith(p));

  // Soma token kutoka cookie
  const token = request.cookies.get('sokoai_token')?.value;

  let payload = null;
  if (token) {
    try {
      const { payload: p } = await jwtVerify(token, JWT_SECRET);
      payload = p;
    } catch {
      // Token batili au imeisha — futa cookie
      const res = NextResponse.redirect(new URL('/auth?expired=1', request.url));
      res.cookies.delete('sokoai_token');
      res.cookies.delete('sokoai_refresh');
      if (isProtected) return res;
    }
  }

  // Logged-in user anajaribu kufikia /auth — mpeleke dashboard
  if (isAuthRoute && payload) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Route inayohitaji auth — hakuna token
  if (isProtected && !payload) {
    const url = new URL('/auth', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Admin-only route — mtumiaji si admin
  if (isAdminOnly && payload?.role !== 'admin') {
    return NextResponse.redirect(new URL('/?error=forbidden', request.url));
  }

  // Ongeza user info kwenye headers kwa server components
  const res = NextResponse.next();
  if (payload) {
    res.headers.set('x-user-id',    String(payload.sub));
    res.headers.set('x-user-email', String(payload.email));
    res.headers.set('x-user-role',  String(payload.role));
  }
  return res;
}

export const config = {
  matcher: [
    // Linda pages — usiathiri static files na API routes
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
