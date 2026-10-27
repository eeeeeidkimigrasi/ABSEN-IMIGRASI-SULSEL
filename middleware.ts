import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '';

async function verify(token: string): Promise<boolean> {
  if (!token || !ADMIN_SESSION_SECRET) return false;
  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) return false;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(ADMIN_SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBuf = Uint8Array.from(Buffer.from(signature, 'hex'));
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuf,
      enc.encode(payloadB64)
    );

    if (!isValid) return false;

    const payloadStr = Buffer.from(payloadB64, 'base64').toString();
    const { expiry } = JSON.parse(payloadStr);
    return Date.now() < expiry;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (pathname === '/admin/login' || pathname === '/api/admin/login' || pathname === '/api/admin/logout') {
      const res = NextResponse.next();
      res.headers.set('X-Robots-Tag', 'noindex');
      return res;
    }

    const token = req.cookies.get('admin_session')?.value;
    if (!(await verify(token || ''))) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
    
    const res = NextResponse.next();
    res.headers.set('X-Robots-Tag', 'noindex');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
