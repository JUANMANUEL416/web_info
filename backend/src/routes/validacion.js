import { Router } from 'express'
import { pool } from '../config/db.js'

export const validacionRouter = Router()

const PASOS = [
  { orden: 1, codigo: 'vigencia', nombre: 'Vigencia y periodos', ruta: '/paso/1-vigencia' },
  { orden: 2, codigo: 'rubros', nombre: 'Rubros presupuestales', ruta: '/paso/2-rubros' },
  { orden: 3, codigo: 'homologacion', nombre: 'Homologación rubro–cuenta', ruta: '/paso/3-homologacion' },
  { orden: 4, codigo: 'historico', nombre: 'Histórico base', ruta: '/paso/4-historico' },
  { orden: 5, codigo: 'parametros', nombre: 'Parámetros y estacionalidad', ruta: '/paso/5-parametros' },
  { orden: 6, codigo: 'proyeccion', nombre: 'Proyección ingresos y gastos', ruta: '/paso/6-proyeccion' },
  { orden: 7, codigo: 'movimientos', nombre: 'Presupuesto vigente (movimientos)', ruta: '/paso/7-movimientos' },
  { orden: 8, codigo: 'balance', nombre: 'Balance contable', ruta: '/paso/8-balance' },
  { orden: 9, codigo: 'ejecucion', nombre: 'Ejecución y totalizador', ruta: '/paso/9-ejecucion' },
]

async function vigenciaActiva() {
  const { rows } = await pool.query(
    `SELECT v.id, v.anio, vp.id AS version_id
     FROM vigencia v
     LEFT JOIN version_presupuesto vp ON vp.vigencia_id = v.id AND vp.es_vigente = TRUE
     WHERE v.estado = 'abierta'
     ORDER BY v.anio DESC
     LIMIT 1`,
  )
  return rows[0] || null
}

async function evaluarPaso(codigo, ctx) {
  const { vigenciaId, versionId, anio } = ctx
  switch (codigo) {
    case 'vigencia': {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM periodo WHERE vigencia_id = $1`,
        [vigenciaId],
      )
      const ok = rows[0].n === 12
      return { ok, detalle: `${rows[0].n}/12 periodos`, total: rows[0].n }
    }
    case 'rubros': {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM rubro WHERE vigencia_id = $1 AND activo`,
        [vigenciaId],
      )
      return { ok: rows[0].n >= 5, detalle: `${rows[0].n} rubros`, total: rows[0].n }
    }
    case 'homologacion': {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM rubro_cuenta rc
         INNER JOIN rubro r ON r.id = rc.rubro_id
         WHERE r.vigencia_id = $1 AND rc.activo`,
        [vigenciaId],
      )
      return { ok: rows[0].n >= 5, detalle: `${rows[0].n} vínculos`, total: rows[0].n }
    }
    case 'historico': {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM historico_base hb
         INNER JOIN rubro r ON r.id = hb.rubro_id
         WHERE r.vigencia_id = $1 AND hb.anio_origen = $2`,
        [vigenciaId, anio - 1],
      )
      return { ok: rows[0].n >= 12, detalle: `${rows[0].n} registros históricos`, total: rows[0].n }
    }
    case 'parametros': {
      if (!versionId) return { ok: false, detalle: 'Sin versión vigente', total: 0 }
      const { rows: p } = await pool.query(
        `SELECT 1 FROM parametro_proyeccion WHERE version_id = $1`,
        [versionId],
      )
      const { rows: e } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM estacionalidad WHERE version_id = $1`,
        [versionId],
      )
      const ok = p.length > 0 && e[0].n === 12
      return { ok, detalle: `Parámetros + ${e[0].n}/12 meses estacionalidad`, total: e[0].n }
    }
    case 'proyeccion': {
      if (!versionId) return { ok: false, detalle: 'Sin versión', total: 0 }
      const { rows } = await pool.query(
        `SELECT
          (SELECT COUNT(*) FROM proyeccion_ingreso WHERE version_id = $1) +
          (SELECT COUNT(*) FROM proyeccion_gasto WHERE version_id = $1) AS n`,
        [versionId],
      )
      const ok = Number(rows[0].n) >= 24
      return { ok, detalle: `${rows[0].n} líneas de proyección`, total: Number(rows[0].n) }
    }
    case 'movimientos': {
      if (!versionId) return { ok: false, detalle: 'Sin versión', total: 0 }
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM movimiento_presupuesto
         WHERE version_id = $1 AND estado = 'aprobado'`,
        [versionId],
      )
      return { ok: rows[0].n >= 1, detalle: `${rows[0].n} movimiento(s) aprobado(s)`, total: rows[0].n }
    }
    case 'balance': {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM lote_balance lb
         INNER JOIN periodo p ON p.id = lb.periodo_id
         WHERE p.vigencia_id = $1 AND lb.estado = 'cargado'`,
        [vigenciaId],
      )
      return { ok: rows[0].n >= 1, detalle: `${rows[0].n} lote(s) de balance`, total: rows[0].n }
    }
    case 'ejecucion': {
      if (!versionId) return { ok: false, detalle: 'Sin versión', total: 0 }
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM v_totalizador_mensual WHERE version_id = $1`,
        [versionId],
      )
      return { ok: rows[0].n === 12, detalle: `${rows[0].n}/12 meses en totalizador`, total: rows[0].n }
    }
    default:
      return { ok: false, detalle: 'Paso desconocido', total: 0 }
  }
}

