import pg from 'pg'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'

dotenv.config()

const client = new pg.Client({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
})

const anio = new Date().getFullYear()
const anioOrigen = anio - 1
const pad = (n) => String(n).padStart(2, '0')

function mesFin(anioNum, mes) {
  const d = new Date(anioNum, mes, 0)
  return `${anioNum}-${pad(mes)}-${pad(d.getDate())}`
}

await client.connect()
try {
  await client.query('BEGIN')

  const { rows: empRows } = await client.query(
    `INSERT INTO empresa (nit, razon_social, moneda_codigo)
     VALUES ('900000001', 'Cliente demo pruebas', 'COP')
     ON CONFLICT (nit) DO UPDATE SET razon_social = EXCLUDED.razon_social
     RETURNING id`,
  )
  const empresaId = empRows[0].id

  const seedPassword = process.env.SEED_PASSWORD
  if (!seedPassword) {
    throw new Error('Defina SEED_PASSWORD en el entorno. No deje claves en el repositorio.')
  }
  const passwordHash = bcrypt.hashSync(seedPassword, 10)
  const { rows: usrRows } = await client.query(
    `INSERT INTO usuario (empresa_id, nombre, email, password_hash)
     VALUES ($1, 'Administrador pruebas', 'admin@viewinfo.local', $2)
     ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id`,
    [empresaId, passwordHash],
  )
  const usuarioId = usrRows[0].id

  const { rows: vigRows } = await client.query(
    `INSERT INTO vigencia (empresa_id, anio, fecha_inicio, fecha_fin, estado)
     VALUES ($1, $2, $3, $4, 'abierta')
     ON CONFLICT (empresa_id, anio) DO UPDATE SET estado = 'abierta'
     RETURNING id`,
    [empresaId, anio, `${anio}-01-01`, `${anio}-12-31`],
  )
  const vigenciaId = vigRows[0].id

  const periodoIds = {}
  for (let m = 1; m <= 12; m++) {
    const { rows } = await client.query(
      `INSERT INTO periodo (vigencia_id, numero_mes, nombre, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (vigencia_id, numero_mes) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING id, numero_mes`,
      [vigenciaId, m, `Mes ${m}`, `${anio}-${pad(m)}-01`, mesFin(anio, m)],
    )
    periodoIds[m] = rows[0].id
  }

  const cuentas = [
    ['4105', 'Ingresos operacionales', 'credito'],
    ['4295', 'Ingresos no operacionales', 'credito'],
    ['5105', 'Costo de ventas', 'debito'],
    ['5205', 'Comisiones', 'debito'],
    ['6105', 'Nómina administrativa', 'debito'],
    ['6110', 'Arrendamientos', 'debito'],
    ['6120', 'Servicios públicos', 'debito'],
    ['6130', 'Seguros', 'debito'],
  ]
  const cuentaIds = {}
  for (const [codigo, nombre, naturaleza] of cuentas) {
    const { rows } = await client.query(
      `INSERT INTO cuenta_contable (empresa_id, codigo, nombre, naturaleza, es_imputable)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (empresa_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING id`,
      [empresaId, codigo, nombre, naturaleza],
    )
    cuentaIds[codigo] = rows[0].id
  }

  const rubrosDef = [
    ['ING-OP', 'Ventas operativas', 'ingreso_operativo', '4105'],
    ['ING-NO', 'Ingresos no operativos', 'ingreso_no_operativo', '4295'],
    ['COST-V', 'Costo de producción / venta', 'costo_variable', '5105'],
    ['COM', 'Comisiones comerciales', 'comision', '5205'],
    ['GF-NOM', 'Nómina administrativa', 'gasto_fijo', '6105'],
    ['GF-ARR', 'Alquileres', 'gasto_fijo', '6110'],
    ['GF-SERV', 'Servicios públicos', 'gasto_fijo', '6120'],
    ['GF-SEG', 'Seguros', 'gasto_fijo', '6130'],
    ['CONT', 'Contingencias (5% fijos)', 'contingencia', '6105'],
  ]
  const rubroIds = {}
  let orden = 10
  for (const [codigo, nombre, tipo, cuentaCodigo] of rubrosDef) {
    const { rows } = await client.query(
      `INSERT INTO rubro (empresa_id, vigencia_id, codigo, nombre, tipo, orden, es_imputable)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (vigencia_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo
       RETURNING id`,
      [empresaId, vigenciaId, codigo, nombre, tipo, orden],
    )
    orden += 10
    rubroIds[codigo] = rows[0].id
    await client.query(
      `INSERT INTO rubro_cuenta (rubro_id, cuenta_contable_id, porcentaje)
       VALUES ($1, $2, 100)
       ON CONFLICT (rubro_id, cuenta_contable_id) DO NOTHING`,
      [rows[0].id, cuentaIds[cuentaCodigo]],
    )
  }

  const ventasBase = [
    82000000, 78000000, 85000000, 88000000, 91000000, 89000000,
    87000000, 90000000, 93000000, 96000000, 102000000, 118000000,
  ]
  const fijosMensual = { 'GF-NOM': 12000000, 'GF-ARR': 3500000, 'GF-SERV': 800000, 'GF-SEG': 450000 }

  for (let m = 1; m <= 12; m++) {
    const venta = ventasBase[m - 1]
    await client.query(
      `INSERT INTO historico_base (empresa_id, anio_origen, numero_mes, rubro_id, valor)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (empresa_id, anio_origen, numero_mes, rubro_id) DO UPDATE SET valor = EXCLUDED.valor`,
      [empresaId, anioOrigen, m, rubroIds['ING-OP'], venta],
    )
    await client.query(
      `INSERT INTO historico_base (empresa_id, anio_origen, numero_mes, rubro_id, valor)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (empresa_id, anio_origen, numero_mes, rubro_id) DO UPDATE SET valor = EXCLUDED.valor`,
      [empresaId, anioOrigen, m, rubroIds['ING-NO'], 500000],
    )
    for (const [cod, val] of Object.entries(fijosMensual)) {
      await client.query(
        `INSERT INTO historico_base (empresa_id, anio_origen, numero_mes, rubro_id, valor)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (empresa_id, anio_origen, numero_mes, rubro_id) DO UPDATE SET valor = EXCLUDED.valor`,
        [empresaId, anioOrigen, m, rubroIds[cod], val],
      )
    }
  }

  const { rows: verRows } = await client.query(
    `INSERT INTO version_presupuesto (vigencia_id, codigo, nombre, estado, es_vigente)
     VALUES ($1, 'V1', 'Proyección inicial pruebas', 'borrador', TRUE)
     ON CONFLICT (vigencia_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id`,
    [vigenciaId],
  )
  const versionId = verRows[0].id

  const tasa = 0.08
  await client.query(
    `INSERT INTO parametro_proyeccion (version_id, tasa_crecimiento_anual, pct_costo_sobre_ingreso, pct_comision_sobre_ingreso, pct_contingencia_sobre_fijos)
     VALUES ($1, $2, 0.45, 0.05, 0.05)
     ON CONFLICT (version_id) DO UPDATE SET tasa_crecimiento_anual = EXCLUDED.tasa_crecimiento_anual`,
    [versionId, tasa],
  )

  const indices = [0.95, 0.92, 0.98, 1.0, 1.02, 1.0, 0.98, 1.0, 1.03, 1.05, 1.08, 1.15]
  for (let m = 1; m <= 12; m++) {
    await client.query(
      `INSERT INTO estacionalidad (version_id, numero_mes, indice)
       VALUES ($1, $2, $3)
       ON CONFLICT (version_id, numero_mes) DO UPDATE SET indice = EXCLUDED.indice`,
      [versionId, m, indices[m - 1]],
    )
  }

  for (let m = 1; m <= 12; m++) {
    const periodoId = periodoIds[m]
    const ventaBase = ventasBase[m - 1]
    const indice = indices[m - 1]
    const ventaProy = Math.round(ventaBase * (1 + tasa) * indice)
    await client.query(
      `INSERT INTO proyeccion_ingreso (version_id, periodo_id, rubro_id, venta_base, indice_estacional, tasa_crecimiento, valor_proyectado, origen)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'formula')
       ON CONFLICT (version_id, periodo_id, rubro_id) DO UPDATE SET valor_proyectado = EXCLUDED.valor_proyectado`,
      [versionId, periodoId, rubroIds['ING-OP'], ventaBase, indice, tasa, ventaProy],
    )
    await client.query(
      `INSERT INTO proyeccion_ingreso (version_id, periodo_id, rubro_id, venta_base, indice_estacional, tasa_crecimiento, valor_proyectado, origen)
       VALUES ($1, $2, $3, 500000, 1, $4, $5, 'formula')
       ON CONFLICT (version_id, periodo_id, rubro_id) DO UPDATE SET valor_proyectado = EXCLUDED.valor_proyectado`,
      [versionId, periodoId, rubroIds['ING-NO'], tasa, Math.round(500000 * (1 + tasa))],
    )

    const costo = Math.round(ventaProy * 0.45)
    const comision = Math.round(ventaProy * 0.05)
    await client.query(
      `INSERT INTO proyeccion_gasto (version_id, periodo_id, rubro_id, tipo_calculo, base_calculo, porcentaje, valor_proyectado, origen)
       VALUES ($1, $2, $3, 'porcentaje_ingreso', $4, 0.45, $5, 'formula')
       ON CONFLICT (version_id, periodo_id, rubro_id) DO UPDATE SET valor_proyectado = EXCLUDED.valor_proyectado`,
      [versionId, periodoId, rubroIds['COST-V'], ventaProy, costo],
    )
    await client.query(
      `INSERT INTO proyeccion_gasto (version_id, periodo_id, rubro_id, tipo_calculo, base_calculo, porcentaje, valor_proyectado, origen)
       VALUES ($1, $2, $3, 'porcentaje_ingreso', $4, 0.05, $5, 'formula')
       ON CONFLICT (version_id, periodo_id, rubro_id) DO UPDATE SET valor_proyectado = EXCLUDED.valor_proyectado`,
      [versionId, periodoId, rubroIds['COM'], ventaProy, comision],
    )

    let sumaFijos = 0
    for (const [cod, val] of Object.entries(fijosMensual)) {
      sumaFijos += val
      await client.query(
        `INSERT INTO proyeccion_gasto (version_id, periodo_id, rubro_id, tipo_calculo, base_calculo, porcentaje, valor_proyectado, origen)
         VALUES ($1, $2, $3, 'valor_fijo', $4, 0, $4, 'formula')
         ON CONFLICT (version_id, periodo_id, rubro_id) DO UPDATE SET valor_proyectado = EXCLUDED.valor_proyectado`,
        [versionId, periodoId, rubroIds[cod], val],
      )
    }
    const contingencia = Math.round(sumaFijos * 0.05)
    await client.query(
      `INSERT INTO proyeccion_gasto (version_id, periodo_id, rubro_id, tipo_calculo, base_calculo, porcentaje, valor_proyectado, origen)
       VALUES ($1, $2, $3, 'contingencia', $4, 0.05, $5, 'formula')
       ON CONFLICT (version_id, periodo_id, rubro_id) DO UPDATE SET valor_proyectado = EXCLUDED.valor_proyectado`,
      [versionId, periodoId, rubroIds['CONT'], sumaFijos, contingencia],
    )
  }

  const { rows: tipoIni } = await client.query(
    `SELECT id FROM tipo_movimiento WHERE codigo = 'inicial'`,
  )
  const tipoInicialId = tipoIni[0].id

  const { rows: movExist } = await client.query(
    `SELECT id FROM movimiento_presupuesto WHERE empresa_id = $1 AND numero = 'INI-V1-PRU'`,
    [empresaId],
  )
  let movId = movExist[0]?.id
  if (!movId) {
    const { rows: movRows } = await client.query(
      `INSERT INTO movimiento_presupuesto (empresa_id, vigencia_id, version_id, tipo_movimiento_id, numero, fecha, descripcion, estado, usuario_id, aprobado_por, aprobado_en)
       SELECT $1, $2, $3, $4, 'INI-V1-PRU', CURRENT_DATE, 'Presupuesto inicial desde proyección (semilla)', 'aprobado', $5, $5, NOW()
       WHERE NOT EXISTS (SELECT 1 FROM movimiento_presupuesto WHERE empresa_id = $1 AND numero = 'INI-V1-PRU')
       RETURNING id`,
      [empresaId, vigenciaId, versionId, tipoInicialId, usuarioId],
    )
    movId = movRows[0]?.id
  }

  if (movId) {
    await client.query(`DELETE FROM movimiento_detalle WHERE movimiento_id = $1`, [movId])
    for (let m = 1; m <= 12; m++) {
      const periodoId = periodoIds[m]
      for (const cod of Object.keys(rubroIds)) {
        const { rows: pi } = await client.query(
          `SELECT valor_proyectado FROM proyeccion_ingreso WHERE version_id = $1 AND periodo_id = $2 AND rubro_id = $3`,
          [versionId, periodoId, rubroIds[cod]],
        )
        const { rows: pg } = await client.query(
          `SELECT valor_proyectado FROM proyeccion_gasto WHERE version_id = $1 AND periodo_id = $2 AND rubro_id = $3`,
          [versionId, periodoId, rubroIds[cod]],
        )
        const valor = Number(pi[0]?.valor_proyectado || pg[0]?.valor_proyectado || 0)
        if (valor <= 0) continue
        await client.query(
          `INSERT INTO movimiento_detalle (movimiento_id, rubro_id, periodo_id, naturaleza_traslado, valor)
           VALUES ($1, $2, $3, 'nula', $4)`,
          [movId, rubroIds[cod], periodoId, valor],
        )
      }
    }
  }

  const periodo1 = periodoIds[1]
  const { rows: loteExist } = await client.query(
    `SELECT id FROM lote_balance WHERE empresa_id = $1 AND periodo_id = $2 AND estado = 'cargado'`,
    [empresaId, periodo1],
  )
  if (!loteExist.length) {
    const { rows: loteRows } = await client.query(
      `INSERT INTO lote_balance (empresa_id, periodo_id, nombre_archivo, usuario_id, estado)
       VALUES ($1, $2, 'semilla-mes-1.csv', $3, 'cargado')
       RETURNING id`,
      [empresaId, periodo1, usuarioId],
    )
    const loteId = loteRows[0].id
    const { rows: proy1 } = await client.query(
      `SELECT rc.cuenta_contable_id,
              SUM(COALESCE(pi.valor_proyectado, pg.valor_proyectado, 0)) AS valor
       FROM rubro r
       LEFT JOIN proyeccion_ingreso pi ON pi.rubro_id = r.id AND pi.periodo_id = $1 AND pi.version_id = $2
       LEFT JOIN proyeccion_gasto pg ON pg.rubro_id = r.id AND pg.periodo_id = $1 AND pg.version_id = $2
       INNER JOIN rubro_cuenta rc ON rc.rubro_id = r.id AND rc.activo
       WHERE r.vigencia_id = $3 AND r.es_imputable
       GROUP BY rc.cuenta_contable_id`,
      [periodo1, versionId, vigenciaId],
    )
    for (const row of proy1) {
      const v = Number(row.valor)
      if (v === 0) continue
      await client.query(
        `INSERT INTO balance_contable (lote_id, periodo_id, cuenta_contable_id, saldo_final)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (lote_id, cuenta_contable_id, centro_costo_id) DO UPDATE SET saldo_final = EXCLUDED.saldo_final`,
        [loteId, periodo1, row.cuenta_contable_id, Math.round(v * 0.97)],
      )
    }
  }

  await client.query('COMMIT')
  console.log(`Seed completo — vigencia ${anio}, versión V1, histórico ${anioOrigen}, movimiento inicial y balance mes 1`)
} catch (e) {
  await client.query('ROLLBACK')
  throw e
} finally {
  await client.end()
}
