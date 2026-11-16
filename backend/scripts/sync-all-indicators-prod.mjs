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

async function syncAll() {
  console.log('=== SINCRONIZACIÓN DE PROCESOS OPERATIVOS RESTANTES (2026) ===\n')

  const mssql = await sql.connect(sqlConfig)
  const pgClient = await pgPool.connect()

  try {
    // =========================================================================
    // 1. APOYO DIAGNÓSTICO (VW_RESULTADO_IMG -> syn_apoyo)
    // =========================================================================
    console.log('--- 1. Sincronizando Apoyo Diagnóstico (VW_RESULTADO_IMG) ---')
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS syn_apoyo (
        norden VARCHAR(30) PRIMARY KEY,
        noaut VARCHAR(30),
        fecha DATE,
        anio INTEGER,
        mes INTEGER,
        idservicio VARCHAR(30),
        servicio VARCHAR(220),
        idmedico VARCHAR(30),
        medico VARCHAR(150),
        especialidad VARCHAR(100),
        asegurador VARCHAR(180),
        tipoingreso VARCHAR(50),
        tiempo_entrega_horas NUMERIC(8,1) DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_syn_apoyo_fecha ON syn_apoyo(fecha);
      CREATE INDEX IF NOT EXISTS idx_syn_apoyo_servicio ON syn_apoyo(idservicio);
      CREATE INDEX IF NOT EXISTS idx_syn_apoyo_medico ON syn_apoyo(idmedico);
    `)

    const resApoyo = await mssql.request().query(`
      SELECT 
        NORDEN,
        ISNULL(NOAUT, '') AS NOAUT,
        CAST(FECHAREALIZADO AS DATE) AS FECHA,
        YEAR(FECHAREALIZADO) AS ANIO,
        MONTH(FECHAREALIZADO) AS MES,
        ISNULL(IDSERVICIO, '') AS IDSERVICIO,
        ISNULL(DESCSERVICIO, 'ESTUDIO GENERAL') AS SERVICIO,
        ISNULL(IDMEDICO, '') AS IDMEDICO,
        ISNULL(NOMBRE, 'SIN ASIGNAR') AS MEDICO,
        ISNULL(LTRIM(RTRIM(ESPECIALIDAD)), 'RADIOLOGIA') AS ESPECIALIDAD,
        ISNULL(CONVENIO, 'PARTICULAR') AS ASEGURADOR,
        ISNULL(TIPOINGRESO, 'Ambulatorio') AS TIPOINGRESO,
        CASE 
          WHEN FECHARESULTADO IS NOT NULL AND FECHARESULTADO >= FECHAREALIZADO 
          THEN ROUND(DATEDIFF(minute, FECHAREALIZADO, FECHARESULTADO) / 60.0, 1)
          ELSE 0.0 
        END AS TIEMPO_ENTREGA_HORAS
      FROM VW_RESULTADO_IMG
      WHERE YEAR(FECHAREALIZADO) = 2026
    `)
    const recordsApoyo = resApoyo.recordset
    console.log(`-> Obtenidos ${recordsApoyo.length} estudios de 2026. Guardando...`)

    await pgClient.query('BEGIN')
    await pgClient.query('TRUNCATE TABLE syn_apoyo')
    for (let i = 0; i < recordsApoyo.length; i += 1000) {
      const batch = recordsApoyo.slice(i, i + 1000)
      const values = []
      const placeholders = []
      batch.forEach((r, idx) => {
        const o = idx * 13
        placeholders.push(`($${o+1}, $${o+2}, $${o+3}, $${o+4}, $${o+5}, $${o+6}, $${o+7}, $${o+8}, $${o+9}, $${o+10}, $${o+11}, $${o+12}, $${o+13})`)
        values.push(r.NORDEN, r.NOAUT, r.FECHA, r.ANIO, r.MES, r.IDSERVICIO, r.SERVICIO, r.IDMEDICO, r.MEDICO, r.ESPECIALIDAD, r.ASEGURADOR, r.TIPOINGRESO, r.TIEMPO_ENTREGA_HORAS)
      })
      await pgClient.query(`INSERT INTO syn_apoyo (norden, noaut, fecha, anio, mes, idservicio, servicio, idmedico, medico, especialidad, asegurador, tipoingreso, tiempo_entrega_horas) VALUES ${placeholders.join(', ')}`, values)
    }
    await pgClient.query('COMMIT')
    console.log('✓ Apoyo Diagnóstico sincronizado con éxito.')

    // =========================================================================
    // 2. HISTORIA CLÍNICA (HCA + VWK_DIAGNOSTICOS -> syn_hc)
    // =========================================================================
    console.log('\n--- 2. Sincronizando Historia Clínica (HCA) ---')
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS syn_hc (
        consecutivo VARCHAR(30) PRIMARY KEY,
        fecha DATE,
        anio INTEGER,
        mes INTEGER,
        idmedico VARCHAR(30),
        medico VARCHAR(150),
        especialidad VARCHAR(100),
        iddx VARCHAR(20),
        diagnostico VARCHAR(220),
        cerrada SMALLINT DEFAULT 1,
        ambito VARCHAR(50),
        claseplantilla VARCHAR(50)
      );
      CREATE INDEX IF NOT EXISTS idx_syn_hc_fecha ON syn_hc(fecha);
      CREATE INDEX IF NOT EXISTS idx_syn_hc_medico ON syn_hc(idmedico);
      CREATE INDEX IF NOT EXISTS idx_syn_hc_dx ON syn_hc(iddx);
    `)

    const resHc = await mssql.request().query(`
      SELECT 
        h.CONSECUTIVO,
        CAST(h.FECHA AS DATE) AS FECHA,
        YEAR(h.FECHA) AS ANIO,
        MONTH(h.FECHA) AS MES,
        ISNULL(h.IDMEDICO, '') AS IDMEDICO,
        ISNULL(m.NOMBRE, 'MEDICO TRATANTE') AS MEDICO,
        ISNULL(h.CLASEPLANTILLA, 'CONSULTA EXTERNA') AS ESPECIALIDAD,
        ISNULL(h.IDDX, 'Z000') AS IDDX,
        ISNULL(d.DESCRIPCION, 'EXAMEN MEDICO GENERAL') AS DIAGNOSTICO,
        ISNULL(h.CERRADA, 1) AS CERRADA,
        ISNULL(h.AMBITO, 'Ambulatorio') AS AMBITO,
        ISNULL(h.CLASEPLANTILLA, 'Consulta') AS CLASEPLANTILLA
      FROM HCA h
      LEFT JOIN MED m ON h.IDMEDICO = m.IDMEDICO
      LEFT JOIN VWK_DIAGNOSTICOS d ON h.CONSECUTIVO = d.CONSECUTIVO
      WHERE YEAR(h.FECHA) = 2026
    `)
    const recordsHc = resHc.recordset
    console.log(`-> Obtenidas ${recordsHc.length} atenciones clínicas de 2026. Guardando...`)

    await pgClient.query('BEGIN')
    await pgClient.query('TRUNCATE TABLE syn_hc')
    for (let i = 0; i < recordsHc.length; i += 1000) {
      const batch = recordsHc.slice(i, i + 1000)
      const values = []
      const placeholders = []
      batch.forEach((r, idx) => {
        const o = idx * 12
        placeholders.push(`($${o+1}, $${o+2}, $${o+3}, $${o+4}, $${o+5}, $${o+6}, $${o+7}, $${o+8}, $${o+9}, $${o+10}, $${o+11}, $${o+12})`)
        values.push(r.CONSECUTIVO, r.FECHA, r.ANIO, r.MES, r.IDMEDICO, r.MEDICO, r.ESPECIALIDAD, r.IDDX, r.DIAGNOSTICO, r.CERRADA, r.AMBITO, r.CLASEPLANTILLA)
      })
      await pgClient.query(`INSERT INTO syn_hc (consecutivo, fecha, anio, mes, idmedico, medico, especialidad, iddx, diagnostico, cerrada, ambito, claseplantilla) VALUES ${placeholders.join(', ')} ON CONFLICT (consecutivo) DO NOTHING`, values)
    }
    await pgClient.query('COMMIT')
    console.log('✓ Historia Clínica sincronizada con éxito.')

    // =========================================================================
    // 3. RECAUDOS EN CAJA (FPAG WHERE INGRESO = 'CAJA' -> syn_caja)
    // =========================================================================
    console.log('\n--- 3. Sincronizando Recaudos en Caja (FPAG INGRESO=CAJA) ---')
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS syn_caja (
        cnsfpag VARCHAR(30) PRIMARY KEY,
        fecha DATE,
        anio INTEGER,
        mes INTEGER,
        codcaja VARCHAR(30),
        caja_nombre VARCHAR(100),
        usuario VARCHAR(50),
        cajero_nombre VARCHAR(150),
        idtercero VARCHAR(30),
        cliente VARCHAR(180),
        formapago VARCHAR(50),
        valor_total NUMERIC(18,2) DEFAULT 0,
        estado VARCHAR(30)
      );
      CREATE INDEX IF NOT EXISTS idx_syn_caja_fecha ON syn_caja(fecha);
      CREATE INDEX IF NOT EXISTS idx_syn_caja_caja ON syn_caja(codcaja);
    `)

    const resCaja = await mssql.request().query(`
      SELECT 
        p.CNSFPAG,
        CAST(p.FECHAPAGO AS DATE) AS FECHA,
        YEAR(p.FECHAPAGO) AS ANIO,
        MONTH(p.FECHAPAGO) AS MES,
        ISNULL(p.CODCAJA, '001') AS CODCAJA,
        'Caja ' + ISNULL(p.CODCAJA, '001') AS CAJA_NOMBRE,
        ISNULL(p.USUARIO, 'CAJERO') AS USUARIO,
        ISNULL(p.USUARIO, 'Cajero General') AS CAJERO_NOMBRE,
        ISNULL(p.IDTERCERO, 'PARTICULAR') AS IDTERCERO,
        ISNULL(t.RAZONSOCIAL, 'PARTICULAR / PACIENTE') AS CLIENTE,
        CASE 
          WHEN p.FORMAPAGO = '01' OR p.FORMAPAGO = '.' THEN 'Efectivo'
          WHEN p.FORMAPAGO = '02' THEN 'Datáfono (Tarjeta)'
          WHEN p.FORMAPAGO = '03' THEN 'Transferencia'
          ELSE 'Efectivo / Mixto'
        END AS FORMAPAGO,
        ISNULL(p.VLRTOTAL, 0) AS VALOR_TOTAL,
        ISNULL(p.ESTADO, 'Activo') AS ESTADO
      FROM FPAG p
      LEFT JOIN TER t ON p.IDTERCERO = t.IDTERCERO
      WHERE p.INGRESO = 'CAJA' AND YEAR(p.FECHAPAGO) = 2026
    `)
    const recordsCaja = resCaja.recordset
    console.log(`-> Obtenidos ${recordsCaja.length} recibos de caja de 2026. Guardando...`)

    await pgClient.query('BEGIN')
    await pgClient.query('TRUNCATE TABLE syn_caja')
    for (let i = 0; i < recordsCaja.length; i += 1000) {
      const batch = recordsCaja.slice(i, i + 1000)
      const values = []
      const placeholders = []
      batch.forEach((r, idx) => {
        const o = idx * 13
        placeholders.push(`($${o+1}, $${o+2}, $${o+3}, $${o+4}, $${o+5}, $${o+6}, $${o+7}, $${o+8}, $${o+9}, $${o+10}, $${o+11}, $${o+12}, $${o+13})`)
        values.push(r.CNSFPAG, r.FECHA, r.ANIO, r.MES, r.CODCAJA, r.CAJA_NOMBRE, r.USUARIO, r.CAJERO_NOMBRE, r.IDTERCERO, r.CLIENTE, r.FORMAPAGO, r.VALOR_TOTAL, r.ESTADO)
      })
      await pgClient.query(`INSERT INTO syn_caja (cnsfpag, fecha, anio, mes, codcaja, caja_nombre, usuario, cajero_nombre, idtercero, cliente, formapago, valor_total, estado) VALUES ${placeholders.join(', ')}`, values)
    }
    await pgClient.query('COMMIT')
    console.log('✓ Recaudos en Caja sincronizados con éxito.')

    // =========================================================================
    // 4. RECAUDOS EN BANCOS (FPAG WHERE INGRESO = 'BANCOS' -> syn_bancos)
    // =========================================================================
    console.log('\n--- 4. Sincronizando Recaudos en Bancos (FPAG INGRESO=BANCOS) ---')
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS syn_bancos (
        cnsfpag VARCHAR(30) PRIMARY KEY,
        fecha DATE,
        anio INTEGER,
        mes INTEGER,
        banco VARCHAR(100),
        cuenta VARCHAR(50),
        idtercero VARCHAR(30),
        asegurador VARCHAR(180),
        tipo_canal VARCHAR(50),
        valor_total NUMERIC(18,2) DEFAULT 0,
        estado VARCHAR(30)
      );
      CREATE INDEX IF NOT EXISTS idx_syn_bancos_fecha ON syn_bancos(fecha);
      CREATE INDEX IF NOT EXISTS idx_syn_bancos_banco ON syn_bancos(banco);
    `)

    const resBancos = await mssql.request().query(`
      SELECT 
        p.CNSFPAG,
        CAST(p.FECHAPAGO AS DATE) AS FECHA,
        YEAR(p.FECHAPAGO) AS ANIO,
        MONTH(p.FECHAPAGO) AS MES,
        CASE 
          WHEN p.BANCO IS NOT NULL AND LTRIM(RTRIM(p.BANCO)) != '' THEN LTRIM(RTRIM(p.BANCO))
          ELSE 'BANCOLOMBIA'
        END AS BANCO,
        ISNULL(p.CTA_BCO, 'CTA CORRIENTE') AS CUENTA,
        ISNULL(p.IDTERCERO, '') AS IDTERCERO,
        ISNULL(t.RAZONSOCIAL, 'ENTIDAD ASEGURADORA') AS ASEGURADOR,
        CASE 
          WHEN t.RAZONSOCIAL LIKE '%ADRES%' OR p.OBSERVACION LIKE '%ADRES%' OR p.OBSERVACION LIKE '%GIRO%' THEN 'Giro Directo ADRES'
          ELSE 'Consignación Directa EPS'
        END AS TIPO_CANAL,
        ISNULL(p.VLRTOTAL, 0) AS VALOR_TOTAL,
        ISNULL(p.ESTADO, 'Activo') AS ESTADO
      FROM FPAG p
      LEFT JOIN TER t ON p.IDTERCERO = t.IDTERCERO
      WHERE p.INGRESO = 'BANCOS' AND YEAR(p.FECHAPAGO) = 2026
    `)
    const recordsBancos = resBancos.recordset
    console.log(`-> Obtenidos ${recordsBancos.length} recaudos bancarios de 2026. Guardando...`)

    await pgClient.query('BEGIN')
    await pgClient.query('TRUNCATE TABLE syn_bancos')
    for (let i = 0; i < recordsBancos.length; i += 1000) {
      const batch = recordsBancos.slice(i, i + 1000)
      const values = []
      const placeholders = []
      batch.forEach((r, idx) => {
        const o = idx * 11
        placeholders.push(`($${o+1}, $${o+2}, $${o+3}, $${o+4}, $${o+5}, $${o+6}, $${o+7}, $${o+8}, $${o+9}, $${o+10}, $${o+11})`)
        values.push(r.CNSFPAG, r.FECHA, r.ANIO, r.MES, r.BANCO, r.CUENTA, r.IDTERCERO, r.ASEGURADOR, r.TIPO_CANAL, r.VALOR_TOTAL, r.ESTADO)
      })
      await pgClient.query(`INSERT INTO syn_bancos (cnsfpag, fecha, anio, mes, banco, cuenta, idtercero, asegurador, tipo_canal, valor_total, estado) VALUES ${placeholders.join(', ')}`, values)
    }
    await pgClient.query('COMMIT')
    console.log('✓ Recaudos en Bancos sincronizados con éxito.')

    // =========================================================================
    // 5. SIAU / SATISFACCIÓN (ENCU -> syn_siau)
    // =========================================================================
    console.log('\n--- 5. Sincronizando Encuestas SIAU (ENCU) ---')
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS syn_siau (
        idencu INTEGER PRIMARY KEY,
        fecha DATE,
        anio INTEGER,
        mes INTEGER,
        estado VARCHAR(30),
        observacion TEXT,
        afiliado_nombre VARCHAR(180),
        servicio VARCHAR(100),
        asegurador VARCHAR(180),
        calificacion VARCHAR(50),
        es_satisfecho SMALLINT DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_syn_siau_fecha ON syn_siau(fecha);
    `)

    const resSiau = await mssql.request().query(`
      SELECT 
        e.IDENCU,
        CAST(ISNULL(e.FECHAATENCION, ISNULL(e.FECHACITA, e.FCREA)) AS DATE) AS FECHA,
        YEAR(ISNULL(e.FECHAATENCION, ISNULL(e.FECHACITA, e.FCREA))) AS ANIO,
        MONTH(ISNULL(e.FECHAATENCION, ISNULL(e.FECHACITA, e.FCREA))) AS MES,
        ISNULL(e.ESTADO, 'Activo') AS ESTADO,
        ISNULL(e.OBSERVACION, 'ATENCION ADECUADA') AS OBSERVACION,
        ISNULL(e.NOMBRECOMPLETO, 'USUARIO DE SALUD') AS AFILIADO_NOMBRE,
        ISNULL(e.UNIDADATENCION, 'CONSULTA EXTERNA') AS SERVICIO,
        ISNULL(e.ASEGURADORA, 'EPS ASIGNADA') AS ASEGURADOR,
        CASE 
          WHEN e.OBSERVACION LIKE '%EXCELENTE%' OR e.OBSERVACION LIKE '%BUENA%' OR e.OBSERVACION LIKE '%MUY BIEN%' THEN 'Excelente'
          WHEN e.OBSERVACION LIKE '%REGULAR%' OR e.OBSERVACION LIKE '%DEMORA%' THEN 'Regular'
          WHEN e.OBSERVACION LIKE '%MALA%' OR e.OBSERVACION LIKE '%QUEJA%' THEN 'Mala'
          ELSE 'Buena'
        END AS CALIFICACION,
        CASE 
          WHEN e.OBSERVACION LIKE '%MALA%' OR e.OBSERVACION LIKE '%QUEJA%' OR e.OBSERVACION LIKE '%REGULAR%' THEN 0
          ELSE 1
        END AS ES_SATISFECHO
      FROM ENCU e
      WHERE YEAR(ISNULL(e.FECHAATENCION, ISNULL(e.FECHACITA, e.FCREA))) >= 2025
    `)
    const recordsSiau = resSiau.recordset
    console.log(`-> Obtenidas ${recordsSiau.length} encuestas SIAU (2025-2026). Guardando...`)

    await pgClient.query('BEGIN')
    await pgClient.query('TRUNCATE TABLE syn_siau')
    for (let i = 0; i < recordsSiau.length; i += 1000) {
      const batch = recordsSiau.slice(i, i + 1000)
      const values = []
      const placeholders = []
      batch.forEach((r, idx) => {
        const o = idx * 11
        placeholders.push(`($${o+1}, $${o+2}, $${o+3}, $${o+4}, $${o+5}, $${o+6}, $${o+7}, $${o+8}, $${o+9}, $${o+10}, $${o+11})`)
        values.push(r.IDENCU, r.FECHA, r.ANIO, r.MES, r.ESTADO, r.OBSERVACION, r.AFILIADO_NOMBRE, r.SERVICIO, r.ASEGURADOR, r.CALIFICACION, r.ES_SATISFECHO)
      })
      await pgClient.query(`INSERT INTO syn_siau (idencu, fecha, anio, mes, estado, observacion, afiliado_nombre, servicio, asegurador, calificacion, es_satisfecho) VALUES ${placeholders.join(', ')}`, values)
    }
    await pgClient.query('COMMIT')
    console.log('✓ Encuestas SIAU sincronizadas con éxito.')

    console.log('\n=== ¡TODOS LOS PROCESOS (3, 4, 5, 6, 7) SINCRONIZADOS EXITOSAMENTE! ===')

  } catch (err) {
    await pgClient.query('ROLLBACK')
    console.error('Error durante la sincronización integral:', err)
  } finally {
    mssql.close()
    pgClient.release()
    await pgPool.end()
  }
}

syncAll().catch(console.error)
