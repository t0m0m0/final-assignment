import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">Sample Shop 管理</div>
        <nav className="admin-nav">
          <NavLink to="/admin" end>
            ダッシュボード
          </NavLink>
          <NavLink to="/admin/products">商品管理</NavLink>
          <NavLink to="/admin/orders">注文管理</NavLink>
        </nav>
        <div className="admin-sidebar-footer">
          <span>{user?.name}</span>
          <Link to="/">ユーザー画面へ</Link>
          <button type="button" className="btn btn-ghost btn-small" onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
