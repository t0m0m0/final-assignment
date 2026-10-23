import { issueToken, requireUser, toPublicUser, verifyPassword } from '../auth.mjs'
import { pool } from '../db.mjs'
import { json, parseBody } from '../http.mjs'

// POST /login  { email, password } → { token, user }
export async function login({ event }) {
  const { email, password } = parseBody(event)
  const unauthorized = json(401, { message: 'メールアドレスまたはパスワードが違います' })
  if (typeof email !== 'string' || typeof password !== 'string') return unauthorized

  const [rows] = await pool.execute(
    'SELECT id, name, email, role, password_hash FROM users WHERE email = ?',
    [email],
  )
  const row = rows[0]
  if (!row || !(await verifyPassword(password, row.password_hash))) return unauthorized

  const user = toPublicUser(row)
  return json(200, { token: issueToken(user), user })
}

// GET /me
export async function me({ user }) {
  return json(200, requireUser(user))
}
