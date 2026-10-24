// ローカル開発用: HTTP リクエストを API Gateway (HTTP API v2) のイベント形式に変換して handler を呼ぶ。
// frontend の Vite は /api を :3001 に転送するので、モックサーバーの代わりにこれを起動すればよい。
import { createServer } from 'node:http'
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import { handler } from '../src/index.mjs'

const PORT = Number(process.env.PORT ?? 3001)

// API Gateway の JWT オーソライザーの代わりに、Cognito の公開鍵でトークンを検証する。
// オーソライザーと同じく token_use は問わず、発行元 (ユーザープール) と aud / client_id だけを確認する
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId: process.env.COGNITO_CLIENT_ID,
  tokenUse: null,
})

// API Gateway でオーソライザーを付けていないルート (README の「API Gateway を作成する」を参照)
const PUBLIC_ROUTES = [/^\/api\/products$/, /^\/api\/products\/[^/]+$/]
const isPublic = (method, path) => method === 'GET' && PUBLIC_ROUTES.some((re) => re.test(path))

/** オーソライザーと同じく、クレームの値を文字列にする (配列は "[a b]" の形になる) */
const stringifyClaims = (claims) =>
  Object.fromEntries(
    Object.entries(claims).map(([key, value]) => [key, Array.isArray(value) ? `[${value.join(' ')}]` : String(value)]),
  )

async function authorize(req) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')
  if (!match) return null
  try {
    return stringifyClaims(await verifier.verify(match[1]))
  } catch {
    return null
  }
}

createServer(async (req, res) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const url = new URL(req.url, `http://${req.headers.host}`)

  let authorizer
  if (!isPublic(req.method, url.pathname)) {
    const claims = await authorize(req)
    if (!claims) {
      // オーソライザーで拒否された場合、Lambda は呼ばれずに 401 が返る
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'Unauthorized' }))
      console.log(`${req.method} ${req.url} → 401 (authorizer)`)
      return
    }
    authorizer = { jwt: { claims, scopes: null } }
  }

  const event = {
    rawPath: url.pathname,
    queryStringParameters: url.search ? Object.fromEntries(url.searchParams) : undefined,
    headers: req.headers, // Node は既にヘッダー名を小文字にしている (API Gateway と同じ)
    body: chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined,
    isBase64Encoded: false,
    requestContext: { http: { method: req.method }, authorizer },
  }

  const result = await handler(event)
  res.writeHead(result.statusCode, result.headers)
  res.end(result.body)
  console.log(`${req.method} ${req.url} → ${result.statusCode}`)
}).listen(PORT, () => {
  console.log(`Local API: http://localhost:${PORT}/api`)
})
