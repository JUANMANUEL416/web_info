import { Router } from 'express'
import { pool } from '../config/db.js'
import { getPresupuestoContext } from '../lib/presupuestoContext.js'

export const presupuestosRouter = Router()

presupuestosRouter.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT vp.id, vp.codigo, vp.nombre, vp.estado, vp.es_vigente,
              v.anio, v.id AS vigencia_id, e.razon_social
       FROM version_presupuesto vp
       INNER JOIN vigencia v ON v.id = vp.vigencia_id
       INNER JOIN empresa e ON e.id = v.empresa_id
       ORDER BY v.anio DESC, vp.codigo`,
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

presupuestosRouter.get('/:versionId/contexto', async (req, res) => {
  try {
    const ctx = await getPresupuestoContext(Number(req.params.versionId))
    if (!ctx) return res.status(404).json({ error: 'Presupuesto no encontrado' })
    res.json(ctx)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

presupuestosRouter.get('/:versionId/parametros', async (req, res) => {
  const versionId = Number(req.params.versionId)
  try {
    const { rows: param } = await pool.query(
      `SELECT * FROM parametro_proyeccion WHERE version_id = $1`,
      [versionId],
    )
    const { rows: est } = await pool.query(
      `SELECT numero_mes, indice FROM estacionalidad WHERE version_id = $1 ORDER BY numero_mes`,
      [versionId],
    )
    res.json({ parametros: param[0] || null, estacionalidad: est })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

presupuestosRouter.get('/:versionId/proyeccion', async (req, res) => {
  const versionId = Number(req.params.versionId)
  try {
    const ctx = await getPresupuestoContext(versionId)
    if (!ctx) return res.status(404).json({ error: 'Presupuesto no encontrado' })
    const { rows } = await pool.query(
      `SELECT p.numero_mes, r.codigo AS rubro, r.nombre, r.tipo,
              COALESCE(pi.valor_proyectado, pg.valor_proyectado) AS valor_proyectado,
              pi.origen AS origen_ingreso, pg.origen AS origen_gasto
       FROM periodo p
       INNER JOIN rubro r ON r.vigencia_id = p.vigencia_id
       LEFT JOIN proyeccion_ingreso pi ON pi.periodo_id = p.id AND pi.rubro_id = r.id AND pi.version_id = $1
       LEFT JOIN proyeccion_gasto pg ON pg.periodo_id = p.id AND pg.rubro_id = r.id AND pg.version_id = $1
       WHERE p.vigencia_id = $2 AND (pi.id IS NOT NULL OR pg.id IS NOT NULL)
       ORDER BY p.numero_mes, r.orden`,
      [versionId, ctx.vigencia_id],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

presupuestosRouter.get('/:versionId/historico-referencia', async (req, res) => {
  const versionId = Number(req.params.versionId)
  try {
    const ctx = await getPresupuestoContext(versionId)
    if (!ctx) return res.status(404).json({ error: 'Presupuesto no encontrado' })
    const anioOrigen = ctx.anio - 1
    const { rows } = await pool.query(
      `SELECT hb.numero_mes, r.codigo AS rubro, r.nombre, hb.valor
       FROM historico_base hb
       INNER JOIN rubro r ON r.id = hb.rubro_id
       WHERE r.vigencia_id = $1 AND hb.anio_origen = $2
       ORDER BY hb.numero_mes, r.codigo
       LIMIT 500`,
      [ctx.vigencia_id, anioOrigen],
    )
    res.json({ anio_origen: anioOrigen, descripcion: 'Ventas/gastos reales del año anterior; la proyección parte de estos valores.', filas: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

presupuestosRouter.get('/:versionId/movimientos', async (req, res) => {
  const versionId = Number(req.params.versionId)
  try {
    const { rows } = await pool.query(
      `SELECT mp.id, mp.numero, mp.fecha, mp.estado, tm.nombre AS tipo,
              COUNT(md.id)::int AS lineas,
              COALESCE(SUM(md.valor), 0) AS total_detalle
       FROM movimiento_presupuesto mp
       INNER JOIN tipo_movimiento tm ON tm.id = mp.tipo_movimiento_id
       LEFT JOIN movimiento_detalle md ON md.movimiento_id = mp.id
       WHERE mp.version_id = $1
       GROUP BY mp.id, tm.nombre
       ORDER BY mp.fecha DESC, mp.numero`,
      [versionId],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

presupuestosRouter.get('/:versionId/balance', async (req, res) => {
  const versionId = Number(req.params.versionId)
  try {
    const ctx = await getPresupuestoContext(versionId)
    if (!ctx) return res.status(404).json({ error: 'Presupuesto no encontrado' })
    const { rows } = await pool.query(
      `SELECT p.numero_mes, c.codigo AS cuenta, c.nombre AS cuenta_nombre, bc.saldo_final
       FROM balance_contable bc
       INNER JOIN lote_balance lb ON lb.id = bc.lote_id AND lb.estado = 'cargado'
       INNER JOIN periodo p ON p.id = bc.periodo_id
       INNER JOIN cuenta_contable c ON c.id = bc.cuenta_contable_id
       WHERE p.vigencia_id = $1
       ORDER BY p.numero_mes, c.codigo`,
      [ctx.vigencia_id],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

presupuestosRouter.get('/:versionId/ejecucion', async (req, res) => {
  const versionId = Number(req.params.versionId)
  try {
    const { rows } = await pool.query(
      `SELECT p.numero_mes,
              t.ingresos_proyectados, t.gastos_proyectados,
              t.utilidad_operativa, t.flujo_caja_neto,
              t.ingresos_balance, t.gastos_balance, t.desviacion,
              t.margen_neto_mes, t.margen_neto_acumulado
       FROM v_totalizador_mensual t
       INNER JOIN periodo p ON p.id = t.periodo_id
       WHERE t.version_id = $1
       ORDER BY p.numero_mes`,
      [versionId],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

presupuestosRouter.get('/:versionId/homologacion', async (req, res) => {
  const versionId = Number(req.params.versionId)
  try {
    const ctx = await getPresupuestoContext(versionId)
    if (!ctx) return res.status(404).json({ error: 'Presupuesto no encontrado' })
    const { rows } = await pool.query(
      `SELECT r.codigo AS rubro, r.nombre AS rubro_nombre, r.tipo,
              c.codigo AS cuenta, c.nombre AS cuenta_nombre, rc.porcentaje, rc.id AS rubro_cuenta_id
       FROM rubro r
       LEFT JOIN rubro_cuenta rc ON rc.rubro_id = r.id AND rc.activo = TRUE
       LEFT JOIN cuenta_contable c ON c.id = rc.cuenta_contable_id
       WHERE r.vigencia_id = $1 AND r.es_imputable
       ORDER BY r.orden`,
      [ctx.vigencia_id],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
