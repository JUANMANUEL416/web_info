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

console.log('Sincronizando Facturación 2025 y 2026 desde KESPERANZA (Producción)...')
const mssql = await sql.connect(sqlConfig)
const pgClient = await pgPool.connect()

try {
  const res = await mssql.request().query(`
    SELECT 
      f.N_FACTURA,
      f.IDTERCERO,
      t.RAZONSOCIAL,
      t.NIT,
      CONVERT(VARCHAR(10), f.F_FACTURA, 120) AS FECHA,
      CONVERT(VARCHAR(10), f.F_VENCE, 120) AS F_VENCE,
      f.VR_TOTAL,
      f.ESTADO,
      ISNULL(f.FACTE, 0) AS FACTE,
      f.CUFE,
      f.PROCEDENCIA,
      f.IDPLAN,
      f.TIPOFAC,
      f.USUARIOFACTURA,
      ISNULL(u.NOMBRE, f.USUARIOFACTURA) AS USUARIO_NOMBRE,
      f.CUV,
      ISNULL(f.INDCXC, 0) AS INDCXC,
      f.INDCARTERA
    FROM FTR f
    LEFT JOIN TER t ON t.IDTERCERO = f.IDTERCERO
    LEFT JOIN USUSU u ON u.USUARIO = f.USUARIOFACTURA
    WHERE YEAR(f.F_FACTURA) >= 2025
  `)

  const total = res.recordset.length
  console.log(`Extraídas ${total} facturas. Guardando en syn_factura (PostgreSQL)...`)

  await pgClient.query('BEGIN')
  const batchSize = 1000
  for (let i = 0; i < total; i += batchSize) {
    const batch = res.recordset.slice(i, i + batchSize)
    const placeholders = []
    const values = []

    batch.forEach((r, idx) => {
      const offset = idx * 15
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15})`)
      values.push(
        r.N_FACTURA,
        r.IDTERCERO,
        r.RAZONSOCIAL || r.IDTERCERO,
        r.NIT || '',
        r.FECHA,
        r.F_VENCE,
        Number(r.VR_TOTAL) || 0,
        r.ESTADO || 'P',
        Number(r.FACTE) || 0,
        r.CUFE || null,
        r.PROCEDENCIA || null,
        r.IDPLAN || null,
        r.USUARIOFACTURA || null,
        r.USUARIO_NOMBRE || null,
        Number(r.INDCXC) || 0
      )
    })

    const query = `
      INSERT INTO syn_factura (
        n_factura, idtercero, razon_social, nit, fecha, f_vence, valor_total, estado, facte, cufe, procedencia, idplan,
        usuario_factura, usuario_nombre, indcxc
      ) VALUES ${placeholders.join(', ')}
      ON CONFLICT (n_factura) DO UPDATE SET
        estado = EXCLUDED.estado,
        facte = EXCLUDED.facte,
        cufe = EXCLUDED.cufe,
        usuario_factura = EXCLUDED.usuario_factura,
        usuario_nombre = EXCLUDED.usuario_nombre,
        indcxc = EXCLUDED.indcxc,
        fecha_sync = NOW()
    `
    await pgClient.query(query, values)
  }

  await pgClient.query('COMMIT')
  console.log(`✓ ${total} facturas sincronizadas exitosamente en syn_factura.`)
} catch (e) {
  await pgClient.query('ROLLBACK')
  console.error('Error sincronizando facturas:', e.message)
} finally {
  pgClient.release()
  await mssql.close()
  await pgPool.end()
}
