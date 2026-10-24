import { Amplify } from 'aws-amplify'
import { fetchAuthSession } from 'aws-amplify/auth'
import { setAuthTokenProvider } from '../api'

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID
const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID

export const cognitoConfigured = Boolean(userPoolId && userPoolClientId)

if (userPoolId && userPoolClientId) {
  // トークンは Amplify が localStorage に保存し、期限切れ前にリフレッシュトークンで更新する
  Amplify.configure({
    Auth: { Cognito: { userPoolId, userPoolClientId, loginWith: { email: true } } },
  })
} else {
  console.warn('VITE_COGNITO_USER_POOL_ID / VITE_COGNITO_USER_POOL_CLIENT_ID が未設定のため、ログインできません')
}

/**
 * API に送る ID トークン。未ログインなら undefined。
 * 有効期限内ならキャッシュを返し、切れていれば自動で更新する。
 */
export async function getIdToken() {
  if (!cognitoConfigured) return undefined
  try {
    const { tokens } = await fetchAuthSession()
    return tokens?.idToken?.toString()
  } catch {
    // リフレッシュトークンも失効している場合など
    return undefined
  }
}

setAuthTokenProvider(getIdToken)

const ERROR_MESSAGES: Record<string, string> = {
  NotAuthorizedException: 'メールアドレスまたはパスワードが違います',
  UserNotFoundException: 'メールアドレスまたはパスワードが違います',
  PasswordResetRequiredException: 'パスワードのリセットが必要です。管理者にお問い合わせください',
  InvalidPasswordException:
    'パスワードの条件を満たしていません (8 文字以上で、英大文字・英小文字・数字・記号をそれぞれ含めてください)',
  LimitExceededException: '試行回数が多すぎます。しばらくしてから再度お試しください',
  TooManyRequestsException: '試行回数が多すぎます。しばらくしてから再度お試しください',
}

/** Amplify / Cognito のエラーを画面に表示するメッセージに変換する */
export function toAuthErrorMessage(err: unknown) {
  const name = (err as { name?: string } | null)?.name
  return (name && ERROR_MESSAGES[name]) ?? 'ログインに失敗しました。時間をおいて再度お試しください'
}
