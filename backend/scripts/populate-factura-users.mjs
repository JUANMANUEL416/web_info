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
  requestTimeout: 120000,
};

const pgPool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

async function run() {
  console.log('1. Altering syn_factura to add usuario_factura, usuario_nombre, indcxc...');
  await pgPool.query(`
    ALTER TABLE syn_factura ADD COLUMN IF NOT EXISTS usuario_factura VARCHAR(50);
    ALTER TABLE syn_factura ADD COLUMN IF NOT EXISTS usuario_nombre VARCHAR(150);
    ALTER TABLE syn_factura ADD COLUMN IF NOT EXISTS indcxc SMALLINT DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_syn_factura_usuario ON syn_factura(usuario_factura);
    CREATE INDEX IF NOT EXISTS idx_syn_factura_indcxc ON syn_factura(indcxc);
  `);
  console.log('Columns added or already exist.');

  console.log('2. Fetching user and indcxc data from MSSQL Production...');
  const mssql = await sql.connect(sqlConfig);
  const res = await mssql.request().query(`
    SELECT 
      f.N_FACTURA,
      f.USUARIOFACTURA,
      ISNULL(u.NOMBRE, f.USUARIOFACTURA) AS USUARIO_NOMBRE,
      ISNULL(f.INDCXC, 0) AS INDCXC
    FROM FTR f
    LEFT JOIN USUSU u ON u.USUARIO = f.USUARIOFACTURA
    WHERE YEAR(f.F_FACTURA) >= 2025
  `);
  await mssql.close();
  console.log(`Fetched ${res.recordset.length} records from MSSQL.`);

  console.log('3. Updating syn_factura in PostgreSQL...');
  const pgClient = await pgPool.connect();
  try {
    await pgClient.query('BEGIN');
    
    // Create temporary table
    await pgClient.query(`
      CREATE TEMP TABLE tmp_ftr_user (
        n_factura VARCHAR(50) PRIMARY KEY,
        usuario_factura VARCHAR(50),
        usuario_nombre VARCHAR(150),
        indcxc SMALLINT
      ) ON COMMIT DROP;
    `);

    // Insert into temp table in batches
    const batchSize = 2000;
    for (let i = 0; i < res.recordset.length; i += batchSize) {
      const slice = res.recordset.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];
      slice.forEach((row, idx) => {
        const offset = idx * 4;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        values.push(row.N_FACTURA, row.USUARIOFACTURA, row.USUARIO_NOMBRE, row.INDCXC);
      });
      await pgClient.query(`
        INSERT INTO tmp_ftr_user (n_factura, usuario_factura, usuario_nombre, indcxc)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (n_factura) DO UPDATE SET
          usuario_factura = EXCLUDED.usuario_factura,
          usuario_nombre = EXCLUDED.usuario_nombre,
          indcxc = EXCLUDED.indcxc
      `, values);
    }
    console.log('Temp table loaded. Executing update on syn_factura...');

    const updRes = await pgClient.query(`
      UPDATE syn_factura f
      SET 
        usuario_factura = t.usuario_factura,
        usuario_nombre = t.usuario_nombre,
        indcxc = t.indcxc
      FROM tmp_ftr_user t
      WHERE f.n_factura = t.n_factura;
    `);
    console.log(`Updated ${updRes.rowCount} rows in syn_factura.`);

    await pgClient.query('COMMIT');
    console.log('Transaction committed successfully.');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    throw err;
  } finally {
    pgClient.release();
  }

  // 4. Test Queries for the dashboard
  console.log('\n--- 4. Test Query: Facturación por Usuario (2026) ---');
  const userStats = await pgPool.query(`
    SELECT 
      COALESCE(usuario_nombre, usuario_factura, 'Sin Asignar') AS usuario,
      usuario_factura,
      COUNT(*) AS total_facturas,
      SUM(valor_total) AS total_facturado,
      ROUND(AVG(valor_total)) AS ticket_promedio,
      COUNT(CASE WHEN estado = 'A' THEN 1 END) AS facturas_anuladas,
      SUM(CASE WHEN estado = 'A' THEN valor_total ELSE 0 END) AS valor_anulado,
      COUNT(CASE WHEN indcxc = 1 THEN 1 END) AS facturas_con_cxc,
      COUNT(CASE WHEN indcxc = 0 THEN 1 END) AS facturas_sin_cxc
    FROM syn_factura
    WHERE EXTRACT(YEAR FROM fecha) = 2026
    GROUP BY usuario_nombre, usuario_factura
    ORDER BY total_facturado DESC
    LIMIT 10
  `);
  console.table(userStats.rows);

  console.log('\n--- 5. Test Query: Resumen de Control (CxC, Anuladas, Con NC) (2026) ---');
  const controlStats = await pgPool.query(`
    SELECT
      COUNT(*) AS total_facturas,
      SUM(valor_total) AS total_facturado,
      -- Con CxC
      COUNT(CASE WHEN indcxc = 1 THEN 1 END) AS facturas_con_cxc,
      SUM(CASE WHEN indcxc = 1 THEN valor_total ELSE 0 END) AS valor_con_cxc,
      -- Sin CxC
      COUNT(CASE WHEN indcxc = 0 THEN 1 END) AS facturas_sin_cxc,
      SUM(CASE WHEN indcxc = 0 THEN valor_total ELSE 0 END) AS valor_sin_cxc,
      -- Anuladas
      COUNT(CASE WHEN estado = 'A' THEN 1 END) AS facturas_anuladas,
      SUM(CASE WHEN estado = 'A' THEN valor_total ELSE 0 END) AS valor_anulado,
      -- Con Nota Crédito
      COUNT(DISTINCT nc.n_factura) AS facturas_con_nc,
      COALESCE(SUM(nc.vr_total), 0) AS valor_notas_credito
    FROM syn_factura f
    LEFT JOIN (
      SELECT n_factura, SUM(vr_total) as vr_total
      FROM syn_nota_credito
      GROUP BY n_factura
    ) nc ON nc.n_factura = f.n_factura
    WHERE EXTRACT(YEAR FROM f.fecha) = 2026
  `);
  console.table(controlStats.rows);

  await pgPool.end();
}

run().catch(console.error);
