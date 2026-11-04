import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE = 'ff_session';
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export async function createSession(user) {
  const token = await new SignJWT({ uid: user.User_ID, name: user.Name, role: user.Role_Name })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return { userId: payload.uid, name: payload.name, role: payload.role };
  } catch {
    return null;
  }
}

// Use at the top of every Route Handler:
//   const { session, error } = await requireRole(['Admin']);
//   if (error) return error;
export async function requireRole(allowed = ['Admin', 'Staff']) {
  const session = await getSession();
  if (!session) {
    return { error: Response.json({ error: 'Not signed in' }, { status: 401 }) };
  }
  if (!allowed.includes(session.role)) {
    return { error: Response.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}
