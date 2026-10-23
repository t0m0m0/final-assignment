import { orderApi } from '../../api'
import { AsyncState } from '../../components/AsyncState'
import { StatusBadge } from '../../components/StatusBadge'
import { useApi } from '../../hooks/useApi'
import { formatDateTime, formatPrice } from '../../utils/format'

export default function MyOrdersPage() {
  const orders = useApi((signal) => orderApi.list({}, signal), [])

  return (
    <>
      <h1>注文履歴</h1>
      <AsyncState {...orders} onRetry={orders.reload}>
        {(items) =>
          items.length === 0 ? (
            <p className="muted">まだ注文はありません。</p>
          ) : (
            <ul className="order-list">
              {items.map((order) => (
                <li key={order.id} className="card">
                  <div className="order-head">
                    <span>
                      注文番号 #{order.id}
                      <span className="muted"> ・ {formatDateTime(order.createdAt)}</span>
                    </span>
                    <StatusBadge status={order.status} />
                  </div>
                  <ul className="order-items">
                    {order.items.map((item) => (
                      <li key={item.productId}>
                        <span>
                          {item.name} × {item.quantity}
                        </span>
                        <span>{formatPrice(item.price * item.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="order-total">合計 {formatPrice(order.total)}</div>
                </li>
              ))}
            </ul>
          )
        }
      </AsyncState>
    </>
  )
}
