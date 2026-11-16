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

const tablas = [
  'syn_cartera_foto',
  'syn_factura',
  'syn_nota_credito',
  'syn_cuenta_cobro',
  'syn_recaudo',
]

console.log('=== CONTEO DE DATOS EN POSTGRESQL LOCAL (VIEW INFO) ===\n')
for (const t of tablas) {
  const c = await pool.query(`SELECT COUNT(*)::int AS total FROM ${t}`)
  console.log(`- ${t.padEnd(25)}: ${c.rows[0].total.toLocaleString()} registros`)
}

// Muestra de cruce: Facturas radicadas vs no radicadas
const radSummary = await pool.query(`
  SELECT 
    radicada,
    COUNT(*) as total_cuentas,
    SUM(valor_factura) as valor_total
  FROM syn_cuenta_cobro
  GROUP BY radicada
`)
console.log('\n=== ESTADO DE RADICACIÓN (syn_cuenta_cobro) ===')
console.table(radSummary.rows)

// Muestra de notas crédito
const ncSummary = await pool.query(`
  SELECT 
    clase,
    anula_factura,
    COUNT(*) as cantidad,
    SUM(vr_total) as valor_total
  FROM syn_nota_credito
  GROUP BY clase, anula_factura
`)
console.log('\n=== NOTAS CRÉDITO/DÉBITO (syn_nota_credito) ===')
console.table(ncSummary.rows)

await pool.end()
