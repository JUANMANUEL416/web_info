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

async function syncAutorizaciones() {
  console.log('=== SINCRONIZACIÓN DE AUTORIZACIONES MÉDICAS 2026 (AUT -> syn_autorizaciones) ===\n')

  const mssql = await sql.connect(sqlConfig)
  const pgClient = await pgPool.connect()

  try {
    // 1. Crear tabla syn_autorizaciones
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS syn_autorizaciones (
        idaut VARCHAR(30) PRIMARY KEY,
        noaut VARCHAR(30),
        fecha DATE,
        fechasol DATE,
        fechavence DATE,
        anio INTEGER,
        mes INTEGER,
        idafiliado VARCHAR(30),
        idplan VARCHAR(30),
        tipoautorizacion VARCHAR(50),
        atencion VARCHAR(50),
        estado VARCHAR(30),
        autorizado SMALLINT DEFAULT 0,
        numautoriza VARCHAR(60),
        tiene_num_autoriza SMALLINT DEFAULT 0,
        idcontratante VARCHAR(30),
        asegurador VARCHAR(180),
        valortotal NUMERIC(18,2) DEFAULT 0,
        valorcopago NUMERIC(18,2) DEFAULT 0,
        facturada SMALLINT DEFAULT 0,
        n_factura VARCHAR(30),
        dxppal VARCHAR(20),
        idservicio_ppal VARCHAR(30),
        servicio_ppal VARCHAR(220),
        dias_tramite INTEGER DEFAULT 0,
        dias_vigencia INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_syn_aut_fecha ON syn_autorizaciones(fecha);
      CREATE INDEX IF NOT EXISTS idx_syn_aut_anio_mes ON syn_autorizaciones(anio, mes);
      CREATE INDEX IF NOT EXISTS idx_syn_aut_contratante ON syn_autorizaciones(idcontratante);
      CREATE INDEX IF NOT EXISTS idx_syn_aut_estado ON syn_autorizaciones(estado);
      CREATE INDEX IF NOT EXISTS idx_syn_aut_facturada ON syn_autorizaciones(facturada);
    `)

    console.log('Tabla syn_autorizaciones verificada en PostgreSQL.')

    // 2. Extraer de KESPERANZA 2026
    console.log('Extrayendo autorizaciones del año 2026 desde KESPERANZA...')
    const query = `
      WITH PrimerServicio AS (
        SELECT 
          d.IDAUT,
          d.IDSERVICIO,
          ROW_NUMBER() OVER(PARTITION BY d.IDAUT ORDER BY d.NO_ITEM ASC) as rn
        FROM AUTD d
      )
      SELECT 
        a.IDAUT,
        COALESCE(a.NOAUT, '') AS NOAUT,
        CAST(a.FECHA AS DATE) AS FECHA,
        CAST(a.FECHASOL AS DATE) AS FECHASOL,
        CAST(a.FECHAVENCE AS DATE) AS FECHAVENCE,
        YEAR(a.FECHA) AS ANIO,
        MONTH(a.FECHA) AS MES,
        COALESCE(a.IDAFILIADO, '') AS IDAFILIADO,
        COALESCE(a.IDPLAN, '') AS IDPLAN,
        COALESCE(a.TIPOAUTORIZACION, 'Ordinaria') AS TIPOAUTORIZACION,
        COALESCE(a.ATENCION, 'Ambulatoria') AS ATENCION,
        COALESCE(a.ESTADO, 'Pendiente') AS ESTADO,
        COALESCE(a.AUTORIZADO, 0) AS AUTORIZADO,
        COALESCE(LTRIM(RTRIM(a.NUMAUTORIZA)), '') AS NUMAUTORIZA,
        CASE WHEN a.NUMAUTORIZA IS NOT NULL AND LTRIM(RTRIM(a.NUMAUTORIZA)) != '' THEN 1 ELSE 0 END AS TIENE_NUM_AUTORIZA,
        COALESCE(a.IDCONTRATANTE, '999999999') AS IDCONTRATANTE,
        COALESCE(t.RAZONSOCIAL, 'PARTICULAR / OTROS') AS ASEGURADOR,
        COALESCE(a.VALORTOTAL, 0) AS VALORTOTAL,
        COALESCE(a.VALORCOPAGO, 0) AS VALORCOPAGO,
        COALESCE(a.FACTURADA, 0) AS FACTURADA,
        COALESCE(a.N_FACTURA, '') AS N_FACTURA,
        COALESCE(a.DXPPAL, '') AS DXPPAL,
        COALESCE(ps.IDSERVICIO, '') AS IDSERVICIO_PPAL,
        COALESCE(s.DESCSERVICIO, ps.IDSERVICIO, 'CONSULTA / PROCEDIMIENTO GENERAL') AS SERVICIO_PPAL,
        CASE 
          WHEN a.FECHASOL IS NOT NULL AND a.FECHA >= a.FECHASOL THEN DATEDIFF(day, a.FECHASOL, a.FECHA)
          ELSE 0 
        END AS DIAS_TRAMITE,
        CASE 
          WHEN a.FECHAVENCE IS NOT NULL AND a.FECHAVENCE >= a.FECHA THEN DATEDIFF(day, a.FECHA, a.FECHAVENCE)
          ELSE 30 
        END AS DIAS_VIGENCIA
      FROM AUT a
      LEFT JOIN TER t ON a.IDCONTRATANTE = t.IDTERCERO
      LEFT JOIN PrimerServicio ps ON a.IDAUT = ps.IDAUT AND ps.rn = 1
      LEFT JOIN SER s ON ps.IDSERVICIO = s.IDSERVICIO
      WHERE a.FECHA >= '2026-01-01' AND a.FECHA <= '2026-12-31 23:59:59'
      ORDER BY a.FECHA ASC
    `

    const result = await mssql.request().query(query)
    const records = result.recordset
    console.log(`Registros obtenidos de KESPERANZA: ${records.length}`)

    // 3. Insertar por lotes en PostgreSQL
    const batchSize = 1000
    let procesados = 0

    await pgClient.query('BEGIN')

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      const values = []
      const placeholders = []

      batch.forEach((r, idx) => {
        const offset = idx * 26
        placeholders.push(`(
          $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5},
          $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10},
          $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15},
          $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20},
          $${offset + 21}, $${offset + 22}, $${offset + 23}, $${offset + 24}, $${offset + 25},
          $${offset + 26}
        )`)

        values.push(
          r.IDAUT,
          r.NOAUT,
          r.FECHA,
          r.FECHASOL,
          r.FECHAVENCE,
          r.ANIO,
          r.MES,
          r.IDAFILIADO,
          r.IDPLAN,
          r.TIPOAUTORIZACION,
          r.ATENCION,
          r.ESTADO,
          r.AUTORIZADO,
          r.NUMAUTORIZA,
          r.TIENE_NUM_AUTORIZA,
          r.IDCONTRATANTE,
          r.ASEGURADOR,
          r.VALORTOTAL,
          r.VALORCOPAGO,
          r.FACTURADA,
          r.N_FACTURA,
          r.DXPPAL,
          r.IDSERVICIO_PPAL,
          r.SERVICIO_PPAL,
          r.DIAS_TRAMITE,
          r.DIAS_VIGENCIA
        )
      })

      const insertSql = `
        INSERT INTO syn_autorizaciones (
          idaut, noaut, fecha, fechasol, fechavence, anio, mes,
          idafiliado, idplan, tipoautorizacion, atencion, estado,
          autorizado, numautoriza, tiene_num_autoriza, idcontratante,
          asegurador, valortotal, valorcopago, facturada, n_factura,
          dxppal, idservicio_ppal, servicio_ppal, dias_tramite, dias_vigencia
        )
        VALUES ${placeholders.join(',\n')}
        ON CONFLICT (idaut) DO UPDATE SET
          noaut = EXCLUDED.noaut,
          fecha = EXCLUDED.fecha,
          fechasol = EXCLUDED.fechasol,
          fechavence = EXCLUDED.fechavence,
          anio = EXCLUDED.anio,
          mes = EXCLUDED.mes,
          idplan = EXCLUDED.idplan,
          tipoautorizacion = EXCLUDED.tipoautorizacion,
          atencion = EXCLUDED.atencion,
          estado = EXCLUDED.estado,
          autorizado = EXCLUDED.autorizado,
          numautoriza = EXCLUDED.numautoriza,
          tiene_num_autoriza = EXCLUDED.tiene_num_autoriza,
          idcontratante = EXCLUDED.idcontratante,
          asegurador = EXCLUDED.asegurador,
          valortotal = EXCLUDED.valortotal,
          valorcopago = EXCLUDED.valorcopago,
          facturada = EXCLUDED.facturada,
          n_factura = EXCLUDED.n_factura,
          dxppal = EXCLUDED.dxppal,
          idservicio_ppal = EXCLUDED.idservicio_ppal,
          servicio_ppal = EXCLUDED.servicio_ppal,
          dias_tramite = EXCLUDED.dias_tramite,
          dias_vigencia = EXCLUDED.dias_vigencia
      `

      await pgClient.query(insertSql, values)
      procesados += batch.length
      process.stdout.write(`\rInsertados/actualizados: ${procesados} / ${records.length}`)
    }

    await pgClient.query('COMMIT')
    console.log('\n\nSincronización completada con éxito!')

    // 4. Verificación rápida
    const verifyRes = await pgClient.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN facturada = 1 THEN 1 END)::int as facturadas,
        COUNT(CASE WHEN facturada = 0 THEN 1 END)::int as sin_facturar,
        COUNT(CASE WHEN tiene_num_autoriza = 1 THEN 1 END)::int as con_num_autoriza,
        COUNT(CASE WHEN estado = 'Anulada' THEN 1 END)::int as anuladas,
        ROUND(SUM(valortotal)::numeric, 0) as valor_total,
        ROUND(SUM(CASE WHEN facturada = 1 THEN valortotal ELSE 0 END)::numeric, 0) as valor_facturado,
        ROUND(SUM(CASE WHEN facturada = 0 AND estado != 'Anulada' THEN valortotal ELSE 0 END)::numeric, 0) as valor_pendiente
      FROM syn_autorizaciones
      WHERE anio = 2026
    `)
    console.log('Métricas syn_autorizaciones 2026:', verifyRes.rows[0])

  } catch (err) {
    await pgClient.query('ROLLBACK')
    console.error('Error durante la sincronización:', err)
  } finally {
    mssql.close()
    pgClient.release()
    await pgPool.end()
  }
}

syncAutorizaciones().catch(console.error)
