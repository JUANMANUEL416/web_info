import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const sqlConfig = {
  server: process.env.MSSQL_HOST || process.env.MSSQL_HOST,
  port: Number(process.env.MSSQL_PORT || 1433),
  user: process.env.MSSQL_USER || process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD || process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE || process.env.MSSQL_DATABASE,
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: 60000,
};

async function run() {
  const mssql = await sql.connect(sqlConfig);

  console.log('=== REPORTE EJECUTIVO Y TÉCNICO DE CXP (FCXP & VWK_CXPDIASVTO) ===\n');

  // 1. Resumen Global de Cartera Activa de Proveedores
  const kpis = await mssql.request().query(`
    SELECT 
      COUNT(*) AS total_cuentas,
      COUNT(DISTINCT IDTERCERO) AS total_proveedores,
      SUM(VALOR) AS valor_bruto,
      SUM(SALDO) AS saldo_total_pendiente,
      SUM(PORVENCER) AS por_vencer,
      SUM(DM0_30) AS vencido_0_30,
      SUM(DM31_60) AS vencido_31_60,
      SUM(DM61_90) AS vencido_61_90,
      SUM(DM91_120 + DM121_150 + DM151_180) AS vencido_91_180,
      SUM(DM181_360) AS vencido_181_360,
      SUM(DM361_MAS) AS vencido_mas_360
    FROM VWK_CXPDIASVTO
    WHERE SALDO > 0
  `);
  console.log('--- 1. KPIs de Cuentas por Pagar Activas (SALDO > 0) ---');
  console.table(kpis.recordset);

  // 2. Por Procedencia
  const proc = await mssql.request().query(`
    SELECT 
      ISNULL(PROCEDENCIA, 'Sin Definir') AS procedencia,
      COUNT(*) AS cantidad_cuentas,
      SUM(SALDO) AS saldo_pendiente,
      ROUND(SUM(SALDO) * 100.0 / (SELECT SUM(SALDO) FROM VWK_CXPDIASVTO WHERE SALDO > 0), 2) AS pct_participacion
    FROM VWK_CXPDIASVTO
    WHERE SALDO > 0
    GROUP BY PROCEDENCIA
    ORDER BY saldo_pendiente DESC
  `);
  console.log('\n--- 2. Composición por Procedencia ---');
  console.table(proc.recordset);

  // 3. Top 10 Proveedores con Mayor Deuda
  const top10 = await mssql.request().query(`
    SELECT TOP 10
      IDTERCERO,
      NIT,
      RAZONSOCIAL,
      COUNT(*) AS facturas_pendientes,
      SUM(SALDO) AS saldo_pendiente,
      SUM(PORVENCER) AS por_vencer,
      SUM(DM0_30 + DM31_60 + DM61_90 + DM91_120 + DM121_150 + DM151_180 + DM181_360 + DM361_MAS) AS total_vencido,
      MIN(F_VENCE) AS fecha_vence_mas_antigua
    FROM VWK_CXPDIASVTO
    WHERE SALDO > 0
    GROUP BY IDTERCERO, NIT, RAZONSOCIAL
    ORDER BY saldo_pendiente DESC
  `);
  console.log('\n--- 3. Top 10 Proveedores con Mayor Saldo Pendiente ---');
  console.table(top10.recordset);

  // 4. Próximos Pagos / Vencimientos Urgentes
  const proximos = await mssql.request().query(`
    SELECT TOP 8
      CNSFCXP AS consecutivo_cxp,
      NOREFERENCIA AS factura_proveedor,
      CONVERT(VARCHAR(10), FECHA, 120) AS fecha_radicado,
      CONVERT(VARCHAR(10), F_VENCE, 120) AS fecha_vence,
      RAZONSOCIAL AS proveedor,
      VALOR AS valor_original,
      SALDO AS saldo_pendiente,
      PROCEDENCIA AS procedencia,
      DIASVENCE AS dias_mora
    FROM VWK_CXPDIASVTO
    WHERE SALDO > 0
    ORDER BY F_VENCE DESC
  `);
  console.log('\n--- 4. Facturas de Proveedores más Recientes / Próximas ---');
  console.table(proximos.recordset);

  // 5. Comparativo FCXP vs VWK_CXPDIASVTO
  const comparativo = await mssql.request().query(`
    SELECT 
      'FCXP (Total Tabla Base)' AS origen,
      COUNT(*) AS registros,
      SUM(VALOR) AS valor,
      SUM(SALDO) AS saldo
    FROM FCXP
    UNION ALL
    SELECT 
      'FCXP (Con Saldo > 0)' AS origen,
      COUNT(*) AS registros,
      SUM(VALOR) AS valor,
      SUM(SALDO) AS saldo
    FROM FCXP
    WHERE SALDO > 0
    UNION ALL
    SELECT 
      'VWK_CXPDIASVTO (Con Saldo > 0)' AS origen,
      COUNT(*) AS registros,
      SUM(VALOR) AS valor,
      SUM(SALDO) AS saldo
    FROM VWK_CXPDIASVTO
    WHERE SALDO > 0
  `);
  console.log('\n--- 5. Comparativo FCXP vs VWK_CXPDIASVTO ---');
  console.table(comparativo.recordset);

  await mssql.close();
}

run().catch(console.error);
