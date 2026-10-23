import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import type { Role } from '../types'
import { useAuth } from './AuthContext'

interface Props {
  children: ReactNode
  /** 指定した場合、そのロールのユーザーのみ表示する */
  role?: Role
}

/**
 * 画面の出し分け用ガード。
 * 実際のアクセス制御は必ずバックエンド側でも行うこと (ここは UX のための制御)。
 */
export function RequireAuth({ children, role }: Props) {
  const { user, initializing } = useAuth()
  const location = useLocation()

  if (initializing) return <p className="muted center">読み込み中…</p>

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  if (role && user.role !== role) {
    return (
      <div className="center">
        <h1>403</h1>
        <p>このページにアクセスする権限がありません。</p>
        <Link to="/">トップへ戻る</Link>
      </div>
    )
  }

  return children
}
