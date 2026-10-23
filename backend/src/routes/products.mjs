import { requireAdmin } from '../auth.mjs'
import { pool } from '../db.mjs'
import { HttpError, json, noContent, parseBody, parseId } from '../http.mjs'

// frontend/src/types.ts の CATEGORIES と揃える
const CATEGORIES = ['家電', '書籍', '食品', '雑貨']

const COLUMNS = 'id, name, description, price, stock, category'

async function findProduct(id) {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM products WHERE id = ?`, [id])
  if (!rows[0]) throw new HttpError(404, '商品が見つかりません')
  return rows[0]
}

function validateInput(body) {
  const { name, description = '', price, stock, category } = body
  if (typeof name !== 'string' || !name.trim()) throw new HttpError(400, '商品名を入力してください')
  if (typeof description !== 'string') throw new HttpError(400, '説明が不正です')
  if (!Number.isInteger(price) || price < 0) throw new HttpError(400, '価格は0以上の整数で入力してください')
  if (!Number.isInteger(stock) || stock < 0) throw new HttpError(400, '在庫は0以上の整数で入力してください')
  if (!CATEGORIES.includes(category)) throw new HttpError(400, 'カテゴリが不正です')
  return [name.trim(), description, price, stock, category]
}

// GET /products?q=&category=  (誰でも)
export async function listProducts({ query }) {
  const where = []
  const params = []
  if (query.q) {
    where.push('(name LIKE ? OR description LIKE ?)')
    // LIKE のワイルドカード文字はエスケープして、文字どおりに検索する
    const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
    params.push(pattern, pattern)
  }
  if (query.category) {
    where.push('category = ?')
    params.push(query.category)
  }

  const sql = `SELECT ${COLUMNS} FROM products ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id`
  const [rows] = await pool.execute(sql, params)
  return json(200, rows)
}

// GET /products/:id  (誰でも)
export async function getProduct({ params }) {
  return json(200, await findProduct(parseId(params.id)))
}

// POST /products  (管理者)
export async function createProduct({ event, user }) {
  requireAdmin(user)
  const values = validateInput(parseBody(event))
  const [result] = await pool.execute(
    'INSERT INTO products (name, description, price, stock, category) VALUES (?, ?, ?, ?, ?)',
    values,
  )
  return json(201, await findProduct(result.insertId))
}

// PUT /products/:id  (管理者)
export async function updateProduct({ event, params, user }) {
  requireAdmin(user)
  const id = parseId(params.id)
  const values = validateInput(parseBody(event))
  const [result] = await pool.execute(
    'UPDATE products SET name = ?, description = ?, price = ?, stock = ?, category = ? WHERE id = ?',
    [...values, id],
  )
  if (result.affectedRows === 0) throw new HttpError(404, '商品が見つかりません')
  return json(200, await findProduct(id))
}

// DELETE /products/:id  (管理者)
export async function deleteProduct({ params, user }) {
  requireAdmin(user)
  const [result] = await pool.execute('DELETE FROM products WHERE id = ?', [parseId(params.id)])
  if (result.affectedRows === 0) throw new HttpError(404, '商品が見つかりません')
  return noContent()
}
