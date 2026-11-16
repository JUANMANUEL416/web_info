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

  // Recibos de Caja / Recaudos
  const tables = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME LIKE 'RC%' OR TABLE_NAME LIKE 'REC%' OR TABLE_NAME LIKE 'CAJA%'
  `)
  console.log('Tablas Recibos/Caja:', tables.recordset.map(t => t.TABLE_NAME))

  // Bancos / Consignaciones / Pagos
  const tablesB = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME LIKE '%CONBAN%' OR TABLE_NAME LIKE '%EXTRACTO%' OR TABLE_NAME LIKE 'BAN%'
  `)
  console.log('Tablas Bancos:', tablesB.recordset.map(t => t.TABLE_NAME))

  // ENCU stats
  const encuStats = await pool.request().query(`
    SELECT YEAR(FCREA) as anio, COUNT(*) as total FROM ENCU GROUP BY YEAR(FCREA) ORDER BY anio DESC
  `)
  console.log('ENCU por año:', encuStats.recordset)

  await pool.close()
}

run().catch(console.error)
