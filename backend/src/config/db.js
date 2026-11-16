import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

function env(name, fallbackName) {
  return process.env[name] ?? process.env[fallbackName]
}

const host = env('PGHOST', 'DB_HOST') || 'localhost'
const port = Number(env('PGPORT', 'DB_PORT') || 5432)
const database = env('PGDATABASE', 'DB_NAME')
const user = env('PGUSER', 'DB_USER')
const password = env('PGPASSWORD', 'DB_PASSWORD') ?? ''

if (!database || !user) {
  throw new Error('Faltan PGDATABASE/PGUSER (o DB_NAME/DB_USER) en .env')
}

export const pool = new Pool({
  host,
  port,
  database,
  user,
  password,
  max: Number(process.env.DB_POOL_MAX || 10),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
})

export async function checkDbConnection() {
  const client = await pool.connect()
  try {
    const result = await client.query('SELECT current_database() AS db, NOW() AS server_time')
    return result.rows[0]
  } finally {
    client.release()
  }
}
