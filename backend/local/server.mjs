// ローカル開発用: HTTP リクエストを API Gateway (HTTP API v2) のイベント形式に変換して handler を呼ぶ。
// frontend の Vite は /api を :3001 に転送するので、モックサーバーの代わりにこれを起動すればよい。
import { createServer } from 'node:http'
import { handler } from '../src/index.mjs'

const PORT = Number(process.env.PORT ?? 3001)

createServer(async (req, res) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const url = new URL(req.url, `http://${req.headers.host}`)

  const event = {
    rawPath: url.pathname,
    queryStringParameters: url.search ? Object.fromEntries(url.searchParams) : undefined,
    headers: req.headers, // Node は既にヘッダー名を小文字にしている (API Gateway と同じ)
    body: chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined,
    isBase64Encoded: false,
    requestContext: { http: { method: req.method } },
  }

  const result = await handler(event)
  res.writeHead(result.statusCode, result.headers)
  res.end(result.body)
  console.log(`${req.method} ${req.url} → ${result.statusCode}`)
}).listen(PORT, () => {
  console.log(`Local API: http://localhost:${PORT}/api`)
})
