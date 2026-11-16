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

const res = await pool.query(`
  SELECT 
    fecha_corte,
    COUNT(*) AS total_filas,
    COUNT(DISTINCT n_factura) AS total_facturas,
    COUNT(DISTINCT idtercero) AS total_terceros,
    SUM(saldo_neto) AS saldo_total,
    SUM(d0_30) AS d0_30,
    SUM(d31_60) AS d31_60,
    SUM(d361_mas) AS d361_mas
  FROM syn_cartera_foto
  GROUP BY fecha_corte
`)

console.log('=== RESUMEN EN POSTGRESQL LOCAL (syn_cartera_foto) ===')
console.table(res.rows)

await pool.end()
