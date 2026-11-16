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

  console.log('=== ANÁLISIS DE CUENTAS POR PAGAR (VWK_CXPDIASVTO & FCXP) ===\n');

  // 1. Resumen global de obligaciones activas (SALDO > 0)
  const resumenActivo = await mssql.request().query(`
    SELECT 
      COUNT(*) AS total_cuentas_activas,
      COUNT(DISTINCT IDTERCERO) AS total_proveedores_activos,
      SUM(VALOR) AS valor_total_obligaciones,
      SUM(SALDO) AS saldo_total_pendiente,
      SUM(PORVENCER) AS total_por_vencer,
      SUM(D0_30) AS vencido_0_30,
      SUM(D31_60) AS vencido_31_60,
      SUM(D61_90) AS vencido_61_90,
      SUM(D91_120 + D121_150 + D151_180) AS vencido_91_180,
      SUM(D181_360) AS vencido_181_360,
      SUM(D361_MAS) AS vencido_mas_360
    FROM VWK_CXPDIASVTO
    WHERE SALDO > 0
  `);
  console.log('--- 1. Resumen de Cartera Activa de Proveedores (SALDO > 0) ---');
  console.table(resumenActivo.recordset);

  // 2. Distribución por Procedencia del Gasto/Obligación
  const porProcedencia = await mssql.request().query(`
    SELECT 
      ISNULL(PROCEDENCIA, 'SIN PROCEDENCIA') AS procedencia,
      COUNT(*) AS cantidad_cuentas,
      SUM(VALOR) AS valor_total,
      SUM(SALDO) AS saldo_pendiente
    FROM VWK_CXPDIASVTO
    WHERE SALDO > 0
    GROUP BY PROCEDENCIA
    ORDER BY saldo_pendiente DESC
  `);
  console.log('\n--- 2. Cuentas por Pagar por Procedencia (Servicios, Compras, etc.) ---');
  console.table(porProcedencia.recordset);

  // 3. Top 15 Proveedores con mayor saldo pendiente
  const topProveedores = await mssql.request().query(`
    SELECT TOP 15
      IDTERCERO,
      NIT,
      RAZONSOCIAL,
      COUNT(*) AS facturas_pendientes,
      SUM(VALOR) AS valor_total,
      SUM(SALDO) AS saldo_pendiente,
      SUM(PORVENCER) AS por_vencer,
      SUM(D0_30 + D31_60 + D61_90 + D91_120 + D121_150 + D151_180 + D181_360 + D361_MAS) AS total_vencido,
      MIN(F_VENCE) AS vencimiento_mas_antiguo
    FROM VWK_CXPDIASVTO
    WHERE SALDO > 0
    GROUP BY IDTERCERO, NIT, RAZONSOCIAL
    ORDER BY saldo_pendiente DESC
  `);
  console.log('\n--- 3. Top 15 Proveedores / Acreedores con mayor saldo ---');
  console.table(topProveedores.recordset);

  // 4. Próximos Vencimientos y Programación de Pagos (Noviembre - Diciembre 2026)
  const proximos = await mssql.request().query(`
    SELECT TOP 10
      CNSFCXP,
      NOREFERENCIA,
      F_FACTURAREF,
      F_VENCE,
      RAZONSOCIAL,
      VALOR,
      SALDO,
      PROCEDENCIA,
      DIASVENCE
    FROM VWK_CXPDIASVTO
    WHERE SALDO > 0
    ORDER BY F_VENCE ASC
  `);
  console.log('\n--- 4. Muestra de Próximas Cuentas por Vencer / Vencidas Urgentes ---');
  console.table(proximos.recordset);

  // 5. Histórico de Pagos de CxP en FCXP (Total pagado / cancelado en 2025 y 2026)
  const historicoPagos = await mssql.request().query(`
    SELECT 
      YEAR(FECHA) AS anio,
      ESTADO,
      COUNT(*) AS cantidad,
      SUM(VALOR) AS valor_emitido,
      SUM(SALDO) AS saldo_remanente
    FROM FCXP
    WHERE YEAR(FECHA) >= 2025
    GROUP BY YEAR(FECHA), ESTADO
    ORDER BY anio DESC, ESTADO
  `);
  console.log('\n--- 5. Histórico FCXP 2025-2026 por Estado ---');
  console.table(historicoPagos.recordset);

  await mssql.close();
}

run().catch(console.error);
