import sql from 'mssql'
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const sqlConfig = {
  server: process.env.MSSQL_HOST,
  port: Number(process.env.MSSQL_PORT || 1433),
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE || 'KESPERANZA',
  options: { encrypt: false, trustServerCertificate: true },
}

if (!sqlConfig.server || !sqlConfig.user || !sqlConfig.password) {
  throw new Error('Defina MSSQL_HOST, MSSQL_USER y MSSQL_PASSWORD (KESPERANZA) en backend/.env')
}

const pgPool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
})

console.log('Sincronizando catálogo completo de terceros desde TER...')
const mssql = await sql.connect(sqlConfig)
const pgClient = await pgPool.connect()

try {
  const res = await mssql.request().query(`
    SELECT IDTERCERO, RAZONSOCIAL, NIT FROM TER WHERE IDTERCERO IS NOT NULL
  `)
  console.log(`Extraídos ${res.recordset.length} terceros. Guardando en syn_tercero...`)

  await pgClient.query('BEGIN')
  const batchSize = 1000
  for (let i = 0; i < res.recordset.length; i += batchSize) {
    const batch = res.recordset.slice(i, i + batchSize)
    const placeholders = []
    const values = []
    batch.forEach((r, idx) => {
      const offset = idx * 3
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`)
      values.push(r.IDTERCERO, r.RAZONSOCIAL || r.IDTERCERO, r.NIT || '')
    })
    const query = `
      INSERT INTO syn_tercero (idtercero, razon_social, nit)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (idtercero) DO UPDATE SET
        razon_social = EXCLUDED.razon_social,
        nit = EXCLUDED.nit
    `
    await pgClient.query(query, values)
  }
  await pgClient.query('COMMIT')
  console.log('✓ Catálogo syn_tercero actualizado al 100%.')
} finally {
  pgClient.release()
  await mssql.close()
  await pgPool.end()
}
