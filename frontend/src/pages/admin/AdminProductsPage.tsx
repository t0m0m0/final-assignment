import { useState } from 'react'
import { productApi } from '../../api'
import { AsyncState } from '../../components/AsyncState'
import { useApi } from '../../hooks/useApi'
import type { Product, ProductInput } from '../../types'
import { formatPrice } from '../../utils/format'
import { ProductForm } from './ProductForm'

type Editing = { mode: 'create' } | { mode: 'edit'; product: Product } | null

export default function AdminProductsPage() {
  const products = useApi((signal) => productApi.list({}, signal), [])
  const [editing, setEditing] = useState<Editing>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleSave = async (input: ProductInput) => {
    if (editing?.mode === 'edit') await productApi.update(editing.product.id, input)
    else await productApi.create(input)
    setEditing(null)
    products.reload()
  }

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`「${product.name}」を削除しますか？`)) return
    setActionError(null)
    try {
      await productApi.remove(product.id)
      products.reload()
    } catch (err) {
      setActionError((err as Error).message)
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>商品管理</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setEditing({ mode: 'create' })}
          disabled={editing !== null}
        >
          ＋ 商品を追加
        </button>
      </div>

      {editing && (
        <ProductForm
          // 編集対象が変わったらフォームの状態をリセットする
          key={editing.mode === 'edit' ? editing.product.id : 'new'}
          initial={editing.mode === 'edit' ? editing.product : undefined}
          onSubmit={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {actionError && (
        <div className="alert alert-error" role="alert">
          {actionError}
        </div>
      )}

      <AsyncState {...products} onRetry={products.reload}>
        {(items) => (
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>商品名</th>
                  <th>カテゴリ</th>
                  <th className="num">価格</th>
                  <th className="num">在庫</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td className="num">{formatPrice(p.price)}</td>
                    <td className={`num${p.stock === 0 ? ' sold-out' : ''}`}>{p.stock}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => setEditing({ mode: 'edit', product: p })}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        className="btn btn-small btn-danger"
                        onClick={() => handleDelete(p)}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncState>
    </>
  )
}
