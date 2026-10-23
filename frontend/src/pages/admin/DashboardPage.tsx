import { Link } from 'react-router-dom'
import { orderApi, productApi } from '../../api'
import { AsyncState } from '../../components/AsyncState'
import { StatusBadge } from '../../components/StatusBadge'
import { useApi } from '../../hooks/useApi'
import { formatDateTime, formatPrice } from '../../utils/format'

const LOW_STOCK_THRESHOLD = 5

export default function DashboardPage() {
  const summary = useApi(
    (signal) => Promise.all([productApi.list({}, signal), orderApi.list({}, signal)]),
    [],
  )

  return (
    <>
      <h1>ダッシュボード</h1>
      <AsyncState {...summary} onRetry={summary.reload}>
        {([products, orders]) => {
          const activeOrders = orders.filter((o) => o.status !== 'cancelled')
          const sales = activeOrders.reduce((sum, o) => sum + o.total, 0)
          const pending = orders.filter((o) => o.status === 'pending')
          const lowStock = products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD)

          return (
            <>
              <div className="stat-grid">
                <Stat label="売上合計" value={formatPrice(sales)} />
                <Stat label="注文数" value={`${activeOrders.length} 件`} />
                <Stat label="未発送の注文" value={`${pending.length} 件`} highlight={pending.length > 0} />
                <Stat label="商品数" value={`${products.length} 点`} />
              </div>

              <div className="panel-grid">
                <section className="card">
                  <div className="panel-head">
                    <h2>最近の注文</h2>
                    <Link to="/admin/orders">すべて見る</Link>
                  </div>
                  <table className="table">
                    <tbody>
                      {orders.slice(0, 5).map((o) => (
                        <tr key={o.id}>
                          <td>#{o.id}</td>
                          <td>{o.userName}</td>
                          <td className="muted">{formatDateTime(o.createdAt)}</td>
                          <td className="num">{formatPrice(o.total)}</td>
                          <td>
                            <StatusBadge status={o.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className="card">
                  <div className="panel-head">
                    <h2>在庫わずか (≦{LOW_STOCK_THRESHOLD})</h2>
                    <Link to="/admin/products">商品管理へ</Link>
                  </div>
                  {lowStock.length === 0 ? (
                    <p className="muted">在庫が少ない商品はありません。</p>
                  ) : (
                    <ul className="simple-list">
                      {lowStock.map((p) => (
                        <li key={p.id}>
                          <span>{p.name}</span>
                          <span className={p.stock === 0 ? 'sold-out' : 'warn'}>{p.stock} 点</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )
        }}
      </AsyncState>
    </>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`card stat${highlight ? ' stat-highlight' : ''}`}>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
