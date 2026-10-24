// 開発用モックAPIサーバー (json-server 0.17)
// 本番のバックエンドができたら、このファイルは不要になります。
const fs = require('node:fs')
const path = require('node:path')
const jsonServer = require('json-server')

const PORT = Number(process.env.MOCK_PORT ?? 3001)
const DB_FILE = path.join(__dirname, 'db.json')
const SEED_FILE = path.join(__dirname, 'db.seed.json')

// db.json は書き込みで変化するため、無ければシードから作る (npm run mock:reset で初期化)
if (!fs.existsSync(DB_FILE)) fs.copyFileSync(SEED_FILE, DB_FILE)

const server = jsonServer.create()
const router = jsonServer.router(DB_FILE)
const db = router.db

server.use(jsonServer.defaults({ logger: true }))
server.use(jsonServer.bodyParser)

/**
 * Cognito の ID トークンからユーザーを特定する。初めてのユーザーは users に追加する。
 * 開発用のモックなので署名は検証せず、中身 (email / name / cognito:groups) を読むだけ。
 * 本番では API Gateway の JWT オーソライザーが検証する (backend/README.md)。
 */
function findUserByToken(authorization = '') {
  const match = /^Bearer [\w-]+\.([\w-]+)\.[\w-]+$/.exec(authorization)
  if (!match) return null
  let claims
  try {
    claims = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (claims.token_use !== 'id' || !claims.email || claims.exp < Date.now() / 1000) return null

  const users = db.get('users')
  const user =
    users.find({ email: claims.email }).value() ??
    users.insert({ name: claims.name ?? claims.email, email: claims.email }).write()
  // ロールは Cognito のグループで決める
  const role = (claims['cognito:groups'] ?? []).includes('admin') ? 'admin' : 'user'
  return { id: user.id, name: user.name, email: user.email, role }
}

// 以降のエンドポイントで認証・認可を行う
server.use('/api', (req, res, next) => {
  const user = findUserByToken(req.headers.authorization)
  const isAdmin = user?.role === 'admin'

  if (req.path.startsWith('/products') && req.method === 'GET') return next()
  if (!user) return res.status(401).json({ message: 'ログインが必要です' })

  if (req.path === '/me') return res.json(user)

  // 個人情報を含むため users は直接公開しない
  if (req.path.startsWith('/users')) return res.status(404).end()

  if (req.path.startsWith('/products')) {
    return isAdmin ? next() : res.status(403).json({ message: '権限がありません' })
  }

  if (req.path.startsWith('/orders')) {
    if (req.method === 'POST' && req.path === '/orders') return createOrder(req, res, user)
    if (isAdmin) return next()
    if (req.method === 'GET' && req.path === '/orders') {
      // 一般ユーザーには自分の注文だけを返す
      req.query.userId = String(user.id)
      return next()
    }
    return res.status(403).json({ message: '権限がありません' })
  }

  next()
})

// 金額・在庫はクライアントの値を信用せず、サーバー側で計算する
function createOrder(req, res, user) {
  const requested = Array.isArray(req.body?.items) ? req.body.items : []
  if (requested.length === 0) {
    return res.status(400).json({ message: '注文する商品を指定してください' })
  }

  const items = []
  for (const { productId, quantity } of requested) {
    const product = db.get('products').find({ id: Number(productId) }).value()
    if (!product) return res.status(400).json({ message: `商品(ID: ${productId})が見つかりません` })
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: '数量が不正です' })
    }
    if (product.stock < quantity) {
      return res.status(409).json({ message: `「${product.name}」の在庫が不足しています` })
    }
    items.push({ productId: product.id, name: product.name, price: product.price, quantity })
  }

  for (const item of items) {
    db.get('products').find({ id: item.productId }).update('stock', (stock) => stock - item.quantity).write()
  }

  const order = db
    .get('orders')
    .insert({
      userId: user.id,
      userName: user.name,
      items,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      status: 'pending',
      createdAt: new Date().toISOString(),
    })
    .write()

  res.status(201).json(order)
}

server.use('/api', router)

server.listen(PORT, () => {
  console.log(`Mock API server: http://localhost:${PORT}/api`)
})
