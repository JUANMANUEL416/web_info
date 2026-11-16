import { pool } from '../config/db.js'

export async function getPresupuestoContext(versionId) {
  const { rows } = await pool.query(
    `SELECT vp.id AS version_id, vp.codigo, vp.nombre, vp.estado, vp.es_vigente,
            v.id AS vigencia_id, v.anio, v.estado AS vigencia_estado,
            e.id AS empresa_id, e.razon_social, e.moneda_codigo
     FROM version_presupuesto vp
     INNER JOIN vigencia v ON v.id = vp.vigencia_id
     INNER JOIN empresa e ON e.id = v.empresa_id
     WHERE vp.id = $1`,
    [versionId],
  )
  return rows[0] || null
}

export function requireVersionId(req, res) {
  const id = Number(req.query.version_id || req.params.versionId)
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: 'Falta version_id (presupuesto activo)' })
    return null
  }
  return id
}
