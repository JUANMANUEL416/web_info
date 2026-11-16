import { Router } from 'express'
import { pool } from '../config/db.js'

export const facturacionRouter = Router()

// 1. Resumen Ejecutivo (Gerente & Jefe de Área)
facturacionRouter.get('/resumen', async (req, res) => {
  const anio = Number(req.query.anio) || 2026
  try {
    const { rows: kpis } = await pool.query(`
      SELECT 
        COUNT(*) AS total_facturas,
        SUM(valor_total) AS total_facturado,
        COUNT(CASE WHEN estado = 'A' THEN 1 END) AS facturas_anuladas,
        COALESCE(SUM(CASE WHEN estado = 'A' THEN valor_total ELSE 0 END), 0) AS valor_anulado,
        COUNT(CASE WHEN facte = 2 THEN 1 END) AS facturas_dian_aprobadas,
        COUNT(CASE WHEN facte = 0 THEN 1 END) AS facturas_dian_pendientes,
        COUNT(DISTINCT idtercero) AS total_clientes
      FROM syn_factura
      WHERE EXTRACT(YEAR FROM fecha) = $1
    `, [anio])

    // Total de notas crédito del año
    const { rows: nc } = await pool.query(`
      SELECT 
        COUNT(*) AS total_notas,
        COALESCE(SUM(vr_total), 0) AS total_notas_credito
      FROM syn_nota_credito
      WHERE EXTRACT(YEAR FROM fecha) = $1 AND clase = 'C'
    `, [anio])

    res.json({
      anio,
      ...kpis[0],
      ...nc[0],
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 2. Facturación Mensual Histórica (Tendencia)
facturacionRouter.get('/tendencia-mensual', async (req, res) => {
  const anio = Number(req.query.anio) || 2026
  try {
    const { rows } = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM fecha)::int AS mes,
        COUNT(*) AS facturas,
        SUM(valor_total) AS facturado
      FROM syn_factura
      WHERE EXTRACT(YEAR FROM fecha) = $1 AND estado <> 'A'
      GROUP BY EXTRACT(MONTH FROM fecha)
      ORDER BY mes
    `, [anio])

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 3. Distribución por Procedencia (Consulta Externa, Citas, Financiero, etc.)
facturacionRouter.get('/por-procedencia', async (req, res) => {
  const anio = Number(req.query.anio) || 2026
  try {
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(procedencia, 'SIN DEFINIR') AS procedencia,
        COUNT(*) AS cantidad,
        SUM(valor_total) AS total
      FROM syn_factura
      WHERE EXTRACT(YEAR FROM fecha) = $1 AND estado <> 'A'
      GROUP BY procedencia
      ORDER BY total DESC
    `, [anio])

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 4. Productividad por Facturador (Para Coordinador de Facturación)
facturacionRouter.get('/productividad-facturadores', async (req, res) => {
  const anio = Number(req.query.anio) || 2026
  try {
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(usuario_nombre, usuario_factura, 'Sin Asignar') AS operador,
        COUNT(*) AS facturas_emitidas,
        SUM(valor_total) AS total_facturado,
        ROUND(AVG(valor_total), 0) AS ticket_promedio
      FROM syn_factura
      WHERE EXTRACT(YEAR FROM fecha) = $1 AND estado <> 'A'
      GROUP BY usuario_nombre, usuario_factura
      ORDER BY facturas_emitidas DESC
      LIMIT 15
    `, [anio])

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 4.1 Facturación detallada por Usuario (Ranking & Rendimiento: Semana, Mes, Año)
facturacionRouter.get('/por-usuario', async (req, res) => {
  const anio = Number(req.query.anio) || 2026
  const periodo = String(req.query.periodo || 'semana').toLowerCase()
  try {
    const refRes = await pool.query("SELECT MAX(fecha) as max_fecha FROM syn_factura WHERE estado <> 'A'")
    const maxFecha = refRes.rows[0]?.max_fecha || new Date()

    let whereClause = ''
    let queryParams = []

    if (periodo === 'semana') {
      whereClause = `
        fecha >= DATE_TRUNC('week', $1::date)
        AND fecha <= (DATE_TRUNC('week', $1::date) + INTERVAL '6 days')::date
      `
      queryParams = [maxFecha]
    } else if (periodo === 'mes') {
      whereClause = `
        fecha >= DATE_TRUNC('month', $1::date)
        AND fecha <= (DATE_TRUNC('month', $1::date) + INTERVAL '1 month - 1 day')::date
      `
      queryParams = [maxFecha]
    } else {
      whereClause = `EXTRACT(YEAR FROM fecha) = $1`
      queryParams = [anio]
    }

    const { rows } = await pool.query(`
      SELECT 
        COALESCE(usuario_nombre, usuario_factura, 'Sin Asignar') AS usuario,
        usuario_factura,
        COUNT(*) AS total_facturas,
        SUM(valor_total) AS total_facturado,
        ROUND(AVG(valor_total)) AS ticket_promedio,
        COUNT(CASE WHEN estado = 'A' THEN 1 END) AS facturas_anuladas,
        SUM(CASE WHEN estado = 'A' THEN valor_total ELSE 0 END) AS valor_anulado,
        COUNT(CASE WHEN indcxc = 1 THEN 1 END) AS facturas_con_cxc,
        SUM(CASE WHEN indcxc = 1 THEN valor_total ELSE 0 END) AS valor_con_cxc,
        COUNT(CASE WHEN indcxc = 0 THEN 1 END) AS facturas_sin_cxc,
        SUM(CASE WHEN indcxc = 0 THEN valor_total ELSE 0 END) AS valor_sin_cxc
      FROM syn_factura
      WHERE ${whereClause}
      GROUP BY usuario_nombre, usuario_factura
      ORDER BY total_facturado DESC
    `, queryParams)

    res.json({
      periodo,
      referencia: maxFecha,
      total_periodo: rows.reduce((acc, r) => acc + Number(r.total_facturado || 0), 0),
      total_facturas_periodo: rows.reduce((acc, r) => acc + Number(r.total_facturas || 0), 0),
      usuarios: rows,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 4.2 Control de Estados: Con CxC, Sin CxC, Anuladas, Con Nota Crédito
facturacionRouter.get('/control-estados', async (req, res) => {
  const anio = Number(req.query.anio) || 2026
  try {
    const { rows: stats } = await pool.query(`
      WITH f_totales AS (
        SELECT 
          COUNT(*) AS total_facturas,
          SUM(valor_total) AS total_facturado,
          COUNT(CASE WHEN indcxc = 1 THEN 1 END) AS facturas_con_cxc,
          SUM(CASE WHEN indcxc = 1 THEN valor_total ELSE 0 END) AS valor_con_cxc,
          COUNT(CASE WHEN indcxc = 0 THEN 1 END) AS facturas_sin_cxc,
          SUM(CASE WHEN indcxc = 0 THEN valor_total ELSE 0 END) AS valor_sin_cxc,
          COUNT(CASE WHEN estado = 'A' THEN 1 END) AS facturas_anuladas,
          SUM(CASE WHEN estado = 'A' THEN valor_total ELSE 0 END) AS valor_anulado
        FROM syn_factura
        WHERE EXTRACT(YEAR FROM fecha) = $1
      ),
      nc_totales AS (
        SELECT 
          COUNT(DISTINCT n_factura) AS facturas_con_nc,
          COUNT(*) AS total_notas,
          COALESCE(SUM(vr_total), 0) AS valor_notas_credito
        FROM syn_nota_credito
        WHERE EXTRACT(YEAR FROM fecha) = $1 AND clase = 'C'
      )
      SELECT * FROM f_totales CROSS JOIN nc_totales
    `, [anio])

    const r = stats[0] || {}
    const totalFac = Number(r.total_facturado || 1)

    res.json({
      total_facturas: Number(r.total_facturas || 0),
      total_facturado: Number(r.total_facturado || 0),
      con_cxc: {
        facturas: Number(r.facturas_con_cxc || 0),
        total: Number(r.valor_con_cxc || 0),
        porcentaje: (Number(r.valor_con_cxc || 0) / totalFac) * 100,
      },
      sin_cxc: {
        facturas: Number(r.facturas_sin_cxc || 0),
        total: Number(r.valor_sin_cxc || 0),
        porcentaje: (Number(r.valor_sin_cxc || 0) / totalFac) * 100,
      },
      anuladas: {
        facturas: Number(r.facturas_anuladas || 0),
        total: Number(r.valor_anulado || 0),
        porcentaje: (Number(r.valor_anulado || 0) / totalFac) * 100,
      },
      con_nota_credito: {
        facturas: Number(r.facturas_con_nc || 0),
        total_notas: Number(r.total_notas || 0),
        total: Number(r.valor_notas_credito || 0),
        porcentaje: (Number(r.valor_notas_credito || 0) / totalFac) * 100,
      },
      facturacion_neta: Number(r.total_facturado || 0) - Number(r.valor_notas_credito || 0),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 4.3 Detalle de Facturas Anuladas
facturacionRouter.get('/anuladas-detalle', async (req, res) => {
  const anio = Number(req.query.anio) || 2026
  const limit = Number(req.query.limit) || 15
  try {
    const { rows } = await pool.query(`
      SELECT 
        n_factura,
        TO_CHAR(fecha, 'YYYY-MM-DD') as fecha,
        razon_social,
        valor_total,
        COALESCE(usuario_nombre, usuario_factura, 'Sin Asignar') as usuario,
        procedencia
      FROM syn_factura
      WHERE EXTRACT(YEAR FROM fecha) = $1 AND estado = 'A'
      ORDER BY fecha DESC, valor_total DESC
      LIMIT $2
    `, [anio, limit])

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 5. Top Clientes Facturados en el Año
facturacionRouter.get('/top-clientes', async (req, res) => {
  const anio = Number(req.query.anio) || 2026
  const limit = Number(req.query.limit) || 10
  try {
    const { rows } = await pool.query(`
      SELECT 
        f.idtercero,
        COALESCE(t.razon_social, f.razon_social) AS razon_social,
        COALESCE(t.nit, f.nit) AS nit,
        COUNT(*) AS cantidad_facturas,
        SUM(f.valor_total) AS total_facturado
      FROM syn_factura f
      LEFT JOIN syn_tercero t ON t.idtercero = f.idtercero
      WHERE EXTRACT(YEAR FROM f.fecha) = $1 AND f.estado <> 'A'
      GROUP BY f.idtercero, t.razon_social, f.razon_social, t.nit, f.nit
      ORDER BY total_facturado DESC
      LIMIT $2
    `, [anio, limit])

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 6. Facturación de la Semana Actual (Día a día: Lun - Dom)
facturacionRouter.get('/semana-actual', async (_req, res) => {
  try {
    const refRes = await pool.query("SELECT MAX(fecha) as max_fecha FROM syn_factura WHERE estado <> 'A'")
    const maxFecha = refRes.rows[0]?.max_fecha || new Date()

    const { rows } = await pool.query(`
      WITH limites AS (
        SELECT 
          DATE_TRUNC('week', $1::date) as inicio_semana,
          DATE_TRUNC('week', $1::date) + INTERVAL '6 days' as fin_semana
      ),
      dias AS (
        SELECT generate_series(
          (SELECT inicio_semana FROM limites),
          (SELECT fin_semana FROM limites),
          INTERVAL '1 day'
        )::date as dia
      )
      SELECT 
        TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
        CASE EXTRACT(ISODOW FROM d.dia)
          WHEN 1 THEN 'Lun'
          WHEN 2 THEN 'Mar'
          WHEN 3 THEN 'Mié'
          WHEN 4 THEN 'Jue'
          WHEN 5 THEN 'Vie'
          WHEN 6 THEN 'Sáb'
          WHEN 7 THEN 'Dom'
        END as dia_nombre,
        EXTRACT(ISODOW FROM d.dia)::int as dia_num,
        COALESCE(COUNT(f.n_factura), 0)::int as total_facturas,
        COALESCE(SUM(f.valor_total), 0)::numeric(18,2) as total_facturado
      FROM dias d
      LEFT JOIN syn_factura f ON f.fecha = d.dia AND f.estado <> 'A'
      GROUP BY d.dia
      ORDER BY d.dia ASC
    `, [maxFecha])

    res.json({
      referencia: maxFecha,
      semana: rows,
      total_semana: rows.reduce((acc, r) => acc + Number(r.total_facturado), 0),
      facturas_semana: rows.reduce((acc, r) => acc + Number(r.total_facturas), 0),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 7. Facturación del Mes Actual (Evolución diaria 1 a fin de mes)
facturacionRouter.get('/mes-actual', async (_req, res) => {
  try {
    const refRes = await pool.query("SELECT MAX(fecha) as max_fecha FROM syn_factura WHERE estado <> 'A'")
    const maxFecha = refRes.rows[0]?.max_fecha || new Date()

    const { rows } = await pool.query(`
      WITH limites AS (
        SELECT 
          DATE_TRUNC('month', $1::date) as inicio_mes,
          (DATE_TRUNC('month', $1::date) + INTERVAL '1 month - 1 day')::date as fin_mes
      ),
      dias AS (
        SELECT generate_series(
          (SELECT inicio_mes FROM limites),
          (SELECT fin_mes FROM limites),
          INTERVAL '1 day'
        )::date as dia
      )
      SELECT 
        EXTRACT(DAY FROM d.dia)::int as dia,
        TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
        COALESCE(COUNT(f.n_factura), 0)::int as total_facturas,
        COALESCE(SUM(f.valor_total), 0)::numeric(18,2) as total_facturado
      FROM dias d
      LEFT JOIN syn_factura f ON f.fecha = d.dia AND f.estado <> 'A'
      GROUP BY d.dia
      ORDER BY d.dia ASC
    `, [maxFecha])

    res.json({
      referencia: maxFecha,
      mes_nombre: new Date(maxFecha).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
      dias: rows,
      total_mes: rows.reduce((acc, r) => acc + Number(r.total_facturado), 0),
      facturas_mes: rows.reduce((acc, r) => acc + Number(r.total_facturas), 0),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
