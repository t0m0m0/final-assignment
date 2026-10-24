import { pool } from './db.mjs'
import { HttpError } from './http.mjs'

// 認証は Amazon Cognito が行う。
// トークン (ID トークン) の署名・有効期限・発行元・クライアント ID は API Gateway の JWT オーソライザーが検証し、
// 検証済みのクレームだけが event.requestContext.authorizer.jwt.claims に入って Lambda に届く。
// Lambda は VPC 内にあり Cognito の公開鍵を取りに行けないため、ここでは署名の再検証はしない。

const ADMIN_GROUP = 'admin'

/** HTTP API の JWT オーソライザーは配列のクレームを "[admin user]" という文字列にして渡す */
function parseGroups(value) {
  if (Array.isArray(value)) return value
  return String(value ?? '')
    .replace(/^\[|\]$/g, '')
    .split(/[\s,]+/)
    .filter(Boolean)
}

/**
 * Cognito のユーザー (sub) に対応する users の行 ({ id, name, email }) を返す。初回ログイン時は行を作る。
 * 注文は users.id を参照するため、Cognito のユーザーを DB 側にも写しておく。
 */
async function findOrCreateUser({ sub, name, email, emailVerified }) {
  const [rows] = await pool.execute('SELECT id, name, email FROM users WHERE cognito_sub = ?', [sub])
  const row = rows[0]
  if (row) {
    // Cognito 側で名前・メールアドレスが変わっていたら追従する
    const latest = { id: row.id, name: name || row.name, email }
    if (latest.name !== row.name || latest.email !== row.email) {
      await pool.execute('UPDATE users SET name = ?, email = ? WHERE id = ?', [latest.name, latest.email, row.id])
    }
    return latest
  }

  // シードや既存システムからの移行で事前登録された (cognito_sub が未設定の) ユーザーは、
  // 確認済みのメールアドレスが一致する場合に限り、この Cognito ユーザーに紐付ける
  if (emailVerified) {
    const [linked] = await pool.execute(
      'UPDATE users SET cognito_sub = ?, name = COALESCE(?, name) WHERE email = ? AND cognito_sub IS NULL LIMIT 1',
      [sub, name ?? null, email],
    )
    if (linked.affectedRows === 1) return findOrCreateUser({ sub, name, email, emailVerified })
  }

  // 同時に初回リクエストが来ても重複しないよう、既存行があればその id を返す
  const [result] = await pool.execute(
    'INSERT INTO users (cognito_sub, name, email) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
    [sub, name || email, email],
  )
  return { id: result.insertId, name: name || email, email }
}

/**
 * オーソライザーが検証したクレームからログインユーザーを取得する。未ログインなら null。
 * 認証不要のルート (GET /products など) にはオーソライザーが付いていないため、常に null になる。
 */
export async function getCurrentUser(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims
  // email などのプロフィールを使うので ID トークンのみ受け付ける (アクセストークンには含まれない)
  if (!claims?.sub || claims.token_use !== 'id') return null

  const user = await findOrCreateUser({
    sub: claims.sub,
    name: claims.name || undefined,
    email: claims.email ?? '',
    emailVerified: String(claims.email_verified) === 'true',
  })
  // ロールは DB ではなく Cognito のグループで決める (グループの変更は次のトークン発行から反映される)
  const role = parseGroups(claims['cognito:groups']).includes(ADMIN_GROUP) ? 'admin' : 'user'
  return { ...user, role }
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
