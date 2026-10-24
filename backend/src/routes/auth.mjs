import { requireUser } from '../auth.mjs'
import { json } from '../http.mjs'

// ログイン・ログアウト・パスワード管理は Cognito が担当するため、ここではログイン中のユーザーを返すだけ

// GET /me
export async function me({ user }) {
  return json(200, requireUser(user))
}
