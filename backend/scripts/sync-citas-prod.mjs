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
  requestTimeout: 180000,
}

const pgPool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
})

async function syncCitas() {
  console.log('=== SINCRONIZACIÓN DE CITAS MÉDICAS 2026 (CIT -> syn_citas) ===\n')

  const mssql = await sql.connect(sqlConfig)
  const pgClient = await pgPool.connect()

  try {
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS syn_citas (
        consecutivo VARCHAR(30) PRIMARY KEY,
        fecha DATE,
        fechasol DATE,
        anio INTEGER,
        mes INTEGER,
        idafiliado VARCHAR(30),
        idservicio VARCHAR(30),
        servicio VARCHAR(255),
        idmedico VARCHAR(30),
        medico VARCHAR(255),
        idcontratante VARCHAR(30),
        asegurador VARCHAR(255),
        cumplida INTEGER,
        estado_cita VARCHAR(30),
        pvez INTEGER,
        dias_oportunidad INTEGER,
        valortotal NUMERIC(15,2) DEFAULT 0,
        valorcopago NUMERIC(15,2) DEFAULT 0,
        fecha_sync TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_syn_citas_fecha ON syn_citas (fecha);
      CREATE INDEX IF NOT EXISTS idx_syn_citas_estado ON syn_citas (estado_cita);
      CREATE INDEX IF NOT EXISTS idx_syn_citas_servicio ON syn_citas (servicio);
      CREATE INDEX IF NOT EXISTS idx_syn_citas_medico ON syn_citas (medico);
      CREATE INDEX IF NOT EXISTS idx_syn_citas_asegurador ON syn_citas (asegurador);
    `)

    console.log('Consultando CIT en KESPERANZA (Año 2026)...')
    const res = await mssql.request().query(`
      SELECT 
        c.CONSECUTIVO,
        CONVERT(VARCHAR(10), c.FECHA, 120) AS FECHA,
        CONVERT(VARCHAR(10), c.FECHASOL, 120) AS FECHASOL,
        YEAR(c.FECHA) AS ANIO,
        MONTH(c.FECHA) AS MES,
        c.IDAFILIADO,
        c.IDSERVICIO,
        ISNULL(ser.DESCSERVICIO, 'CONSULTA GENERAL / NO ASIGNADO') AS SERVICIO,
        c.IDMEDICO,
        ISNULL(m.NOMBRE, 'SIN ASIGNAR') AS MEDICO,
        c.IDCONTRATANTE,
        ISNULL(t.RAZONSOCIAL, 'PARTICULAR / OTROS') AS ASEGURADOR,
        ISNULL(c.CUMPLIDA, 0) AS CUMPLIDA,
        CASE 
          WHEN c.CUMPLIDA = 1 THEN 'Cumplida'
          WHEN c.CUMPLIDA = 2 THEN 'Cancelada'
          WHEN c.CUMPLIDA = 3 THEN 'Reasignada'
          WHEN ISNULL(c.CUMPLIDA, 0) = 0 AND c.FECHA < GETDATE() THEN 'Inasistencia'
          ELSE 'Programada'
        END AS ESTADO_CITA,
        ISNULL(c.PVEZ, 0) AS PVEZ,
        CASE 
          WHEN DATEDIFF(day, c.FECHASOL, c.FECHA) BETWEEN 0 AND 180 THEN DATEDIFF(day, c.FECHASOL, c.FECHA)
          ELSE 0 
        END AS DIAS_OPORTUNIDAD,
        ISNULL(c.VALORTOTAL, 0) AS VALORTOTAL,
        ISNULL(c.VALORCOPAGO, 0) AS VALORCOPAGO
      FROM CIT c
      LEFT JOIN SER ser ON ser.IDSERVICIO = c.IDSERVICIO
      LEFT JOIN MED m ON m.IDMEDICO = c.IDMEDICO
      LEFT JOIN TER t ON t.IDTERCERO = c.IDCONTRATANTE
      WHERE YEAR(c.FECHA) = 2026
    `)

    const total = res.recordset.length
    console.log(`Extraídas ${total} citas de CIT. Insertando en syn_citas...`)

    await pgClient.query('TRUNCATE TABLE syn_citas')
    await pgClient.query('BEGIN')

    const batchSize = 500
    for (let i = 0; i < total; i += batchSize) {
      const batch = res.recordset.slice(i, i + batchSize)
      const placeholders = []
      const values = []

      batch.forEach((r, idx) => {
        const offset = idx * 18
        const ph = Array.from({ length: 18 }, (_, k) => `$${offset + k + 1}`).join(', ')
        placeholders.push(`(${ph})`)

        values.push(
          r.CONSECUTIVO,
          r.FECHA || null,
          r.FECHASOL || null,
          r.ANIO || 2026,
          r.MES || 1,
          r.IDAFILIADO,
          r.IDSERVICIO,
          r.SERVICIO,
          r.IDMEDICO,
          r.MEDICO,
          r.IDCONTRATANTE,
          r.ASEGURADOR,
          Number(r.CUMPLIDA) || 0,
          r.ESTADO_CITA,
          Number(r.PVEZ) || 0,
          Number(r.DIAS_OPORTUNIDAD) || 0,
          Number(r.VALORTOTAL) || 0,
          Number(r.VALORCOPAGO) || 0
        )
      })

      const query = `
        INSERT INTO syn_citas (
          consecutivo, fecha, fechasol, anio, mes, idafiliado, idservicio, servicio,
          idmedico, medico, idcontratante, asegurador, cumplida, estado_cita, pvez,
          dias_oportunidad, valortotal, valorcopago
        ) VALUES ${placeholders.join(', ')}
      `
      await pgClient.query(query, values)
    }

    await pgClient.query('COMMIT')

    const check = await pgClient.query(`
      SELECT 
        estado_cita,
        COUNT(*) as total,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM syn_citas), 1) as porcentaje
      FROM syn_citas
      GROUP BY estado_cita
      ORDER BY total DESC
    `)
    console.log('✅ Sincronización exitosa en syn_citas:')
    console.table(check.rows)

  } catch (err) {
    await pgClient.query('ROLLBACK')
    console.error('❌ Error en sincronización de Citas:', err)
  } finally {
    mssql.close()
    pgClient.release()
    await pgPool.end()
  }
}

syncCitas()
