import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
})

console.log('Vaciando tablas de réplica en PostgreSQL local...')
await pool.query(`
  TRUNCATE TABLE syn_factura_baja_cartera CASCADE;
  TRUNCATE TABLE syn_cartera_foto CASCADE;
  TRUNCATE TABLE syn_glosa CASCADE;
  TRUNCATE TABLE syn_recaudo CASCADE;
  TRUNCATE TABLE syn_cuenta_cobro CASCADE;
  TRUNCATE TABLE syn_nota_credito CASCADE;
  TRUNCATE TABLE syn_factura CASCADE;
  TRUNCATE TABLE syn_tercero CASCADE;
`)
console.log('✓ Tablas locales vaciadas completamente.')
await pool.end()
