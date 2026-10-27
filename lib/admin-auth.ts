import crypto from 'crypto';
import { cookies } from 'next/headers';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '';

// In-memory rate limiting
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(ip: string): Promise<boolean> {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);

  if (!attempt || now > attempt.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }

  if (attempt.count >= 5) return false;
  attempt.count++;
  return true;
}

export function hashPassword(password: string): Buffer {
  return crypto.createHash('sha256').update(password).digest();
}

export function comparePassword(input: string): boolean {
  if (!ADMIN_PASSWORD) return false;
  const inputHash = hashPassword(input);
  const targetHash = hashPassword(ADMIN_PASSWORD);
  return crypto.timingSafeEqual(inputHash, targetHash);
}

export function signSession(expiry: number): string {
  const payloadStr = JSON.stringify({ expiry });
  const payloadB64 = Buffer.from(payloadStr).toString('base64');
  const signature = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payloadB64)
    .digest('hex');
  return `${payloadB64}.${signature}`;
}

export function verifySession(token: string): boolean {
  if (!token || !ADMIN_SESSION_SECRET) return false;
  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payloadB64)
    .digest('hex');

  if (signature !== expectedSignature) return false;

  try {
    const payloadStr = Buffer.from(payloadB64, 'base64').toString();
    const { expiry } = JSON.parse(payloadStr);
    return Date.now() < expiry;
  } catch {
    return false;
  }
}

export function getSession(): boolean {
  const cookieStore = cookies();
  const token = cookieStore.get('admin_session')?.value;
  return verifySession(token || '');
}
