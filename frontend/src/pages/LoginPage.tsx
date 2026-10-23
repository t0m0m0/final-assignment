import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, type Location } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function LoginPage() {
  const { user, login } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ログイン済み (ログイン成功直後を含む) なら、元いたページかロールに応じたトップへ
  if (user) {
    const fallback = user.role === 'admin' ? '/admin' : '/'
    return <Navigate to={from ? `${from.pathname}${from.search}` : fallback} replace />
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>ログイン</h1>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
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
        <div className="demo-accounts muted">
          <p>デモ用アカウント</p>
          <ul>
            <li>一般: user@example.com / user123</li>
            <li>管理者: admin@example.com / admin123</li>
          </ul>
        </div>
        <Link to="/">← 商品一覧へ戻る</Link>
      </form>
    </div>
  )
}
