import fs from 'fs'
import path from 'path'
import pg from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sqlPath = path.join(__dirname, '../../sql/001_presupuesto.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

const client = new pg.Client({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'view_info_presupuesto_dev',
})

await client.connect()
try {
  await client.query(sql)
  console.log('Esquema aplicado:', sqlPath)
} finally {
  await client.end()
}
