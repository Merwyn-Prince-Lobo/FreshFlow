import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { createSession } from '@/lib/auth';

export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return Response.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const rows = await query(
    `SELECT u.User_ID, u.Name, u.Password_Hash, u.Status, r.Role_Name
       FROM APP_USER u JOIN ROLE r ON r.Role_ID = u.Role_ID
      WHERE u.Email = ?`,
    [email.trim().toLowerCase()]
  );
  const user = rows[0];
  // Same message for unknown user, wrong password and inactive account.
  const ok = user && user.Status === 'Active' && (await bcrypt.compare(password, user.Password_Hash));
  if (!ok) return Response.json({ error: 'Invalid credentials' }, { status: 401 });

  await createSession(user);
  return Response.json({ name: user.Name, role: user.Role_Name });
}
