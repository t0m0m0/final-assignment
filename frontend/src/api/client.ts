const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type AuthTokenProvider = () => Promise<string | undefined>

// トークンは期限切れで更新されるため、値ではなく取得する関数を受け取り、リクエストのたびに呼ぶ
let getAuthToken: AuthTokenProvider = async () => undefined

export function setAuthTokenProvider(provider: AuthTokenProvider) {
  getAuthToken = provider
}

type Query = Record<string, string | number | undefined>

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Query
  signal?: AbortSignal
}

function buildUrl(path: string, query: Query = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return `${BASE_URL}${path}${qs ? `?${qs}` : ''}`
}

export async function request<T>(
  path: string,
  { method = 'GET', body, query, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = await getAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiError(res.status, data?.message ?? `通信エラーが発生しました (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
