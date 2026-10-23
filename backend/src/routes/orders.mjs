import { requireAdmin, requireUser } from '../auth.mjs'
import { pool, withTransaction } from '../db.mjs'
import { HttpError, json, parseBody, parseId } from '../http.mjs'

const STATUSES = ['pending', 'shipped', 'delivered', 'cancelled']

const ORDER_SELECT = `
  SELECT o.id, o.user_id, u.name AS user_name, o.total, o.status, o.created_at
  FROM orders o JOIN users u ON u.id = o.user_id`

/** orders の行に明細を付けて、フロントの Order 型 (camelCase) に変換する */
async function attachItems(db, orderRows) {
  if (orderRows.length === 0) return []

  const ids = orderRows.map((o) => o.id)
  const [itemRows] = await db.query(
    'SELECT order_id, product_id, name, price, quantity FROM order_items WHERE order_id IN (?) ORDER BY id',
    [ids],
  )
  const itemsByOrder = new Map(ids.map((id) => [id, []]))
  for (const item of itemRows) {
    itemsByOrder.get(item.order_id).push({
      productId: item.product_id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })
  }

  return orderRows.map((o) => ({
    id: o.id,
    userId: o.user_id,
    userName: o.user_name,
    items: itemsByOrder.get(o.id),
    total: o.total,
    status: o.status,
    createdAt: o.created_at.toISOString(),
  }))
}

async function findOrder(db, id) {
  const [rows] = await db.execute(`${ORDER_SELECT} WHERE o.id = ?`, [id])
  if (!rows[0]) throw new HttpError(404, '注文が見つかりません')
  const [order] = await attachItems(db, rows)
  return order
}

// GET /orders?status=  (管理者は全件、一般ユーザーは自分の注文のみ)
// フロントが送る _sort / _order は無視し、常に新しい順で返す
export async function listOrders({ query, user }) {
  requireUser(user)
  const where = []
  const params = []
  if (user.role !== 'admin') {
    where.push('o.user_id = ?')
    params.push(user.id)
  }
  if (query.status) {
    if (!STATUSES.includes(query.status)) throw new HttpError(400, 'ステータスが不正です')
    where.push('o.status = ?')
    params.push(query.status)
  }

  const sql = `${ORDER_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY o.created_at DESC, o.id DESC`
  const [rows] = await pool.execute(sql, params)
  return json(200, await attachItems(pool, rows))
}

// POST /orders  { items: [{ productId, quantity }] }
// 金額・在庫はクライアントの値を信用せず、DB の値で計算する
export async function createOrder({ event, user }) {
  requireUser(user)
  const requested = parseBody(event).items
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new HttpError(400, '注文する商品を指定してください')
  }
  for (const { quantity } of requested) {
    if (!Number.isInteger(quantity) || quantity < 1) throw new HttpError(400, '数量が不正です')
  }

  const order = await withTransaction(async (conn) => {
    const items = []
    for (const { productId, quantity } of requested) {
      // FOR UPDATE で行ロックを取り、同時注文による在庫のマイナスを防ぐ
      const [rows] = await conn.execute(
        'SELECT id, name, price, stock FROM products WHERE id = ? FOR UPDATE',
        [Number(productId)],
      )
      const product = rows[0]
      if (!product) throw new HttpError(400, `商品(ID: ${productId})が見つかりません`)
      if (product.stock < quantity) throw new HttpError(409, `「${product.name}」の在庫が不足しています`)
      items.push({ productId: product.id, name: product.name, price: product.price, quantity })
    }

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const [result] = await conn.execute(
      "INSERT INTO orders (user_id, total, status, created_at) VALUES (?, ?, 'pending', ?)",
      [user.id, total, new Date()],
    )
    const orderId = result.insertId

    for (const item of items) {
      await conn.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.productId])
      await conn.execute(
        'INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.productId, item.name, item.price, item.quantity],
      )
    }

    return findOrder(conn, orderId)
  })

  return json(201, order)
}

// PATCH /orders/:id  { status }  (管理者)
export async function updateOrderStatus({ event, params, user }) {
  requireAdmin(user)
  const id = parseId(params.id)
  const { status } = parseBody(event)
  if (!STATUSES.includes(status)) throw new HttpError(400, 'ステータスが不正です')

  const [result] = await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id])
  if (result.affectedRows === 0) throw new HttpError(404, '注文が見つかりません')
  return json(200, await findOrder(pool, id))
}
