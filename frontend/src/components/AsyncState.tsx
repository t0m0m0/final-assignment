import type { ReactNode } from 'react'

interface Props<T> {
  loading: boolean
  error?: Error
  data?: T
  onRetry?: () => void
  children: (data: T) => ReactNode
}

/** useApi の結果を「読み込み中 / エラー / 表示」に振り分ける */
export function AsyncState<T>({ loading, error, data, onRetry, children }: Props<T>) {
  if (error) {
    return (
      <div className="alert alert-error" role="alert">
        {error.message}
        {onRetry && (
          <button type="button" className="btn btn-small" onClick={onRetry}>
            再試行
          </button>
        )}
      </div>
    )
  }
  if (data === undefined) return loading ? <p className="muted">読み込み中…</p> : null
  return <>{children(data)}</>
}
