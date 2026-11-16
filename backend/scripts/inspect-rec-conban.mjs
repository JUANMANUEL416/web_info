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

  // 1. REC
  const colsRec = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'REC'
  `)
  console.log('Cols REC:', colsRec.recordset.map(c => c.COLUMN_NAME).join(', '))
  const countRec2026 = await pool.request().query(`
    SELECT COUNT(*) as total, SUM(VALORTOTAL) as valor_total FROM REC WHERE YEAR(FECHA) = 2026
  `)
  console.log('Total 2026 en REC:', countRec2026.recordset[0])

  // 2. CONBAN
  const colsConban = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CONBAN'
  `)
  console.log('\nCols CONBAN:', colsConban.recordset.map(c => c.COLUMN_NAME).join(', '))
  const countConban = await pool.request().query(`
    SELECT COUNT(*) as total, SUM(VALOR) as valor_total FROM CONBAN WHERE YEAR(FECHA) = 2026
  `)
  console.log('Total 2026 en CONBAN:', countConban.recordset[0])

  await pool.close()
}

run().catch(console.error)
