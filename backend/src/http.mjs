// API Gateway (HTTP API, payload v2) 向けのレスポンス生成とエラー定義

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  }
}

export const noContent = () => ({ statusCode: 204 })

// フロントは失敗時に { message } を表示する (frontend/src/api/client.ts)
export const errorResponse = (status, message) => json(status, { message })

export function parseBody(event) {
  if (!event.body) return {}
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
  try {
    return JSON.parse(raw)
  } catch {
    throw new HttpError(400, 'リクエストの形式が不正です')
  }
}

export function parseId(value) {
  const id = Number(value)
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, '見つかりません')
  return id
}
