import mysql from 'mysql2/promise'

// ハンドラの外で作成し、ウォームスタート時は同じプールを再利用する。
// Lambda は 1 実行環境につき同時 1 リクエストなので、接続数は少なくてよい。
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? 'sample_shop',
  connectionLimit: 2,
  maxIdle: 2,
  idleTimeout: 60_000,
  enableKeepAlive: true,
  // DATETIME を UTC として読み書きする
  timezone: 'Z',
  // RDS への接続は TLS を使う (ローカルの Docker MySQL では DB_SSL=false)
  ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: true },
})

/** コールバック内の処理を 1 トランザクションで実行する */
export async function withTransaction(fn) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
