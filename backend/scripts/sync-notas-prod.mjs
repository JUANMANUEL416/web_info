import sql from 'mssql'
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const sqlConfig = {
  server: process.env.MSSQL_HOST || process.env.MSSQL_HOST,
  port: Number(process.env.MSSQL_PORT || 1433),
  user: process.env.MSSQL_USER || process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD || process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE || process.env.MSSQL_DATABASE,
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: 120000,
}

const pgPool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
})

console.log('Sincronizando Notas Crédito y Débito (2025-2026) desde KESPERANZA...')
const mssql = await sql.connect(sqlConfig)
const pgClient = await pgPool.connect()

try {
  const res = await mssql.request().query(`
    SELECT 
      fn.CNSFNOT,
      fn.CLASE,
      fn.N_FACTURA,
      fn.IDTERCERO,
      CONVERT(VARCHAR(10), fn.F_NOTA, 120) AS FECHA,
      fn.VR_TOTAL,
      fn.PROCEDENCIA,
      fn.CONCEPTO AS MOTIVO,
      fn.OBSERVACION,
      fn.ESTADO,
      fn.CERRADA,
      CASE WHEN f.ESTADO = 'A' THEN 1 ELSE 0 END AS ANULA_FACTURA
    FROM FNOT fn
    LEFT JOIN FTR f ON f.N_FACTURA = fn.N_FACTURA
    WHERE YEAR(fn.F_NOTA) >= 2025
  `)

  const total = res.recordset.length
  console.log(`Extraídas ${total} notas. Guardando en syn_nota_credito...`)

  await pgClient.query('BEGIN')
  const batchSize = 1000
  for (let i = 0; i < total; i += batchSize) {
    const batch = res.recordset.slice(i, i + batchSize)
    const placeholders = []
    const values = []

    batch.forEach((r, idx) => {
      const offset = idx * 12
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12})`)
      values.push(
        r.CNSFNOT,
        r.CLASE,
        r.N_FACTURA,
        r.IDTERCERO,
        r.FECHA,
        Number(r.VR_TOTAL) || 0,
        r.PROCEDENCIA || null,
        r.MOTIVO || null,
        r.OBSERVACION || null,
        r.ESTADO || 'O',
        Number(r.CERRADA) || 1,
        Boolean(r.ANULA_FACTURA)
      )
    })

    const query = `
      INSERT INTO syn_nota_credito (
        cnsfnot, clase, n_factura, idtercero, fecha, vr_total, procedencia, motivo, observacion, estado, cerrada, anula_factura
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (cnsfnot) DO UPDATE SET
        estado = EXCLUDED.estado,
        cerrada = EXCLUDED.cerrada,
        anula_factura = EXCLUDED.anula_factura,
        fecha_sync = NOW()
    `
    await pgClient.query(query, values)
  }

  await pgClient.query('COMMIT')
  console.log(`✓ ${total} notas crédito sincronizadas exitosamente en syn_nota_credito.`)
} catch (e) {
  await pgClient.query('ROLLBACK')
  console.error('Error sincronizando notas crédito:', e.message)
} finally {
  pgClient.release()
  await mssql.close()
  await pgPool.end()
}
