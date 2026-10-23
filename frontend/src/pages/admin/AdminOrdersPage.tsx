import { useState } from 'react'
import { orderApi } from '../../api'
import { AsyncState } from '../../components/AsyncState'
import { useApi } from '../../hooks/useApi'
import { ORDER_STATUS_LABEL, type Order, type OrderStatus } from '../../types'
import { formatDateTime, formatPrice } from '../../utils/format'

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]

export default function AdminOrdersPage() {
  const [filter, setFilter] = useState<OrderStatus | ''>('')
  const orders = useApi(
    (signal) => orderApi.list({ status: filter || undefined }, signal),
    [filter],
  )
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleStatusChange = async (order: Order, status: OrderStatus) => {
    setUpdatingId(order.id)
    setActionError(null)
    try {
      await orderApi.updateStatus(order.id, status)
      orders.reload()
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>注文管理</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value as OrderStatus | '')}>
          <option value="">すべてのステータス</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {actionError && (
        <div className="alert alert-error" role="alert">
          {actionError}
        </div>
      )}

      <AsyncState {...orders} onRetry={orders.reload}>
        {(items) =>
          items.length === 0 ? (
            <p className="muted">該当する注文がありません。</p>
          ) : (
            <div className="card table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>注文番号</th>
                    <th>注文日時</th>
                    <th>顧客</th>
                    <th>商品</th>
                    <th className="num">合計</th>
                    <th>ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((o) => (
                    <tr key={o.id}>
                      <td>#{o.id}</td>
                      <td className="muted">{formatDateTime(o.createdAt)}</td>
                      <td>{o.userName}</td>
                      <td>
                        {o.items.map((item) => (
                          <div key={item.productId}>
                            {item.name} × {item.quantity}
                          </div>
                        ))}
                      </td>
                      <td className="num">{formatPrice(o.total)}</td>
                      <td>
                        <select
                          className={`status-select badge-${o.status}`}
                          value={o.status}
                          disabled={updatingId === o.id}
                          onChange={(e) => handleStatusChange(o, e.target.value as OrderStatus)}
                          aria-label={`注文 #${o.id} のステータス`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {ORDER_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </AsyncState>
    </>
  )
}
