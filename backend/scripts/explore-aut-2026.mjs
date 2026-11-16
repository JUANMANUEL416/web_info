import sql from 'mssql'
import dotenv from 'dotenv'
dotenv.config()

const config = {
  server: process.env.MSSQL_HOST || process.env.MSSQL_HOST,
  port: Number(process.env.MSSQL_PORT || 1433),
  user: process.env.MSSQL_USER || process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD || process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE || process.env.MSSQL_DATABASE,
  options: { encrypt: false, trustServerCertificate: true, requestTimeout: 30000 }
}

async function run() {
  const pool = await sql.connect(config)

  const res = await pool.request().query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN NUMAUTORIZA IS NOT NULL AND LTRIM(RTRIM(NUMAUTORIZA)) != '' THEN 1 END) as con_num_autoriza,
      COUNT(CASE WHEN NUMAUTORIZA IS NULL OR LTRIM(RTRIM(NUMAUTORIZA)) = '' THEN 1 END) as sin_num_autoriza,
      COUNT(CASE WHEN FACTURADA = 1 THEN 1 END) as facturadas,
      COUNT(CASE WHEN FACTURADA = 0 THEN 1 END) as sin_facturar,
      COUNT(CASE WHEN ESTADO = 'Anulada' THEN 1 END) as anuladas,
      SUM(VALORTOTAL) as valor_total,
      SUM(CASE WHEN FACTURADA = 1 THEN VALORTOTAL ELSE 0 END) as valor_facturado,
      SUM(CASE WHEN FACTURADA = 0 AND ESTADO != 'Anulada' THEN VALORTOTAL ELSE 0 END) as valor_pendiente_facturar,
      SUM(VALORCOPAGO) as valor_copagos
    FROM AUT
    WHERE YEAR(FECHA) = 2026
  `)
  console.log('AUT 2026 Resumen Ejecutivo:', res.recordset[0])

  await pool.close()
}

run().catch(console.error)
