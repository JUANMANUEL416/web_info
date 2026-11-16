import sql from 'mssql';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const sqlConfig = {
  server: process.env.MSSQL_HOST || process.env.MSSQL_HOST,
  port: Number(process.env.MSSQL_PORT || 1433),
  user: process.env.MSSQL_USER || process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD || process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE || process.env.MSSQL_DATABASE,
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: 180000,
};

const pgPool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

async function run() {
  console.log('[SYNC CXC & RECAUDOS] Conectando a KESPERANZA...');
  const conn = await sql.connect(sqlConfig);
  const pgClient = await pgPool.connect();

  try {
    // 1. SYNC CUENTAS DE COBRO (FCXC + FCXCD) 2025-2026
    console.log('1. Extrayendo FCXC y FCXCD (2025-2026)...');
    const cxcRes = await conn.request().query(`
      SELECT 
        c.CNSCXC,
        d.N_FACTURA,
        c.IDTERCERO,
        CONVERT(VARCHAR(10), c.FECHACXC, 120) AS FECHA_CXC,
        c.CERRADA,
        ISNULL(c.INDRECIBIDO, 0) AS RADICADA,
        CONVERT(VARCHAR(10), c.F_RECIBIDO, 120) AS F_RADICADO,
        c.NOREFERENCIAEXT AS NUM_RADICADO,
        c.QUIENRECIBIO AS QUIEN_RECIBE,
        d.VALORFACTURA
      FROM FCXC c
      INNER JOIN FCXCD d ON d.CNSCXC = c.CNSCXC
      WHERE c.FECHACXC >= '2025-01-01'
    `);
    const totalCxc = cxcRes.recordset.length;
    console.log(`-> ${totalCxc} detalles de cuenta de cobro obtenidos. Guardando por lotes...`);

    await pgClient.query('BEGIN');
    const batchSize = 1000;
    for (let i = 0; i < totalCxc; i += batchSize) {
      const batch = cxcRes.recordset.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];

      batch.forEach((r, idx) => {
        const offset = idx * 10;
        placeholders.push(`($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8}, $${offset+9}, $${offset+10})`);
        values.push(
          r.CNSCXC,
          r.N_FACTURA,
          r.IDTERCERO,
          r.FECHA_CXC,
          r.CERRADA ? 1 : 0,
          Boolean(r.RADICADA),
          r.F_RADICADO || null,
          r.NUM_RADICADO || null,
          r.QUIEN_RECIBE || null,
          Number(r.VALORFACTURA) || 0
        );
      });

      const insertSql = `
        INSERT INTO syn_cuenta_cobro (
          cnscxc, n_factura, idtercero, fecha_cxc, cerrada, radicada, f_radicado, num_radicado, quien_recibe, valor_factura
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (cnscxc, n_factura) DO UPDATE SET
          cerrada = EXCLUDED.cerrada,
          radicada = EXCLUDED.radicada,
          f_radicado = EXCLUDED.f_radicado,
          num_radicado = EXCLUDED.num_radicado,
          quien_recibe = EXCLUDED.quien_recibe,
          valor_factura = EXCLUDED.valor_factura,
          fecha_sync = NOW()
      `;
      await pgClient.query(insertSql, values);
    }
    await pgClient.query('COMMIT');
    console.log(`✓ ${totalCxc} cuentas de cobro sincronizadas.`);

    // 2. SYNC RECAUDOS (FPAG + FPAGD) 2025-2026
    console.log('2. Extrayendo FPAG y FPAGD (2025-2026)...');
    const pagRes = await conn.request().query(`
      SELECT 
        p.CNSFPAG,
        pd.N_FACTURA,
        pd.CNSCXC,
        p.IDTERCERO,
        CONVERT(VARCHAR(10), p.FECHAPAGO, 120) AS FECHA_CREACION,
        CONVERT(VARCHAR(10), p.FECHA, 120) AS FECHA_CONFIRMACION,
        p.INGRESO AS ORIGEN_PAGO,
        pd.VALORPAGO,
        pd.VLRIMPUESTO AS VALOR_IMPUESTOS,
        (ISNULL(pd.VLRDTOFIN, 0) + ISNULL(pd.VLROTROSDCTOS, 0)) AS VALOR_DESCUENTO,
        pd.ESTADO
      FROM FPAG p
      INNER JOIN FPAGD pd ON pd.CNSFPAG = p.CNSFPAG
      WHERE p.FECHAPAGO >= '2025-01-01'
    `);
    const totalPag = pagRes.recordset.length;
    console.log(`-> ${totalPag} pagos obtenidos. Guardando por lotes...`);

    await pgClient.query('BEGIN');
    await pgClient.query('TRUNCATE TABLE syn_recaudo RESTART IDENTITY');

    for (let i = 0; i < totalPag; i += batchSize) {
      const batch = pagRes.recordset.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];

      batch.forEach((r, idx) => {
        const offset = idx * 11;
        placeholders.push(`($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8}, $${offset+9}, $${offset+10}, $${offset+11})`);
        values.push(
          r.CNSFPAG,
          r.N_FACTURA,
          r.CNSCXC || null,
          r.IDTERCERO || null,
          r.FECHA_CREACION,
          r.FECHA_CONFIRMACION || null,
          r.ORIGEN_PAGO || null,
          Number(r.VALORPAGO) || 0,
          Number(r.VALOR_IMPUESTOS) || 0,
          Number(r.VALOR_DESCUENTO) || 0,
          r.ESTADO || 'Cerrado'
        );
      });

      const insertSql = `
        INSERT INTO syn_recaudo (
          cnsfpag, n_factura, cnscxc, idtercero, fecha_creacion, fecha_confirmacion, origen_pago,
          valor_pago, valor_impuestos, valor_descuento, estado
        ) VALUES ${placeholders.join(', ')}
      `;
      await pgClient.query(insertSql, values);
    }
    await pgClient.query('COMMIT');
    console.log(`✓ ${totalPag} recaudos sincronizados.`);

  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('Error durante sincronización:', err);
  } finally {
    pgClient.release();
    await conn.close();
    await pgPool.end();
  }
}

run();
