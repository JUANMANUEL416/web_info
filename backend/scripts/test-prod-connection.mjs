import sql from 'mssql'

const config = {
  server: process.env.MSSQL_HOST,
  port: 1433,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  connectionTimeout: 15000,
  requestTimeout: 30000,
}

console.log('Probando conexión a KESPERANZA (Producción)...')
try {
  const pool = await sql.connect(config)
  console.log('✓ Conexión exitosa a 158.69.109.45:1433 / KESPERANZA')

  // Conteo de facturas FTR
  const countFtr = await pool.request().query('SELECT COUNT(*) AS total_facturas FROM FTR')
  console.log('Total registros en FTR:', countFtr.recordset[0].total_facturas)

  // Muestra de años en FTR
  const anios = await pool.request().query(`
    SELECT YEAR(F_FACTURA) AS anio, COUNT(*) AS cantidad, SUM(VR_TOTAL) AS total_facturado
    FROM FTR
    WHERE F_FACTURA IS NOT NULL
    GROUP BY YEAR(F_FACTURA)
    ORDER BY anio DESC
  `)
  console.log('\nFacturación por año:')
  console.table(anios.recordset)

  await pool.close()
} catch (err) {
  console.error('Error de conexión:', err.message)
}
