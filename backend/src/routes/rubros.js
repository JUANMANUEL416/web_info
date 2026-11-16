import { Router } from 'express'
import { pool } from '../config/db.js'
import { getPresupuestoContext } from '../lib/presupuestoContext.js'

export const rubrosRouter = Router()

rubrosRouter.get('/', async (req, res) => {
  const versionId = Number(req.query.version_id)
  if (!versionId) return res.status(400).json({ error: 'Falta version_id' })
  try {
    const ctx = await getPresupuestoContext(versionId)
    if (!ctx) return res.status(404).json({ error: 'Presupuesto no encontrado' })
    const { rows } = await pool.query(
      `SELECT r.id, r.codigo, r.nombre, r.tipo, r.orden, r.activo,
              rc.id AS rubro_cuenta_id, rc.cuenta_contable_id, rc.porcentaje,
              c.codigo AS cuenta_codigo, c.nombre AS cuenta_nombre
       FROM rubro r
       LEFT JOIN rubro_cuenta rc ON rc.rubro_id = r.id AND rc.activo = TRUE
       LEFT JOIN cuenta_contable c ON c.id = rc.cuenta_contable_id
       WHERE r.vigencia_id = $1
       ORDER BY r.orden, r.codigo`,
      [ctx.vigencia_id],
    )
    res.json({ presupuesto: ctx, rubros: rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

rubrosRouter.get('/cuentas', async (req, res) => {
  const versionId = Number(req.query.version_id)
  if (!versionId) return res.status(400).json({ error: 'Falta version_id' })
  try {
    const ctx = await getPresupuestoContext(versionId)
    if (!ctx) return res.status(404).json({ error: 'Presupuesto no encontrado' })
    const { rows } = await pool.query(
      `SELECT id, codigo, nombre, naturaleza FROM cuenta_contable
       WHERE empresa_id = $1 AND activo AND es_imputable
       ORDER BY codigo`,
      [ctx.empresa_id],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

rubrosRouter.put('/:id/homologacion', async (req, res) => {
  const rubroId = Number(req.params.id)
  const { cuenta_contable_id, porcentaje = 100 } = req.body
  if (!cuenta_contable_id) {
    return res.status(400).json({ error: 'Falta cuenta_contable_id' })
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE rubro_cuenta SET activo = FALSE WHERE rubro_id = $1`,
      [rubroId],
    )
    await client.query(
      `INSERT INTO rubro_cuenta (rubro_id, cuenta_contable_id, porcentaje, activo)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (rubro_id, cuenta_contable_id)
       DO UPDATE SET porcentaje = EXCLUDED.porcentaje, activo = TRUE`,
      [rubroId, cuenta_contable_id, porcentaje],
    )
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})
