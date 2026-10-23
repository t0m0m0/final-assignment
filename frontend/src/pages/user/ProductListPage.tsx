import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { productApi } from '../../api'
import { AsyncState } from '../../components/AsyncState'
import { useApi } from '../../hooks/useApi'
import { CATEGORIES } from '../../types'
import { formatPrice } from '../../utils/format'

export default function ProductListPage() {
  // 検索条件は URL に持たせる (リロード・共有・戻る操作で条件が保たれる)
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? ''

  const products = useApi((signal) => productApi.list({ q, category }, signal), [q, category])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const next = new URLSearchParams()
    for (const key of ['q', 'category']) {
      const value = String(form.get(key) ?? '').trim()
      if (value) next.set(key, value)
    }
    setSearchParams(next)
  }

  return (
    <>
      <h1>商品一覧</h1>
      {/* key で URL 変化時にフォームの初期値を同期させる */}
      <form key={`${q}|${category}`} className="search-bar" onSubmit={handleSubmit}>
        <input name="q" type="search" placeholder="キーワードで検索" defaultValue={q} />
        <select name="category" defaultValue={category}>
          <option value="">すべてのカテゴリ</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary">
          検索
        </button>
      </form>

      <AsyncState {...products} onRetry={products.reload}>
        {(items) =>
          items.length === 0 ? (
            <p className="muted">該当する商品がありません。</p>
          ) : (
            <ul className="product-grid">
              {items.map((product) => (
                <li key={product.id}>
                  <Link to={`/products/${product.id}`} className="card product-card">
                    <span className="tag">{product.category}</span>
                    <h2>{product.name}</h2>
                    <p className="muted">{product.description}</p>
                    <div className="product-card-footer">
                      <strong>{formatPrice(product.price)}</strong>
                      {product.stock === 0 && <span className="sold-out">在庫切れ</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </AsyncState>
    </>
  )
}
