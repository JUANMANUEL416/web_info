import { Router } from 'express'
import { pool } from '../config/db.js'

export const presentacionRouter = Router()

presentacionRouter.get('/empresa', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.nit, e.razon_social, e.moneda_codigo,
              u.nombre AS usuario_nombre, u.email AS usuario_email,
              v.anio, v.estado AS vigencia_estado
       FROM empresa e
       LEFT JOIN usuario u ON u.empresa_id = e.id
       LEFT JOIN vigencia v ON v.empresa_id = e.id
       ORDER BY v.anio DESC NULLS LAST, u.id
       LIMIT 1`,
    )
    res.json(rows[0] || null)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
