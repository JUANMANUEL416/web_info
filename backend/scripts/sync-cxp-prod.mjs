import sql from 'mssql'
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const sqlConfig = {
  server: process.env.MSSQL_HOST || process.env.MSSQL_HOST,
  port: Number(process.env.MSSQL_PORT || 1433),
  user: process.env.MSSQL_USER || process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD || process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE || process.env.MSSQL_DATABASE,
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: 120000,
}

const pgPool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
})

async function syncCxp() {
  console.log('=== SINCRONIZACIÓN DE CUENTAS POR PAGAR (VWK_CXPDIASVTO -> syn_cxp) ===\n')

  const mssql = await sql.connect(sqlConfig)
  const pgClient = await pgPool.connect()

  try {
    // 1. Crear tabla syn_cxp en PostgreSQL si no existe
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS syn_cxp (
        cnsfcxp VARCHAR(20) PRIMARY KEY,
        fecha DATE,
        cnsfcom VARCHAR(20),
        idtercero VARCHAR(20),
        nit VARCHAR(50),
        razon_social VARCHAR(255),
        noreferencia VARCHAR(50),
        f_facturaref DATE,
        f_vence DATE,
        valor NUMERIC(15,2) DEFAULT 0,
        estado VARCHAR(10),
        usuario VARCHAR(50),
        tipocxp VARCHAR(50),
        procedencia VARCHAR(50),
        observacion TEXT,
        saldo NUMERIC(15,2) DEFAULT 0,
        vlr_neto NUMERIC(15,2) DEFAULT 0,
        vlr_iva NUMERIC(15,2) DEFAULT 0,
        vlr_impuestos NUMERIC(15,2) DEFAULT 0,
        vlr_abonos NUMERIC(15,2) DEFAULT 0,
        vlr_notascredito NUMERIC(15,2) DEFAULT 0,
        vlr_notasdebito NUMERIC(15,2) DEFAULT 0,
        dias_vence INTEGER DEFAULT 0,
        por_vencer NUMERIC(15,2) DEFAULT 0,
        d0_30 NUMERIC(15,2) DEFAULT 0,
        d31_60 NUMERIC(15,2) DEFAULT 0,
        dm0_30 NUMERIC(15,2) DEFAULT 0,
        dm31_60 NUMERIC(15,2) DEFAULT 0,
        dm61_90 NUMERIC(15,2) DEFAULT 0,
        dm91_120 NUMERIC(15,2) DEFAULT 0,
        dm121_150 NUMERIC(15,2) DEFAULT 0,
        dm151_180 NUMERIC(15,2) DEFAULT 0,
        dm181_360 NUMERIC(15,2) DEFAULT 0,
        dm361_mas NUMERIC(15,2) DEFAULT 0,
        fecha_sync TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_syn_cxp_saldo ON syn_cxp (saldo);
      CREATE INDEX IF NOT EXISTS idx_syn_cxp_idtercero ON syn_cxp (idtercero);
      CREATE INDEX IF NOT EXISTS idx_syn_cxp_procedencia ON syn_cxp (procedencia);
      CREATE INDEX IF NOT EXISTS idx_syn_cxp_f_vence ON syn_cxp (f_vence);
    `)

    // 2. Extraer de SQL Server VWK_CXPDIASVTO
    console.log('Consultando VWK_CXPDIASVTO en KESPERANZA...')
    const result = await mssql.request().query(`
      SELECT 
        v.CNSFCXP,
        CONVERT(VARCHAR(10), v.FECHA, 120) AS FECHA,
        v.CNSFCOM,
        v.IDTERCERO,
        ISNULL(v.NIT, '') AS NIT,
        ISNULL(v.RAZONSOCIAL, v.IDTERCERO) AS RAZONSOCIAL,
        ISNULL(v.NOREFERENCIA, '') AS NOREFERENCIA,
        CONVERT(VARCHAR(10), v.F_FACTURAREF, 120) AS F_FACTURAREF,
        CONVERT(VARCHAR(10), v.F_VENCE, 120) AS F_VENCE,
        ISNULL(v.VALOR, 0) AS VALOR,
        v.ESTADO,
        v.USUARIO,
        v.TIPOCXP,
        ISNULL(v.PROCEDENCIA, 'Sin Definir') AS PROCEDENCIA,
        v.OBSERVACION,
        ISNULL(v.SALDO, 0) AS SALDO,
        ISNULL(v.VLR_NETO, 0) AS VLR_NETO,
        ISNULL(v.VLR_IVA, 0) AS VLR_IVA,
        ISNULL(v.VLR_IMPUESTOS, 0) AS VLR_IMPUESTOS,
        ISNULL(v.VLR_ABONOS, 0) AS VLR_ABONOS,
        ISNULL(v.VLR_NOTASCREDITO, 0) AS VLR_NOTASCREDITO,
        ISNULL(v.VLR_NOTASDEBITO, 0) AS VLR_NOTASDEBITO,
        ISNULL(v.DIASVENCE, 0) AS DIASVENCE,
        ISNULL(v.PORVENCER, 0) AS PORVENCER,
        ISNULL(v.D0_30, 0) AS D0_30,
        ISNULL(v.D31_60, 0) AS D31_60,
        ISNULL(v.DM0_30, 0) AS DM0_30,
        ISNULL(v.DM31_60, 0) AS DM31_60,
        ISNULL(v.DM61_90, 0) AS DM61_90,
        ISNULL(v.DM91_120, 0) AS DM91_120,
        ISNULL(v.DM121_150, 0) AS DM121_150,
        ISNULL(v.DM151_180, 0) AS DM151_180,
        ISNULL(v.DM181_360, 0) AS DM181_360,
        ISNULL(v.DM361_MAS, 0) AS DM361_MAS
      FROM VWK_CXPDIASVTO v
    `)

    const total = result.recordset.length
    console.log(`Extraídos ${total} registros de VWK_CXPDIASVTO. Insertando en syn_cxp...`)

    // Truncar syn_cxp para asegurar sincronización 100% limpia de la vista actual
    await pgClient.query('TRUNCATE TABLE syn_cxp')

    await pgClient.query('BEGIN')
    const batchSize = 250
    for (let i = 0; i < total; i += batchSize) {
      const batch = result.recordset.slice(i, i + batchSize)
      const placeholders = []
      const values = []

      batch.forEach((r, idx) => {
        const offset = idx * 34
        const ph = Array.from({ length: 34 }, (_, k) => `$${offset + k + 1}`).join(', ')
        placeholders.push(`(${ph})`)

        values.push(
          r.CNSFCXP,
          r.FECHA || null,
          r.CNSFCOM || null,
          r.IDTERCERO,
          r.NIT,
          r.RAZONSOCIAL,
          r.NOREFERENCIA,
          r.F_FACTURAREF || null,
          r.F_VENCE || null,
          Number(r.VALOR) || 0,
          r.ESTADO,
          r.USUARIO,
          r.TIPOCXP,
          r.PROCEDENCIA,
          r.OBSERVACION,
          Number(r.SALDO) || 0,
          Number(r.VLR_NETO) || 0,
          Number(r.VLR_IVA) || 0,
          Number(r.VLR_IMPUESTOS) || 0,
          Number(r.VLR_ABONOS) || 0,
          Number(r.VLR_NOTASCREDITO) || 0,
          Number(r.VLR_NOTASDEBITO) || 0,
          Number(r.DIASVENCE) || 0,
          Number(r.PORVENCER) || 0,
          Number(r.D0_30) || 0,
          Number(r.D31_60) || 0,
          Number(r.DM0_30) || 0,
          Number(r.DM31_60) || 0,
          Number(r.DM61_90) || 0,
          Number(r.DM91_120) || 0,
          Number(r.DM121_150) || 0,
          Number(r.DM151_180) || 0,
          Number(r.DM181_360) || 0,
          Number(r.DM361_MAS) || 0
        )
      })

      const query = `
        INSERT INTO syn_cxp (
          cnsfcxp, fecha, cnsfcom, idtercero, nit, razon_social, noreferencia, f_facturaref, f_vence,
          valor, estado, usuario, tipocxp, procedencia, observacion, saldo, vlr_neto, vlr_iva,
          vlr_impuestos, vlr_abonos, vlr_notascredito, vlr_notasdebito, dias_vence, por_vencer,
          d0_30, d31_60, dm0_30, dm31_60, dm61_90, dm91_120, dm121_150, dm151_180, dm181_360, dm361_mas
        ) VALUES ${placeholders.join(', ')}
      `
      await pgClient.query(query, values)
    }

    await pgClient.query('COMMIT')

    // 3. Verificación inmediata en PostgreSQL
    const check = await pgClient.query(`
      SELECT 
        COUNT(*) AS total_registros,
        COUNT(*) FILTER (WHERE saldo > 0) AS cuentas_con_saldo,
        COUNT(DISTINCT idtercero) FILTER (WHERE saldo > 0) AS proveedores_con_saldo,
        SUM(saldo) FILTER (WHERE saldo > 0) AS saldo_total_pendiente,
        SUM(por_vencer) FILTER (WHERE saldo > 0) AS por_vencer,
        SUM(dm0_30 + dm31_60 + dm61_90 + dm91_120 + dm121_150 + dm151_180 + dm181_360 + dm361_mas) FILTER (WHERE saldo > 0) AS vencido_total
      FROM syn_cxp
    `)

    console.log('✅ Sincronización exitosa en PostgreSQL (syn_cxp):')
    console.table(check.rows)

  } catch (err) {
    await pgClient.query('ROLLBACK')
    console.error('❌ Error en sincronización de CxP:', err)
  } finally {
    mssql.close()
    pgClient.release()
    await pgPool.end()
  }
}

syncCxp()
