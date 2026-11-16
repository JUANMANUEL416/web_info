import sql from 'mssql'

const config = {
  server: process.env.MSSQL_HOST,
  port: 1433,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE,
  options: { encrypt: false, trustServerCertificate: true },
}

const pool = await sql.connect(config)

console.log('=== ANALIZANDO CAMPOS Y VALORES DE FTR (KESPERANZA) ===\n')

// 1. Estados de factura
const estados = await pool.request().query(`
  SELECT ESTADO, COUNT(*) AS cantidad, SUM(VR_TOTAL) AS total
  FROM FTR
  GROUP BY ESTADO
  ORDER BY cantidad DESC
`)
console.log('1. Estados de factura (ESTADO):')
console.table(estados.recordset)

// 2. Procedencias
const procedencias = await pool.request().query(`
  SELECT PROCEDENCIA, COUNT(*) AS cantidad, SUM(VR_TOTAL) AS total
  FROM FTR
  GROUP BY PROCEDENCIA
  ORDER BY cantidad DESC
`)
console.log('\n2. Procedencias:')
console.table(procedencias.recordset)

// 3. Tipos de Facturación / Modalidades
const modalidades = await pool.request().query(`
  SELECT TIPOFAC, COUNT(*) AS cantidad, SUM(VR_TOTAL) AS total
  FROM FTR
  GROUP BY TIPOFAC
  ORDER BY cantidad DESC
`)
console.log('\n3. Tipos de Factura (TIPOFAC):')
console.table(modalidades.recordset)

// 4. Estados DIAN (FACTE)
const facte = await pool.request().query(`
  SELECT FACTE, COUNT(*) AS cantidad, SUM(VR_TOTAL) AS total
  FROM FTR
  GROUP BY FACTE
  ORDER BY FACTE
`)
console.log('\n4. Estado DIAN (FACTE):')
console.table(facte.recordset)

// 5. Cuentas de Cobro asociadas (INDCXC / INDCARTERA)
const cxcInd = await pool.request().query(`
  SELECT INDCARTERA, INDCXC, COUNT(*) AS cantidad, SUM(VR_TOTAL) AS total
  FROM FTR
  GROUP BY INDCARTERA, INDCXC
`)
console.log('\n5. Indicadores Cartera/CXC (INDCARTERA, INDCXC):')
console.table(cxcInd.recordset)

// 6. RIPS y CUFE/CUV
const rips = await pool.request().query(`
  SELECT 
    COUNT(*) AS total_facturas,
    COUNT(CASE WHEN CUFE IS NOT NULL AND CUFE <> '' THEN 1 END) AS con_cufe,
    COUNT(CASE WHEN CUV IS NOT NULL AND CUV <> '' THEN 1 END) AS con_cuv_rips,
    COUNT(CASE WHEN FRADICA_RIPS IS NOT NULL THEN 1 END) AS con_rips_radicado
  FROM FTR
  WHERE YEAR(F_FACTURA) >= 2025
`)
console.log('\n6. Cobertura DIAN (CUFE) y RIPS (CUV) 2025-2026:')
console.table(rips.recordset)

// 7. Usuarios que facturan (operatividad)
const usuarios = await pool.request().query(`
  SELECT TOP 10 USUARIOFACTURA, COUNT(*) AS total_facturas, SUM(VR_TOTAL) AS total_valor
  FROM FTR
  WHERE YEAR(F_FACTURA) = 2026
  GROUP BY USUARIOFACTURA
  ORDER BY total_facturas DESC
`)
console.log('\n7. Top Usuarios Facturadores (2026):')
console.table(usuarios.recordset)

// 8. Plazas y Sedes
const sedes = await pool.request().query(`
  SELECT IDSEDE, COUNT(*) AS cantidad, SUM(VR_TOTAL) AS total
  FROM FTR
  GROUP BY IDSEDE
  ORDER BY cantidad DESC
`)
console.log('\n8. Sedes (IDSEDE):')
console.table(sedes.recordset)

await pool.close()