validacionRouter.get('/flujo', async (_req, res) => {
  try {
    const vig = await vigenciaActiva()
    if (!vig) {
      return res.json({ ok: false, pasos: PASOS.map((p) => ({ ...p, ok: false, detalle: 'Sin vigencia' })) })
    }
    const ctx = { vigenciaId: vig.id, versionId: vig.version_id, anio: vig.anio }
    const pasos = []
    for (const paso of PASOS) {
      const ev = await evaluarPaso(paso.codigo, ctx)
      pasos.push({ ...paso, ...ev })
    }
    const completados = pasos.filter((p) => p.ok).length
    res.json({
      ok: completados === pasos.length,
      vigencia: vig,
      completados,
      totalPasos: pasos.length,
      pasos,
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

validacionRouter.get('/paso/:codigo', async (req, res) => {
  try {
    const vig = await vigenciaActiva()
    if (!vig) return res.status(404).json({ error: 'Sin vigencia activa' })
    const paso = PASOS.find((p) => p.codigo === req.params.codigo)
    if (!paso) return res.status(404).json({ error: 'Paso no encontrado' })
    const ctx = { vigenciaId: vig.id, versionId: vig.version_id, anio: vig.anio }
    const ev = await evaluarPaso(paso.codigo, ctx)
    let datos = []
    switch (paso.codigo) {
      case 'vigencia':
        datos = (
          await pool.query(
            `SELECT numero_mes, nombre, fecha_inicio, fecha_fin, estado FROM periodo WHERE vigencia_id = $1 ORDER BY numero_mes`,
            [vig.id],
          )
        ).rows
        break
      case 'rubros':
        datos = (
          await pool.query(
            `SELECT codigo, nombre, tipo, orden FROM rubro WHERE vigencia_id = $1 ORDER BY orden`,
            [vig.id],
          )
        ).rows
        break
      case 'homologacion':
        datos = (
          await pool.query(
            `SELECT r.codigo AS rubro, c.codigo AS cuenta, rc.porcentaje
             FROM rubro_cuenta rc
             INNER JOIN rubro r ON r.id = rc.rubro_id
             INNER JOIN cuenta_contable c ON c.id = rc.cuenta_contable_id
             WHERE r.vigencia_id = $1 ORDER BY r.codigo`,
            [vig.id],
          )
        ).rows
        break
      case 'historico':
        datos = (
          await pool.query(
            `SELECT hb.numero_mes, r.codigo AS rubro, hb.valor
             FROM historico_base hb
             INNER JOIN rubro r ON r.id = hb.rubro_id
             WHERE r.vigencia_id = $1 AND hb.anio_origen = $2
             ORDER BY hb.numero_mes, r.codigo
             LIMIT 200`,
            [vig.id, vig.anio - 1],
          )
        ).rows
        break
      case 'parametros':
        datos = (
          await pool.query(
            `SELECT pp.tasa_crecimiento_anual, pp.pct_costo_sobre_ingreso, pp.pct_comision_sobre_ingreso,
                    pp.pct_contingencia_sobre_fijos, e.numero_mes, e.indice
             FROM parametro_proyeccion pp
             LEFT JOIN estacionalidad e ON e.version_id = pp.version_id
             WHERE pp.version_id = $1
             ORDER BY e.numero_mes NULLS FIRST`,
            [vig.version_id],
          )
        ).rows
        break
      case 'proyeccion':
        datos = (
          await pool.query(
            `SELECT p.numero_mes, r.codigo AS rubro, r.tipo,
                    COALESCE(pi.valor_proyectado, pg.valor_proyectado) AS valor
             FROM periodo p
             CROSS JOIN rubro r
             LEFT JOIN proyeccion_ingreso pi ON pi.periodo_id = p.id AND pi.rubro_id = r.id AND pi.version_id = $2
             LEFT JOIN proyeccion_gasto pg ON pg.periodo_id = p.id AND pg.rubro_id = r.id AND pg.version_id = $2
             WHERE p.vigencia_id = $1 AND r.vigencia_id = $1
               AND (pi.id IS NOT NULL OR pg.id IS NOT NULL)
             ORDER BY p.numero_mes, r.orden
             LIMIT 300`,
            [vig.id, vig.version_id],
          )
        ).rows
        break
      case 'movimientos':
        datos = (
          await pool.query(
            `SELECT mp.numero, tm.nombre AS tipo, mp.estado, COUNT(md.id)::int AS lineas
             FROM movimiento_presupuesto mp
             INNER JOIN tipo_movimiento tm ON tm.id = mp.tipo_movimiento_id
             LEFT JOIN movimiento_detalle md ON md.movimiento_id = mp.id
             WHERE mp.version_id = $1
             GROUP BY mp.id, tm.nombre
             ORDER BY mp.numero`,
            [vig.version_id],
          )
        ).rows
        break
      case 'balance':
        datos = (
          await pool.query(
            `SELECT p.numero_mes, c.codigo AS cuenta, bc.saldo_final
             FROM balance_contable bc
             INNER JOIN lote_balance lb ON lb.id = bc.lote_id AND lb.estado = 'cargado'
             INNER JOIN periodo p ON p.id = bc.periodo_id
             INNER JOIN cuenta_contable c ON c.id = bc.cuenta_contable_id
             WHERE p.vigencia_id = $1
             ORDER BY p.numero_mes, c.codigo`,
            [vig.id],
          )
        ).rows
        break
      case 'ejecucion':
        datos = (
          await pool.query(
            `SELECT p.numero_mes, t.utilidad_operativa, t.flujo_caja_neto, t.margen_neto_mes
             FROM v_totalizador_mensual t
             INNER JOIN periodo p ON p.id = t.periodo_id
             WHERE t.version_id = $1
             ORDER BY p.numero_mes`,
            [vig.version_id],
          )
        ).rows
        break
      default:
        break
    }
    res.json({ paso: { ...paso, ...ev }, vigencia: vig, datos })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
