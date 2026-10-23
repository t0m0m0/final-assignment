import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError, orderApi, productApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { AsyncState } from '../../components/AsyncState'
import { useApi } from '../../hooks/useApi'
import type { Product } from '../../types'
import { formatPrice } from '../../utils/format'

export default function ProductDetailPage() {
  const id = Number(useParams().id)
  const product = useApi((signal) => productApi.get(id, signal), [id])

  const error =
    product.error instanceof ApiError && product.error.status === 404
      ? new Error('商品が見つかりません')
      : product.error

  return (
    <>
      <Link to="/">← 商品一覧へ戻る</Link>
      <AsyncState {...product} error={error} onRetry={product.reload}>
        {(item) => <ProductDetail product={item} onOrdered={product.reload} />}
      </AsyncState>
    </>
  )
}

function ProductDetail({ product, onOrdered }: { product: Product; onOrdered: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const soldOut = product.stock === 0

  const handleOrder = async () => {
    if (!user) {
      navigate('/login', { state: { from: location } })
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      const order = await orderApi.create([{ productId: product.id, quantity }])
      setMessage({ type: 'success', text: `注文を受け付けました (注文番号: ${order.id})` })
      setQuantity(1)
      onOrdered() // 在庫数を再取得
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <article className="card product-detail">
      <span className="tag">{product.category}</span>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p className="price">{formatPrice(product.price)}</p>
      <p className="muted">在庫: {soldOut ? '在庫切れ' : `${product.stock} 点`}</p>

      {message && (
        <div className={`alert alert-${message.type}`} role="status">
          {message.text}
          {message.type === 'success' && <Link to="/orders">注文履歴を見る</Link>}
        </div>
      )}

      <div className="order-form">
        <label className="field field-inline">
          <span>数量</span>
          <input
            type="number"
            min={1}
            max={Math.max(product.stock, 1)}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            disabled={soldOut}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleOrder}
          disabled={soldOut || submitting || quantity > product.stock}
        >
          {submitting ? '注文中…' : user ? '注文する' : 'ログインして注文'}
        </button>
      </div>
    </article>
  )
}
