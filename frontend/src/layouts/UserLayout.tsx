import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function UserLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="user-shell">
      <header className="user-header">
        <div className="container user-header-inner">
          <Link to="/" className="brand">
            Sample Shop
          </Link>
          <nav className="user-nav">
            <NavLink to="/" end>
              商品一覧
            </NavLink>
            {user && <NavLink to="/orders">注文履歴</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin">管理画面</NavLink>}
          </nav>
          <div className="user-menu">
            {user ? (
              <>
                <span className="muted">{user.name} さん</span>
                <button type="button" className="btn btn-ghost btn-small" onClick={handleLogout}>
                  ログアウト
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary btn-small">
                ログイン
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="container user-main">
        <Outlet />
      </main>
    </div>
  )
}
