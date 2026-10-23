import { useCallback, useEffect, useState, type DependencyList } from 'react'

interface ApiState<T> {
  data?: T
  error?: Error
  loading: boolean
}

/**
 * GET 系の API 呼び出しを宣言的に扱うフック。
 * deps が変わると再取得し、古いリクエストは AbortController で破棄する。
 */
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<ApiState<T>>({ loading: true })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState((prev) => ({ data: prev.data, loading: true }))

    fetcher(controller.signal)
      .then((data) => setState({ data, loading: false }))
      .catch((error: Error) => {
        if (controller.signal.aborted) return
        setState((prev) => ({ data: prev.data, error, loading: false }))
      })

    return () => controller.abort()
    // fetcher は毎レンダー生成されるため、依存は呼び出し側の deps で管理する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return { ...state, reload }
}
