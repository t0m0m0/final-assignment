// Lambda のエントリポイント。
// API Gateway (HTTP API) の `ANY /api/{proxy+}` をこの 1 関数で受け、パスで振り分ける。
import { getCurrentUser } from './auth.mjs'
import { HttpError, errorResponse } from './http.mjs'
import { login, me } from './routes/auth.mjs'
import { createOrder, listOrders, updateOrderStatus } from './routes/orders.mjs'
import { createProduct, deleteProduct, getProduct, listProducts, updateProduct } from './routes/products.mjs'

const routes = [
  ['POST', '/login', login],
  ['GET', '/me', me],
  ['GET', '/products', listProducts],
  ['POST', '/products', createProduct],
  ['GET', '/products/:id', getProduct],
  ['PUT', '/products/:id', updateProduct],
  ['DELETE', '/products/:id', deleteProduct],
  ['GET', '/orders', listOrders],
  ['POST', '/orders', createOrder],
  ['PATCH', '/orders/:id', updateOrderStatus],
].map(([method, pattern, handler]) => ({
  method,
  // "/products/:id" → /^\/products\/(?<id>[^/]+)$/
  regex: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`),
  handler,
}))

function matchRoute(method, path) {
  let pathMatched = false
  for (const route of routes) {
    const match = route.regex.exec(path)
    if (!match) continue
    pathMatched = true
    if (route.method === method) return { handler: route.handler, params: match.groups ?? {} }
  }
  throw pathMatched ? new HttpError(405, '許可されていないメソッドです') : new HttpError(404, '見つかりません')
}

export async function handler(event) {
  const method = event.requestContext.http.method
  // "/api/products/1" → "/products/1" (末尾スラッシュも許容)
  const path = event.rawPath.replace(/^\/api(?=\/|$)/, '').replace(/\/+$/, '') || '/'

  try {
    const { handler: routeHandler, params } = matchRoute(method, path)
    const user = await getCurrentUser(event)
    return await routeHandler({ event, params, query: event.queryStringParameters ?? {}, user })
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err.status, err.message)
    // 想定外のエラーは CloudWatch Logs に出し、クライアントには詳細を返さない
    console.error(err)
    return errorResponse(500, 'サーバーでエラーが発生しました')
  }
}
