import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, type Location } from 'react-router-dom'
import { useAuth, type SignInResult } from '../auth/AuthContext'

export default function LoginPage() {
  const { user, initializing, login, completeNewPassword } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from

  // 管理者が作成したユーザーは、初回ログイン時に新しいパスワードの設定を求められる
  const [step, setStep] = useState<'signIn' | 'newPassword'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // セッション復元中にサインインすると Cognito がエラーを返すため、終わるまで待つ
  if (initializing) return <p className="muted center">読み込み中…</p>

  // ログイン済み (ログイン成功直後を含む) なら、元いたページかロールに応じたトップへ
  if (user) {
    const fallback = user.role === 'admin' ? '/admin' : '/'
    return <Navigate to={from ? `${from.pathname}${from.search}` : fallback} replace />
  }

  const run = async (action: () => Promise<SignInResult>) => {
    setSubmitting(true)
    setError(null)
    try {
      const result = await action()
      if (result.status === 'newPasswordRequired') {
        setStep('newPassword')
        setSubmitting(false)
      }
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  const handleSignIn = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    void run(() => login(email, password))
  }

  const handleNewPassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('確認用のパスワードが一致しません')
      return
    }
    void run(() => completeNewPassword(newPassword))
  }

  const errorAlert = error && (
    <div className="alert alert-error" role="alert">
      {error}
    </div>
  )

  if (step === 'newPassword') {
    return (
      <div className="login-page">
        <form className="card login-card" onSubmit={handleNewPassword}>
          <h1>新しいパスワードの設定</h1>
          <p className="muted">初回ログインのため、新しいパスワードを設定してください。</p>
          {errorAlert}
          <label className="field">
            <span>新しいパスワード</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="field">
            <span>新しいパスワード (確認)</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <p className="muted">8 文字以上で、英大文字・英小文字・数字・記号をそれぞれ含めてください。</p>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? '設定中…' : 'パスワードを設定してログイン'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={handleSignIn}>
        <h1>ログイン</h1>
        {errorAlert}
        <label className="field">
          <span>メールアドレス</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="field">
          <span>パスワード</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'ログイン中…' : 'ログイン'}
        </button>
        <Link to="/">← 商品一覧へ戻る</Link>
      </form>
    </div>
  )
}
