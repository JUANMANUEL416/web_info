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

async function inspect() {
  const pool = await sql.connect(config)

  console.log('=== INSPECCIÓN DETALLADA DE PROCESOS RESTANTES EN KESPERANZA ===\n')

  // 1. Proceso 3: Apoyo Diagnóstico (VW_RESULTADO_IMG)
  console.log('--- 3. RESULTADOS DE APOYO (VW_RESULTADO_IMG) ---')
  const countImg2026 = await pool.request().query(`
    SELECT COUNT(*) as total FROM VW_RESULTADO_IMG WHERE YEAR(FECHAREALIZADO) = 2026
  `)
  console.log('Total 2026 en VW_RESULTADO_IMG:', countImg2026.recordset[0].total)

  const topImgEstudios = await pool.request().query(`
    SELECT TOP 5 IDSERVICIO, DESCSERVICIO, COUNT(*) as total 
    FROM VW_RESULTADO_IMG 
    WHERE YEAR(FECHAREALIZADO) = 2026 
    GROUP BY IDSERVICIO, DESCSERVICIO 
    ORDER BY total DESC
  `)
  console.log('Top Estudios 2026:', topImgEstudios.recordset)

  // 2. Proceso 4: Historia Clínica (HCA)
  console.log('\n--- 4. HISTORIA CLÍNICA (HCA) ---')
  const countHca2026 = await pool.request().query(`
    SELECT COUNT(*) as total FROM HCA WHERE YEAR(FECHA) = 2026
  `)
  console.log('Total 2026 en HCA:', countHca2026.recordset[0].total)

  const sampleHca = await pool.request().query(`
    SELECT TOP 1 * FROM HCA WHERE YEAR(FECHA) = 2026
  `)
  console.log('Sample HCA keys:', Object.keys(sampleHca.recordset[0]))

  // Check top diagnósticos in HCA / HCAD / VWK_DIAGNOSTICOS
  const tablesDiag = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%DIAG%'
  `)
  console.log('Tablas Diagnósticos:', tablesDiag.recordset.map(t => t.TABLE_NAME))

  // 3. Proceso 5: Recaudos en Caja (CAJR)
  console.log('\n--- 5. RECAUDOS EN CAJA (CAJR) ---')
  const countCajr2026 = await pool.request().query(`
    SELECT COUNT(*) as total, SUM(VALOR) as valor_total, COUNT(DISTINCT CODCAJA) as cajas, COUNT(DISTINCT USUARIO) as cajeros 
    FROM CAJR 
    WHERE YEAR(FECHA) = 2026
  `)
  console.log('Total 2026 en CAJR:', countCajr2026.recordset[0])

  const sampleCajr = await pool.request().query(`
    SELECT TOP 2 * FROM CAJR WHERE YEAR(FECHA) = 2026 ORDER BY FECHA DESC
  `)
  console.log('Sample CAJR:', sampleCajr.recordset)

  // 4. Proceso 6: Bancos (ACBAN / CONBAN / syn_recaudo)
  console.log('\n--- 6. RECAUDOS EN BANCOS (ACBAN) ---')
  const countAcban = await pool.request().query(`
    SELECT COUNT(*) as total, SUM(VALOR) as valor_total 
    FROM ACBAN 
    WHERE YEAR(FECHA) = 2026
  `)
  console.log('Total 2026 en ACBAN:', countAcban.recordset[0])

  const sampleAcban = await pool.request().query(`
    SELECT TOP 2 * FROM ACBAN WHERE YEAR(FECHA) = 2026 ORDER BY FECHA DESC
  `)
  console.log('Sample ACBAN:', sampleAcban.recordset)

  // 5. Proceso 7: SIAU / Satisfacción (ENCU)
  console.log('\n--- 7. SIAU / SATISFACCIÓN (ENCU) ---')
  const countEncu = await pool.request().query(`
    SELECT COUNT(*) as total, COUNT(DISTINCT TIPO) as tipos 
    FROM ENCU
  `)
  console.log('Total ENCU:', countEncu.recordset[0])

  const sampleEncu = await pool.request().query(`
    SELECT TOP 2 * FROM ENCU ORDER BY FECHA DESC
  `)
  console.log('Sample ENCU:', sampleEncu.recordset)

  await pool.close()
}

inspect().catch(console.error)
