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

console.time('query-resumen')
const r1 = await pool.query(`
  SELECT 
    fecha_corte,
    COUNT(DISTINCT n_factura) AS total_facturas,
    COUNT(DISTINCT idtercero) AS total_deudores,
    SUM(saldo_neto) AS saldo_total,
    SUM(d0_30) AS d0_30,
    SUM(d31_60) AS d31_60,
    SUM(d61_90) AS d61_90,
    SUM(d91_120) AS d91_120,
    SUM(d121_150) AS d121_150,
    SUM(d151_180) AS d151_180,
    SUM(d181_360) AS d181_360,
    SUM(d361_mas) AS d361_mas
  FROM syn_cartera_foto
  WHERE fecha_corte = (SELECT MAX(fecha_corte) FROM syn_cartera_foto)
  GROUP BY fecha_corte
`)
console.timeEnd('query-resumen')

console.time('query-top')
const r2 = await pool.query(`
  SELECT 
    c.idtercero,
    COALESCE(MAX(f.razon_social), c.idtercero) AS razon_social,
    COALESCE(MAX(f.nit), '') AS nit,
    COUNT(DISTINCT c.n_factura) AS total_facturas,
    SUM(c.saldo_neto) AS saldo_total,
    SUM(c.d0_30 + c.d31_60 + c.d61_90 + c.d91_120 + c.d121_150 + c.d151_180 + c.d181_360 + c.d361_mas) AS saldo_vencido,
    ROUND(AVG(c.dias_vence), 0) AS dias_promedio
  FROM syn_cartera_foto c
  LEFT JOIN syn_factura f ON f.idtercero = c.idtercero
  WHERE c.fecha_corte = (SELECT MAX(fecha_corte) FROM syn_cartera_foto)
    AND c.idtercero IS NOT NULL
  GROUP BY c.idtercero
  ORDER BY saldo_total DESC
  LIMIT 10
`)
console.timeEnd('query-top')

await pool.end()
