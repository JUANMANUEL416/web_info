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
  
  // 1. Tables matching AUT%
  const tables = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE 'AUT%' OR TABLE_NAME LIKE '%AUTORIZA%'
  `)
  console.log('Tables matching AUT:', tables.recordset.map(t => t.TABLE_NAME))

  // 2. Columns in AUT
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'AUT'
    ORDER BY ORDINAL_POSITION
  `)
  console.log('Columns in AUT:', cols.recordset.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE})`).join(', '))

  // 3. Count by year in AUT
  const counts = await pool.request().query(`
    SELECT YEAR(FECHA) as anio, COUNT(*) as total 
    FROM AUT 
    GROUP BY YEAR(FECHA) 
    ORDER BY anio DESC
  `)
  console.log('AUT counts by year:', counts.recordset)

  // 4. Sample records from AUT
  const sample = await pool.request().query(`
    SELECT TOP 3 * FROM AUT ORDER BY FECHA DESC
  `)
  console.log('Sample AUT:', JSON.stringify(sample.recordset, null, 2))

  // 5. If AUTD exists, inspect it
  const hasAutd = tables.recordset.some(t => t.TABLE_NAME === 'AUTD')
  if (hasAutd) {
    const colsD = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'AUTD'
    `)
    console.log('Columns in AUTD:', colsD.recordset.map(c => c.COLUMN_NAME).join(', '))
    const sampleD = await pool.request().query(`SELECT TOP 2 * FROM AUTD`)
    console.log('Sample AUTD:', JSON.stringify(sampleD.recordset, null, 2))
  }

  await pool.close()
}

run().catch(console.error)
