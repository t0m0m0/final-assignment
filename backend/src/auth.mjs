import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { pool } from './db.mjs'
import { HttpError } from './http.mjs'

const scryptAsync = promisify(scrypt)
const TOKEN_TTL_SECONDS = 8 * 60 * 60

// ---- パスワード (scrypt。保存形式は "<salt hex>:<hash hex>") ----

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':')
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(actual, expected)
}

// ---- トークン (HS256 の JWT。外部ライブラリなしで実装) ----

const base64url = (input) => Buffer.from(input).toString('base64url')

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET が設定されていません')
  return secret
}

function sign(data) {
  return createHmac('sha256', getSecret()).update(data).digest('base64url')
}

export function issueToken(user) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({ sub: user.id, iat: now, exp: now + TOKEN_TTL_SECONDS }))
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`
}

function verifyToken(token) {
  const [header, payload, signature] = token.split('.')
  if (!header || !payload || !signature) return null

  const expected = Buffer.from(sign(`${header}.${payload}`))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  if (typeof claims.exp !== 'number' || claims.exp < Date.now() / 1000) return null
  return claims
}

// ---- リクエストの認証・認可 ----

export const toPublicUser = (row) => ({ id: row.id, name: row.name, email: row.email, role: row.role })

/**
 * Authorization ヘッダーからログインユーザーを取得する。未ログインなら null。
 * ロール変更や削除を即座に反映するため、トークンの中身ではなく DB の値を使う。
 */
export async function getCurrentUser(event) {
  const match = /^Bearer (.+)$/.exec(event.headers?.authorization ?? '')
  const claims = match && verifyToken(match[1])
  if (!claims) return null

  const [rows] = await pool.execute('SELECT id, name, email, role FROM users WHERE id = ?', [claims.sub])
  return rows[0] ? toPublicUser(rows[0]) : null
}

export function requireUser(user) {
  if (!user) throw new HttpError(401, 'ログインが必要です')
  return user
}

export function requireAdmin(user) {
  requireUser(user)
  if (user.role !== 'admin') throw new HttpError(403, '権限がありません')
  return user
}
