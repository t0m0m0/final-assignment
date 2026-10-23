import { useState, type FormEvent } from 'react'
import { CATEGORIES, type Product, type ProductInput } from '../../types'

interface Props {
  initial?: Product
  onSubmit: (input: ProductInput) => Promise<void>
  onCancel: () => void
}

const EMPTY: ProductInput = { name: '', description: '', price: 0, stock: 0, category: CATEGORIES[0] }

export function ProductForm({ initial, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<ProductInput>(() => {
    if (!initial) return EMPTY
    const { id: _id, ...rest } = initial
    return rest
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!values.name.trim()) return setError('商品名を入力してください')
    if (!Number.isInteger(values.price) || values.price < 0) return setError('価格は0以上の整数で入力してください')
    if (!Number.isInteger(values.stock) || values.stock < 0) return setError('在庫は0以上の整数で入力してください')

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ ...values, name: values.name.trim() })
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <form className="card product-form" onSubmit={handleSubmit}>
      <h2>{initial ? `商品を編集 (#${initial.id})` : '商品を追加'}</h2>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <div className="form-grid">
        <label className="field">
          <span>商品名</span>
          <input value={values.name} onChange={(e) => set('name', e.target.value)} required />
        </label>
        <label className="field">
          <span>カテゴリ</span>
          <select value={values.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>価格 (円)</span>
          <input
            type="number"
            min={0}
            value={values.price}
            onChange={(e) => set('price', e.target.valueAsNumber)}
            required
          />
        </label>
        <label className="field">
          <span>在庫</span>
          <input
            type="number"
            min={0}
            value={values.stock}
            onChange={(e) => set('stock', e.target.valueAsNumber)}
            required
          />
        </label>
        <label className="field form-grid-full">
          <span>説明</span>
          <textarea
            rows={3}
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? '保存中…' : '保存'}
        </button>
      </div>
    </form>
  )
}
