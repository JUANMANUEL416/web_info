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

  const colsFpag = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'FPAG'
  `)
  console.log('Cols FPAG:', colsFpag.recordset.map(c => c.COLUMN_NAME).join(', '))

  const sampleFpag = await pool.request().query(`
    SELECT TOP 3 * FROM FPAG WHERE YEAR(FECHAPAGO) = 2026 ORDER BY FECHAPAGO DESC
  `)
  console.log('Sample FPAG 2026:', sampleFpag.recordset)

  const fpagTotales = await pool.request().query(`
    SELECT 
      INGRESO,
      COUNT(*) as total_pagos,
      SUM(VALORTOTAL) as valor_total
    FROM FPAG
    WHERE YEAR(FECHAPAGO) = 2026
    GROUP BY INGRESO
  `)
  console.log('FPAG por INGRESO (Caja / Banco) 2026:', fpagTotales.recordset)

  await pool.close()
}

run().catch(console.error)
