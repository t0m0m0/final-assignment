import { ORDER_STATUS_LABEL, type OrderStatus } from '../types'

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge badge-${status}`}>{ORDER_STATUS_LABEL[status]}</span>
}
