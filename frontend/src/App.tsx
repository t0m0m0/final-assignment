import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import UserLayout from './layouts/UserLayout'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import MyOrdersPage from './pages/user/MyOrdersPage'
import ProductDetailPage from './pages/user/ProductDetailPage'
import ProductListPage from './pages/user/ProductListPage'

// 管理画面は別チャンクに分割し、一般ユーザーにはダウンロードさせない
const AdminLayout = lazy(() => import('./layouts/AdminLayout'))
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'))
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage'))
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'))

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<p className="muted center">読み込み中…</p>}>
          <Routes>
            {/* 一般ユーザー画面 */}
            <Route element={<UserLayout />}>
              <Route index element={<ProductListPage />} />
              <Route path="products/:id" element={<ProductDetailPage />} />
              <Route
                path="orders"
                element={
                  <RequireAuth>
                    <MyOrdersPage />
                  </RequireAuth>
                }
              />
            </Route>

            <Route path="login" element={<LoginPage />} />

            {/* 管理者画面 */}
            <Route
              path="admin"
              element={
                <RequireAuth role="admin">
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="orders" element={<AdminOrdersPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
