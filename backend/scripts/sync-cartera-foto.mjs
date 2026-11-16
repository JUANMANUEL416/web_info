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

export async function sincronizarCarteraFoto(fechaCorte = new Date().toISOString().slice(0, 10)) {
  console.log(`\n[SYNC CARTERA] Extrayendo foto de cartera al corte: ${fechaCorte}...`)
  const mssql = await sql.connect(sqlConfig)
  const pgClient = await pgPool.connect()

  try {
    const query = `
      SELECT 
        v.N_FACTURA,
        v.CNSCXC,
        v.ITEM,
        v.TIPO,
        v.IDTERCERO,
        v.SALDONETO,
        v.SALDOINICIAL,
        v.DIASVENCE,
        v.PORVENCER,
        v.D0_30,
        v.D31_60,
        v.D61_90,
        v.D91_120,
        v.D121_150,
        v.D151_180,
        v.D181_360,
        v.D361_MAS,
        v.RAD,
        v.REGIMEN,
        v.TIPOTTEC
      FROM VWK_CXCDIASVTO v
      WHERE v.CLASEINFO = 'SINGLO'
    `
    const result = await mssql.request().query(query)
    const total = result.recordset.length
    console.log(`Extracción exitosa: ${total} registros en cartera activa. Guardando en PostgreSQL...`)

    await pgClient.query('BEGIN')
    await pgClient.query('DELETE FROM syn_cartera_foto WHERE fecha_corte = $1', [fechaCorte])

    const batchSize = 1000
    for (let i = 0; i < total; i += batchSize) {
      const batch = result.recordset.slice(i, i + batchSize)
      const values = []
      const placeholders = []

      batch.forEach((row, idx) => {
        const offset = idx * 21
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20}, $${offset + 21})`)
        values.push(
          fechaCorte,
          row.N_FACTURA,
          row.CNSCXC,
          Number(row.ITEM) || 0,
          row.TIPO || 'F',
          row.IDTERCERO,
          Number(row.SALDONETO) || 0,
          Number(row.SALDOINICIAL) || 0,
          Number(row.DIASVENCE) || 0,
          Number(row.PORVENCER) || 0,
          Number(row.D0_30) || 0,
          Number(row.D31_60) || 0,
          Number(row.D61_90) || 0,
          Number(row.D91_120) || 0,
          Number(row.D121_150) || 0,
          Number(row.D151_180) || 0,
          Number(row.D181_360) || 0,
          Number(row.D361_MAS) || 0,
          row.RAD || 'NO',
          row.REGIMEN || null,
          row.TIPOTTEC || null
        )
      })

      const insertSql = `
        INSERT INTO syn_cartera_foto (
          fecha_corte, n_factura, cnscxc, item, tipo, idtercero, saldo_neto, saldo_inicial,
          dias_vence, por_vencer, d0_30, d31_60, d61_90, d91_120, d121_150,
          d151_180, d181_360, d361_mas, radicada, regimen, tipottec
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (fecha_corte, n_factura, cnscxc, item) DO UPDATE SET
          saldo_neto = EXCLUDED.saldo_neto,
          dias_vence = EXCLUDED.dias_vence,
          fecha_sync = NOW()
      `
      await pgClient.query(insertSql, values)
    }

    await pgClient.query('COMMIT')
    console.log(`✓ Sincronización exitosa: ${total} registros copiados en syn_cartera_foto.`)
  } catch (err) {
    await pgClient.query('ROLLBACK')
    console.error('Error sincronizando cartera foto:', err)
    throw err
  } finally {
    pgClient.release()
    await mssql.close()
  }
}

if (process.argv[1]?.endsWith('sync-cartera-foto.mjs')) {
  sincronizarCarteraFoto()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
