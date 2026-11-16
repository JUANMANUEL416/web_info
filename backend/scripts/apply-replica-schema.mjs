import pg from 'pg'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const host = process.env.PGHOST || 'localhost'
const port = Number(process.env.PGPORT || 5432)
const database = process.env.PGDATABASE
const user = process.env.PGUSER
const password = process.env.PGPASSWORD

const pool = new pg.Pool({ host, port, database, user, password })

try {
  console.log(`Aplicando esquema de réplica en base: ${database}...`)
  const sqlPath = path.resolve('../sql/002_replica_operativa.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  await pool.query(sql)
  console.log('✓ Tablas de réplica creadas exitosamente en PostgreSQL.')
} catch (e) {
  console.error('Error aplicando esquema:', e.message)
} finally {
  await pool.end()
}

