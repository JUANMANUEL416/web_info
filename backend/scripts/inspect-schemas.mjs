import sql from 'mssql'
import dotenv from 'dotenv'

dotenv.config()

const config = {
  server: process.env.MSSQL_HOST || process.env.MSSQL_HOST,
  port: Number(process.env.MSSQL_PORT || 1433),
  user: process.env.MSSQL_USER || process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD || process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE || process.env.MSSQL_DATABASE,
  options: { encrypt: false, trustServerCertificate: true, requestTimeout: 60000 },
}

async function run() {
  const pool = await sql.connect(config)

  for (const t of ['CAJR', 'ACBAN', 'ENCU', 'VWK_DIAGNOSTICOS']) {
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${t}'
    `)
    console.log(`\nCols ${t}:`, cols.recordset.map(c => c.COLUMN_NAME).join(', '))
    try {
      const top1 = await pool.request().query(`SELECT TOP 1 * FROM ${t}`)
      console.log(`Sample ${t}:`, top1.recordset[0])
    } catch (e) {
      console.log(`Error reading ${t}:`, e.message)
    }
  }

  await pool.close()
}

run().catch(console.error)
