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

async function syncFcxp() {
  console.log('=== SINCRONIZACIÓN DE OBLIGACIONES CXP HISTÓRICAS 2025-2026 (FCXP -> syn_fcxp) ===\n')

  const mssql = await sql.connect(sqlConfig)
  const pgClient = await pgPool.connect()

  try {
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS syn_fcxp (
        cnsfcxp VARCHAR(20) PRIMARY KEY,
        fecha DATE,
        anio INTEGER,
        mes INTEGER,
        idtercero VARCHAR(20),
        nit VARCHAR(50),
        razon_social VARCHAR(255),
        noreferencia VARCHAR(50),
        f_facturaref DATE,
        f_vence DATE,
        valor NUMERIC(15,2) DEFAULT 0,
        saldo NUMERIC(15,2) DEFAULT 0,
        estado VARCHAR(10),
        procedencia VARCHAR(50),
        vlr_neto NUMERIC(15,2) DEFAULT 0,
        vlr_abonos NUMERIC(15,2) DEFAULT 0,
        usuario VARCHAR(50),
        fecha_sync TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_syn_fcxp_fecha ON syn_fcxp (fecha);
      CREATE INDEX IF NOT EXISTS idx_syn_fcxp_anio_mes ON syn_fcxp (anio, mes);
      CREATE INDEX IF NOT EXISTS idx_syn_fcxp_procedencia ON syn_fcxp (procedencia);
      CREATE INDEX IF NOT EXISTS idx_syn_fcxp_estado ON syn_fcxp (estado);
    `)

    console.log('Consultando FCXP en KESPERANZA (2025-2026)...')
    const res = await mssql.request().query(`
      SELECT 
        f.CNSFCXP,
        CONVERT(VARCHAR(10), f.FECHA, 120) AS FECHA,
        YEAR(f.FECHA) AS ANIO,
        MONTH(f.FECHA) AS MES,
        f.IDTERCERO,
        ISNULL(t.NIT, '') AS NIT,
        ISNULL(t.RAZONSOCIAL, f.IDTERCERO) AS RAZONSOCIAL,
        ISNULL(f.NOREFERENCIA, '') AS NOREFERENCIA,
        CONVERT(VARCHAR(10), f.F_FACTURAREF, 120) AS F_FACTURAREF,
        CONVERT(VARCHAR(10), f.F_VENCE, 120) AS F_VENCE,
        ISNULL(f.VALOR, 0) AS VALOR,
        ISNULL(f.SALDO, 0) AS SALDO,
        f.ESTADO,
        ISNULL(f.PROCEDENCIA, 'Sin Definir') AS PROCEDENCIA,
        ISNULL(f.VLR_NETO, 0) AS VLR_NETO,
        ISNULL(f.VLR_ABONOS, 0) AS VLR_ABONOS,
        f.USUARIO
      FROM FCXP f
      LEFT JOIN TER t ON t.IDTERCERO = f.IDTERCERO
      WHERE YEAR(f.FECHA) >= 2025 AND f.ESTADO <> 'A'
    `)

    const total = res.recordset.length
    console.log(`Extraídas ${total} obligaciones de FCXP. Insertando en syn_fcxp...`)

    await pgClient.query('TRUNCATE TABLE syn_fcxp')
    await pgClient.query('BEGIN')

    const batchSize = 500
    for (let i = 0; i < total; i += batchSize) {
      const batch = res.recordset.slice(i, i + batchSize)
      const placeholders = []
      const values = []

      batch.forEach((r, idx) => {
        const offset = idx * 17
        const ph = Array.from({ length: 17 }, (_, k) => `$${offset + k + 1}`).join(', ')
        placeholders.push(`(${ph})`)

        values.push(
          r.CNSFCXP,
          r.FECHA || null,
          r.ANIO || null,
          r.MES || null,
          r.IDTERCERO,
          r.NIT,
          r.RAZONSOCIAL,
          r.NOREFERENCIA,
          r.F_FACTURAREF || null,
          r.F_VENCE || null,
          Number(r.VALOR) || 0,
          Number(r.SALDO) || 0,
          r.ESTADO,
          r.PROCEDENCIA,
          Number(r.VLR_NETO) || 0,
          Number(r.VLR_ABONOS) || 0,
          r.USUARIO
        )
      })

      const query = `
        INSERT INTO syn_fcxp (
          cnsfcxp, fecha, anio, mes, idtercero, nit, razon_social, noreferencia,
          f_facturaref, f_vence, valor, saldo, estado, procedencia, vlr_neto, vlr_abonos, usuario
        ) VALUES ${placeholders.join(', ')}
      `
      await pgClient.query(query, values)
    }

    await pgClient.query('COMMIT')

    const check = await pgClient.query(`
      SELECT 
        anio,
        COUNT(*) as total_obligaciones,
        SUM(valor) as valor_total,
        SUM(saldo) as saldo_total
      FROM syn_fcxp
      GROUP BY anio
      ORDER BY anio DESC
    `)
    console.log('✅ Sincronización exitosa en syn_fcxp:')
    console.table(check.rows)

  } catch (err) {
    await pgClient.query('ROLLBACK')
    console.error('❌ Error en sincronización de FCXP:', err)
  } finally {
    mssql.close()
    pgClient.release()
    await pgPool.end()
  }
}

syncFcxp()
