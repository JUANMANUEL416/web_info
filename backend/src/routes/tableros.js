import { Router } from 'express'
import { pool } from '../config/db.js'

export const tablerosRouter = Router()

// 1. Resumen y Edades de Cartera
tablerosRouter.get('/cartera/resumen', async (_req, res) => {
  try {
    const { rows: resumen } = await pool.query(`
      SELECT 
        fecha_corte,
        COUNT(DISTINCT n_factura) AS total_facturas,
        COUNT(DISTINCT idtercero) AS total_deudores,
        SUM(saldo_neto) AS saldo_total,
        SUM(saldo_inicial) AS saldo_inicial,
        SUM(d0_30) AS d0_30,
        SUM(d31_60) AS d31_60,
        SUM(d61_90) AS d61_90,
        SUM(d91_120) AS d91_120,
        SUM(d121_150) AS d121_150,
        SUM(d151_180) AS d151_180,
        SUM(d181_360) AS d181_360,
        SUM(d361_mas) AS d361_mas,
        SUM(d0_30 + d31_60 + d61_90 + d91_120 + d121_150 + d151_180 + d181_360 + d361_mas) AS vencido_total
      FROM syn_cartera_foto
      WHERE fecha_corte = (SELECT MAX(fecha_corte) FROM syn_cartera_foto)
      GROUP BY fecha_corte
    `)

    res.json(resumen[0] || null)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 2. Top Deudores Ultra Optimizado con syn_tercero
tablerosRouter.get('/cartera/top-deudores', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { rows } = await pool.query(`
      WITH top_saldos AS (
        SELECT 
          idtercero,
          COUNT(DISTINCT n_factura) AS total_facturas,
          SUM(saldo_neto) AS saldo_total,
          SUM(d0_30 + d31_60 + d61_90 + d91_120 + d121_150 + d151_180 + d181_360 + d361_mas) AS saldo_vencido,
          ROUND(AVG(dias_vence), 0) AS dias_promedio
        FROM syn_cartera_foto
        WHERE fecha_corte = (SELECT MAX(fecha_corte) FROM syn_cartera_foto)
          AND idtercero IS NOT NULL
        GROUP BY idtercero
        ORDER BY saldo_total DESC
        LIMIT $1
      )
      SELECT 
        ts.idtercero,
        COALESCE(t.razon_social, ts.idtercero) AS razon_social,
        COALESCE(t.nit, '') AS nit,
        ts.total_facturas,
        ts.saldo_total,
        ts.saldo_vencido,
        ts.dias_promedio
      FROM top_saldos ts
      LEFT JOIN syn_tercero t ON t.idtercero = ts.idtercero
      ORDER BY ts.saldo_total DESC
    `, [limit])

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 3. Estado de Radicación de Cuentas de Cobro
tablerosRouter.get('/cartera/radicacion', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        radicada,
        COUNT(DISTINCT cnscxc) AS total_cuentas,
        COUNT(DISTINCT n_factura) AS total_facturas,
        SUM(valor_factura) AS valor_total
      FROM syn_cuenta_cobro
      GROUP BY radicada
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 4. Facturación Diaria Reciente
tablerosRouter.get('/facturacion/resumen', async (_req, res) => {
  try {
    const { rows: diario } = await pool.query(`
      SELECT 
        fecha,
        COUNT(*) AS total_facturas,
        SUM(valor_total) AS facturado_dia
      FROM syn_factura
      GROUP BY fecha
      ORDER BY fecha DESC
      LIMIT 30
    `)
    res.json(diario)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 5. Cuentas por Pagar - Resumen Ejecutivo
tablerosRouter.get('/cxp/resumen', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE saldo > 0) AS total_obligaciones,
        COUNT(DISTINCT idtercero) FILTER (WHERE saldo > 0) AS total_proveedores,
        COALESCE(SUM(valor) FILTER (WHERE saldo > 0), 0) AS valor_bruto,
        COALESCE(SUM(saldo) FILTER (WHERE saldo > 0), 0) AS saldo_total,
        COALESCE(SUM(vlr_abonos) FILTER (WHERE saldo > 0), 0) AS vlr_abonos,
        COALESCE(SUM(por_vencer) FILTER (WHERE saldo > 0), 0) AS por_vencer,
        COALESCE(SUM(d0_30) FILTER (WHERE saldo > 0), 0) AS d0_30,
        COALESCE(SUM(d31_60) FILTER (WHERE saldo > 0), 0) AS d31_60,
        COALESCE(SUM(dm0_30) FILTER (WHERE saldo > 0), 0) AS dm0_30,
        COALESCE(SUM(dm31_60) FILTER (WHERE saldo > 0), 0) AS dm31_60,
        COALESCE(SUM(dm61_90) FILTER (WHERE saldo > 0), 0) AS dm61_90,
        COALESCE(SUM(dm91_120 + dm121_150 + dm151_180) FILTER (WHERE saldo > 0), 0) AS dm91_180,
        COALESCE(SUM(dm181_360) FILTER (WHERE saldo > 0), 0) AS dm181_360,
        COALESCE(SUM(dm361_mas) FILTER (WHERE saldo > 0), 0) AS dm361_mas,
        COALESCE(SUM(dm0_30 + dm31_60 + dm61_90 + dm91_120 + dm121_150 + dm151_180 + dm181_360 + dm361_mas) FILTER (WHERE saldo > 0), 0) AS vencido_total,
        MAX(fecha_sync) AS fecha_corte
      FROM syn_cxp
    `)
    res.json(rows[0] || null)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 6. Cuentas por Pagar - Aging / Edades de la Deuda
tablerosRouter.get('/cxp/aging', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(SUM(por_vencer) FILTER (WHERE saldo > 0), 0) AS por_vencer,
        COALESCE(SUM(dm0_30) FILTER (WHERE saldo > 0), 0) AS dm0_30,
        COALESCE(SUM(dm31_60) FILTER (WHERE saldo > 0), 0) AS dm31_60,
        COALESCE(SUM(dm61_90) FILTER (WHERE saldo > 0), 0) AS dm61_90,
        COALESCE(SUM(dm91_120 + dm121_150 + dm151_180) FILTER (WHERE saldo > 0), 0) AS dm91_180,
        COALESCE(SUM(dm181_360) FILTER (WHERE saldo > 0), 0) AS dm181_360,
        COALESCE(SUM(dm361_mas) FILTER (WHERE saldo > 0), 0) AS dm361_mas
      FROM syn_cxp
    `)
    const r = rows[0] || {}
    const items = [
      { label: 'Por vencer', value: Number(r.por_vencer || 0), color: '#059669' },
      { label: '1 a 30 días', value: Number(r.dm0_30 || 0), color: '#00B5E2' },
      { label: '31 a 60 días', value: Number(r.dm31_60 || 0), color: '#0072CE' },
      { label: '61 a 90 días', value: Number(r.dm61_90 || 0), color: '#0B3B60' },
      { label: '91 a 180 días', value: Number(r.dm91_180 || 0), color: '#D97706' },
      { label: '181 a 360 días', value: Number(r.dm181_360 || 0), color: '#EA580C' },
      { label: '> 360 días', value: Number(r.dm361_mas || 0), color: '#DC2626' },
    ]
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 7. Cuentas por Pagar - Composición por Procedencia
tablerosRouter.get('/cxp/procedencia', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(procedencia, 'Sin Definir') AS procedencia,
        COUNT(*) AS cantidad_cuentas,
        SUM(saldo) AS saldo_pendiente,
        ROUND(SUM(saldo) * 100.0 / NULLIF((SELECT SUM(saldo) FROM syn_cxp WHERE saldo > 0), 0), 2) AS pct_participacion
      FROM syn_cxp
      WHERE saldo > 0
      GROUP BY procedencia
      ORDER BY saldo_pendiente DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 8. Cuentas por Pagar - Top Proveedores con Mayor Saldo Pendiente
tablerosRouter.get('/cxp/top-proveedores', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { rows } = await pool.query(`
      SELECT 
        idtercero,
        COALESCE(nit, '') AS nit,
        COALESCE(razon_social, idtercero) AS razon_social,
        COUNT(*) AS facturas_pendientes,
        SUM(saldo) AS saldo_pendiente,
        SUM(por_vencer) AS por_vencer,
        SUM(dm0_30 + dm31_60 + dm61_90 + dm91_120 + dm121_150 + dm151_180 + dm181_360 + dm361_mas) AS saldo_vencido,
        MAX(dias_vence) AS dias_mora_max,
        MIN(f_vence) AS fecha_vence_mas_antigua,
        (
          SELECT p2.procedencia 
          FROM syn_cxp p2 
          WHERE p2.idtercero = p.idtercero AND p2.saldo > 0 
          GROUP BY p2.procedencia 
          ORDER BY SUM(p2.saldo) DESC 
          LIMIT 1
        ) AS procedencia_principal
      FROM syn_cxp p
      WHERE saldo > 0
      GROUP BY idtercero, nit, razon_social
      ORDER BY saldo_pendiente DESC
      LIMIT $1
    `, [limit])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 9. Cuentas por Pagar - Listado de Cuentas / Próximos Pagos
tablerosRouter.get('/cxp/obligaciones', async (req, res) => {
  const limit = Number(req.query.limit) || 15
  const procedencia = req.query.procedencia
  try {
    let whereClause = 'WHERE saldo > 0'
    const params = [limit]
    if (procedencia && procedencia !== 'Todos') {
      whereClause += ' AND procedencia = $2'
      params.push(procedencia)
    }

    const { rows } = await pool.query(`
      SELECT 
        cnsfcxp,
        COALESCE(noreferencia, cnsfcxp) AS noreferencia,
        TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha,
        TO_CHAR(f_vence, 'YYYY-MM-DD') AS f_vence,
        idtercero,
        nit,
        COALESCE(razon_social, idtercero) AS razon_social,
        procedencia,
        valor,
        saldo,
        dias_vence,
        estado
      FROM syn_cxp
      ${whereClause}
      ORDER BY dias_vence DESC, saldo DESC
      LIMIT $1
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 10. CxP - Semana Actual (Día a día: Lun - Dom con separación por procedencia)
tablerosRouter.get('/cxp/semana', async (_req, res) => {
  try {
    const refRes = await pool.query("SELECT MAX(fecha) as max_fecha FROM syn_fcxp WHERE estado != 'A'")
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
        COUNT(f.cnsfcxp)::int as total_obligaciones,
        COALESCE(SUM(f.valor), 0)::numeric(18,2) as total_valor,
        COALESCE(SUM(CASE WHEN f.procedencia = 'Servicios' THEN f.valor ELSE 0 END), 0)::numeric(18,2) as val_servicios,
        COALESCE(SUM(CASE WHEN f.procedencia = 'Nomina' THEN f.valor ELSE 0 END), 0)::numeric(18,2) as val_nomina,
        COALESCE(SUM(CASE WHEN f.procedencia = 'Anticipos' THEN f.valor ELSE 0 END), 0)::numeric(18,2) as val_anticipos,
        COALESCE(SUM(CASE WHEN f.procedencia = 'Compras' THEN f.valor ELSE 0 END), 0)::numeric(18,2) as val_compras
      FROM dias d
      LEFT JOIN syn_fcxp f ON f.fecha = d.dia AND f.estado != 'A'
      GROUP BY d.dia
      ORDER BY d.dia ASC
    `, [maxFecha])

    // Desglose consolidado por procedencia en la semana
    const { rows: procRows } = await pool.query(`
      WITH limites AS (
        SELECT 
          DATE_TRUNC('week', $1::date) as inicio_semana,
          DATE_TRUNC('week', $1::date) + INTERVAL '6 days' as fin_semana
      )
      SELECT 
        COALESCE(f.procedencia, 'Sin Definir') as procedencia,
        COUNT(f.cnsfcxp)::int as cantidad,
        COALESCE(SUM(f.valor), 0)::numeric(18,2) as total
      FROM syn_fcxp f
      CROSS JOIN limites l
      WHERE f.fecha BETWEEN l.inicio_semana AND l.fin_semana AND f.estado != 'A'
      GROUP BY f.procedencia
      ORDER BY total DESC
    `, [maxFecha])

    const totalSemana = rows.reduce((acc, r) => acc + Number(r.total_valor), 0)
    const obligSemana = rows.reduce((acc, r) => acc + Number(r.total_obligaciones), 0)

    res.json({
      referencia: maxFecha,
      semana: rows,
      total_semana: totalSemana,
      obligaciones_semana: obligSemana,
      procedencias: procRows.map(p => ({
        ...p,
        total: Number(p.total),
        porcentaje: totalSemana > 0 ? (Number(p.total) / totalSemana) * 100 : 0
      }))
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 11. CxP - Mes Actual (Evolución diaria y procedencia)
tablerosRouter.get('/cxp/mes', async (_req, res) => {
  try {
    const refRes = await pool.query("SELECT MAX(fecha) as max_fecha FROM syn_fcxp WHERE estado != 'A'")
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
        COUNT(f.cnsfcxp)::int as total_obligaciones,
        COALESCE(SUM(f.valor), 0)::numeric(18,2) as total_valor,
        COALESCE(SUM(CASE WHEN f.procedencia = 'Servicios' THEN f.valor ELSE 0 END), 0)::numeric(18,2) as val_servicios,
        COALESCE(SUM(CASE WHEN f.procedencia = 'Nomina' THEN f.valor ELSE 0 END), 0)::numeric(18,2) as val_nomina,
        COALESCE(SUM(CASE WHEN f.procedencia = 'Anticipos' THEN f.valor ELSE 0 END), 0)::numeric(18,2) as val_anticipos,
        COALESCE(SUM(CASE WHEN f.procedencia = 'Compras' THEN f.valor ELSE 0 END), 0)::numeric(18,2) as val_compras
      FROM dias d
      LEFT JOIN syn_fcxp f ON f.fecha = d.dia AND f.estado != 'A'
      GROUP BY d.dia
      ORDER BY d.dia ASC
    `, [maxFecha])

    // Procedencias del mes
    const { rows: procRows } = await pool.query(`
      WITH limites AS (
        SELECT 
          DATE_TRUNC('month', $1::date) as inicio_mes,
          (DATE_TRUNC('month', $1::date) + INTERVAL '1 month - 1 day')::date as fin_mes
      )
      SELECT 
        COALESCE(f.procedencia, 'Sin Definir') as procedencia,
        COUNT(f.cnsfcxp)::int as cantidad,
        COALESCE(SUM(f.valor), 0)::numeric(18,2) as total
      FROM syn_fcxp f
      CROSS JOIN limites l
      WHERE f.fecha BETWEEN l.inicio_mes AND l.fin_mes AND f.estado != 'A'
      GROUP BY f.procedencia
      ORDER BY total DESC
    `, [maxFecha])

    const totalMes = rows.reduce((acc, r) => acc + Number(r.total_valor), 0)
    const obligMes = rows.reduce((acc, r) => acc + Number(r.total_obligaciones), 0)

    res.json({
      referencia: maxFecha,
      mes_nombre: new Date(maxFecha).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
      dias: rows,
      total_mes: totalMes,
      obligaciones_mes: obligMes,
      procedencias: procRows.map(p => ({
        ...p,
        total: Number(p.total),
        porcentaje: totalMes > 0 ? (Number(p.total) / totalMes) * 100 : 0
      }))
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 12. CxP - Tendencia Anual y por Procedencia (Con selector de año)
tablerosRouter.get('/cxp/tendencia-anual', async (req, res) => {
  const anio = Number(req.query.anio) || 2026
  try {
    const { rows } = await pool.query(`
      SELECT 
        mes,
        COUNT(*)::int as total_obligaciones,
        COALESCE(SUM(valor), 0)::numeric(18,2) as total_valor,
        COALESCE(SUM(CASE WHEN procedencia = 'Servicios' THEN valor ELSE 0 END), 0)::numeric(18,2) as val_servicios,
        COALESCE(SUM(CASE WHEN procedencia = 'Nomina' THEN valor ELSE 0 END), 0)::numeric(18,2) as val_nomina,
        COALESCE(SUM(CASE WHEN procedencia = 'Anticipos' THEN valor ELSE 0 END), 0)::numeric(18,2) as val_anticipos,
        COALESCE(SUM(CASE WHEN procedencia = 'Compras' THEN valor ELSE 0 END), 0)::numeric(18,2) as val_compras
      FROM syn_fcxp
      WHERE anio = $1 AND estado != 'A'
      GROUP BY mes
      ORDER BY mes ASC
    `, [anio])

    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const mesesCompletos = Array.from({ length: 12 }, (_, i) => {
      const numMes = i + 1
      const found = rows.find(r => Number(r.mes) === numMes)
      return {
        mes: numMes,
        mes_nombre: nombresMeses[i],
        total_obligaciones: found ? Number(found.total_obligaciones) : 0,
        total_valor: found ? Number(found.total_valor) : 0,
        val_servicios: found ? Number(found.val_servicios) : 0,
        val_nomina: found ? Number(found.val_nomina) : 0,
        val_anticipos: found ? Number(found.val_anticipos) : 0,
        val_compras: found ? Number(found.val_compras) : 0,
      }
    })

    const { rows: procRows } = await pool.query(`
      SELECT 
        COALESCE(procedencia, 'Sin Definir') as procedencia,
        COUNT(*)::int as cantidad,
        COALESCE(SUM(valor), 0)::numeric(18,2) as total
      FROM syn_fcxp
      WHERE anio = $1 AND estado != 'A'
      GROUP BY procedencia
      ORDER BY total DESC
    `, [anio])

    const totalAnio = mesesCompletos.reduce((acc, m) => acc + m.total_valor, 0)
    const obligAnio = mesesCompletos.reduce((acc, m) => acc + m.total_obligaciones, 0)

    res.json({
      anio,
      meses: mesesCompletos,
      total_anio: totalAnio,
      obligaciones_anio: obligAnio,
      procedencias: procRows.map(p => ({
        ...p,
        total: Number(p.total),
        porcentaje: totalAnio > 0 ? (Number(p.total) / totalAnio) * 100 : 0
      }))
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 13. CxP - Resumen por Periodo (Semana, Mes, Año)
tablerosRouter.get('/cxp/resumen-periodo', async (req, res) => {
  const anio = Number(req.query.anio) || 2026
  const periodo = req.query.periodo || 'semana' // 'semana' | 'mes' | 'anio'
  try {
    const refRes = await pool.query("SELECT MAX(fecha) as max_fecha FROM syn_fcxp WHERE estado != 'A'")
    const maxFecha = refRes.rows[0]?.max_fecha || new Date()

    let whereCond = "WHERE f.estado != 'A'"
    const params = []

    if (periodo === 'semana') {
      whereCond += " AND f.fecha BETWEEN DATE_TRUNC('week', $1::date) AND (DATE_TRUNC('week', $1::date) + INTERVAL '6 days')"
      params.push(maxFecha)
    } else if (periodo === 'mes') {
      whereCond += " AND f.fecha BETWEEN DATE_TRUNC('month', $1::date) AND (DATE_TRUNC('month', $1::date) + INTERVAL '1 month - 1 day')"
      params.push(maxFecha)
    } else {
      whereCond += " AND f.anio = $1"
      params.push(anio)
    }

    const { rows: kpiRows } = await pool.query(`
      SELECT 
        COUNT(*)::int as total_obligaciones,
        COALESCE(SUM(valor), 0)::numeric(18,2) as total_valor,
        COALESCE(SUM(saldo), 0)::numeric(18,2) as total_saldo,
        COUNT(DISTINCT idtercero)::int as total_proveedores
      FROM syn_fcxp f
      ${whereCond}
    `, params)

    const { rows: procRows } = await pool.query(`
      SELECT 
        COALESCE(f.procedencia, 'Sin Definir') as procedencia,
        COUNT(*)::int as cantidad,
        COALESCE(SUM(f.valor), 0)::numeric(18,2) as total
      FROM syn_fcxp f
      ${whereCond}
      GROUP BY f.procedencia
      ORDER BY total DESC
    `, params)

    const totalVal = Number(kpiRows[0]?.total_valor || 0)

    res.json({
      periodo,
      anio,
      referencia: maxFecha,
      kpis: {
        total_obligaciones: Number(kpiRows[0]?.total_obligaciones || 0),
        total_valor: totalVal,
        total_saldo: Number(kpiRows[0]?.total_saldo || 0),
        total_proveedores: Number(kpiRows[0]?.total_proveedores || 0),
      },
      procedencias: procRows.map(p => ({
        ...p,
        total: Number(p.total),
        porcentaje: totalVal > 0 ? (Number(p.total) / totalVal) * 100 : 0
      }))
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
