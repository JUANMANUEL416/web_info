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

  const fpagTotales = await pool.request().query(`
    SELECT 
      ISNULL(INGRESO, 'SIN_INGRESO') as canal_ingreso,
      COUNT(*) as total_pagos,
      SUM(VLRTOTAL) as valor_total
    FROM FPAG
    WHERE YEAR(FECHAPAGO) = 2026
    GROUP BY INGRESO
  `)
  console.log('FPAG por canal de ingreso 2026:', fpagTotales.recordset)

  await pool.close()
}

run().catch(console.error)
