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

export async function sincronizarCicloCompleto(diasAtras = 60) {
  console.log(`\n======================================================`)
  console.log(`[SYNC CICLO DE CARTERA] Iniciando sincronización incremental (últimos ${diasAtras} días)...`)
  console.log(`======================================================\n`)

  const mssql = await sql.connect(sqlConfig)
  const pgClient = await pgPool.connect()

  try {
    // 1. FACTURAS (FTR) -> usa F_FACTURA
    console.log(`1/4. Extrayendo Facturación reciente...`)
    const ftrRes = await mssql.request().query(`
      SELECT 
        f.N_FACTURA,
        f.IDTERCERO,
        ISNULL(t.RAZONSOCIAL, '') AS RAZONSOCIAL,
        ISNULL(t.NIT, '') AS NIT,
        CONVERT(VARCHAR(10), f.F_FACTURA, 120) AS FECHA,
        CONVERT(VARCHAR(10), f.F_VENCE, 120) AS F_VENCE,
        f.VR_TOTAL,
        f.ESTADO,
        ISNULL(f.FACTE, 0) AS FACTE,
        f.CUFE,
        f.PROCEDENCIA,
        f.IDPLAN
      FROM FTR f
      LEFT JOIN TER t ON t.IDTERCERO = f.IDTERCERO
      WHERE f.F_FACTURA >= DATEADD(day, -${diasAtras}, GETDATE())
    `)
    console.log(`   -> ${ftrRes.recordset.length} facturas obtenidas. Guardando en PostgreSQL...`)

    for (const r of ftrRes.recordset) {
      await pgClient.query(`
        INSERT INTO syn_factura (
          n_factura, idtercero, razon_social, nit, fecha, f_vence, valor_total, estado, facte, cufe, procedencia, idplan
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (n_factura) DO UPDATE SET
          estado = EXCLUDED.estado,
          facte = EXCLUDED.facte,
          cufe = EXCLUDED.cufe,
          fecha_sync = NOW()
      `, [r.N_FACTURA, r.IDTERCERO, r.RAZONSOCIAL, r.NIT, r.FECHA, r.F_VENCE, r.VR_TOTAL || 0, r.ESTADO || 'O', r.FACTE, r.CUFE, r.PROCEDENCIA, r.IDPLAN])
    }

    // 2. NOTAS CRÉDITO (FNOT) -> usa F_NOTA
    console.log(`2/4. Extrayendo Notas Crédito recientes...`)
    const ncRes = await mssql.request().query(`
      SELECT 
        fn.CNSFNOT,
        fn.CLASE,
        fn.N_FACTURA,
        fn.IDTERCERO,
        CONVERT(VARCHAR(10), fn.F_NOTA, 120) AS FECHA,
        fn.VR_TOTAL,
        fn.PROCEDENCIA,
        fn.CONCEPTO AS MOTIVO,
        fn.OBSERVACION,
        fn.ESTADO,
        fn.CERRADA,
        CASE WHEN f.ESTADO = 'A' THEN 1 ELSE 0 END AS ANULA_FACTURA
      FROM FNOT fn
      LEFT JOIN FTR f ON f.N_FACTURA = fn.N_FACTURA
      WHERE fn.F_NOTA >= DATEADD(day, -${diasAtras}, GETDATE())
    `)
    console.log(`   -> ${ncRes.recordset.length} notas obtenidas. Guardando...`)

    for (const r of ncRes.recordset) {
      await pgClient.query(`
        INSERT INTO syn_nota_credito (
          cnsfnot, clase, n_factura, idtercero, fecha, vr_total, procedencia, motivo, observacion, estado, cerrada, anula_factura
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (cnsfnot) DO UPDATE SET
          estado = EXCLUDED.estado,
          cerrada = EXCLUDED.cerrada,
          anula_factura = EXCLUDED.anula_factura,
          fecha_sync = NOW()
      `, [r.CNSFNOT, r.CLASE, r.N_FACTURA, r.IDTERCERO, r.FECHA, r.VR_TOTAL || 0, r.PROCEDENCIA, r.MOTIVO, r.OBSERVACION, r.ESTADO, r.CERRADA, Boolean(r.ANULA_FACTURA)])
    }

    // 3. CUENTAS DE COBRO Y RADICACIONES (FCXC y FCXCD) -> usa FECHACXC, F_RECIBIDO, QUIENRECIBIO
    console.log(`3/4. Extrayendo Cuentas de Cobro y Radicación...`)
    const cxcRes = await mssql.request().query(`
      SELECT 
        c.CNSCXC,
        d.N_FACTURA,
        c.IDTERCERO,
        CONVERT(VARCHAR(10), c.FECHACXC, 120) AS FECHA_CXC,
        c.CERRADA,
        ISNULL(c.INDRECIBIDO, 0) AS RADICADA,
        CONVERT(VARCHAR(10), c.F_RECIBIDO, 120) AS F_RADICADO,
        c.NOREFERENCIAEXT AS NUM_RADICADO,
        c.QUIENRECIBIO AS QUIENRECIBE,
        d.VALORFACTURA
      FROM FCXC c
      INNER JOIN FCXCD d ON d.CNSCXC = c.CNSCXC
      WHERE c.FECHACXC >= DATEADD(day, -${diasAtras}, GETDATE()) OR c.INDRECIBIDO = 1
    `)
    console.log(`   -> ${cxcRes.recordset.length} detalles de CXC obtenidos. Guardando...`)

    for (const r of cxcRes.recordset) {
      await pgClient.query(`
        INSERT INTO syn_cuenta_cobro (
          cnscxc, n_factura, idtercero, fecha_cxc, cerrada, radicada, f_radicado, num_radicado, quien_recibe, valor_factura
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (cnscxc, n_factura) DO UPDATE SET
          cerrada = EXCLUDED.cerrada,
          radicada = EXCLUDED.radicada,
          f_radicado = EXCLUDED.f_radicado,
          num_radicado = EXCLUDED.num_radicado,
          quien_recibe = EXCLUDED.quien_recibe,
          fecha_sync = NOW()
      `, [r.CNSCXC, r.N_FACTURA, r.IDTERCERO, r.FECHA_CXC, r.CERRADA, Boolean(r.RADICADA), r.F_RADICADO, r.NUM_RADICADO, r.QUIENRECIBE, r.VALORFACTURA || 0])
    }

    // 4. RECAUDOS (FPAG y FPAGD) -> usa FECHAPAGO
    console.log(`4/4. Extrayendo Recaudos y Pagos...`)
    const pagRes = await mssql.request().query(`
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
        pd.ESTADO,
        pd.CERRADO
      FROM FPAG p
      INNER JOIN FPAGD pd ON pd.CNSFPAG = p.CNSFPAG
      WHERE p.FECHAPAGO >= DATEADD(day, -${diasAtras}, GETDATE())
    `)
    console.log(`   -> ${pagRes.recordset.length} aplicaciones de pago obtenidas. Guardando...`)

    for (const r of pagRes.recordset) {
      await pgClient.query(`
        INSERT INTO syn_recaudo (
          cnsfpag, n_factura, cnscxc, idtercero, fecha_creacion, fecha_confirmacion, origen_pago,
          valor_pago, valor_impuestos, valor_descuento, estado, cerrado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [r.CNSFPAG, r.N_FACTURA, r.CNSCXC, r.IDTERCERO, r.FECHA_CREACION, r.FECHA_CONFIRMACION, r.ORIGEN_PAGO, r.VALORPAGO || 0, r.VALOR_IMPUESTOS || 0, r.VALOR_DESCUENTO || 0, r.ESTADO, r.CERRADO])
    }

    console.log('\n✓ Sincronización del ciclo de cartera completada con éxito.')
  } catch (err) {
    console.error('Error durante la sincronización del ciclo:', err)
  } finally {
    pgClient.release()
    await mssql.close()
  }
}

if (process.argv[1]?.endsWith('sync-ciclo-cartera.mjs')) {
  sincronizarCicloCompleto(45)
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
