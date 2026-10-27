import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, comparePassword, signSession } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  
  if (!(await checkRateLimit(ip))) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' }, { status: 429 });
  }

  let password = '';
  try {
    const body = await req.json();
    password = body.password || '';
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 });
  }

  if (!comparePassword(password)) {
    await new Promise((res) => setTimeout(res, 1000));
    return NextResponse.json({ error: 'Password salah.' }, { status: 401 });
  }

  const expiry = Date.now() + 8 * 60 * 60 * 1000;
  const token = signSession(expiry);

  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60,
  });

  return res;
}
