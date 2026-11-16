import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const name = process.env.PGDATABASE || 'view_info_presupuesto_dev'
const client = new pg.Client({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: 'postgres',
})

await client.connect()
try {
  await client.query(`CREATE DATABASE ${name} ENCODING 'UTF8'`)
  console.log(`Base creada: ${name}`)
} catch (err) {
  if (err.code === '42P04') {
    console.log(`La base ya existe: ${name}`)
  } else {
    throw err
  }
} finally {
  await client.end()
}
