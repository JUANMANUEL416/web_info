import { Router } from 'express'
import { pool } from '../config/db.js'

export const indicadoresRouter = Router()

// Helper unificado para construir el filtro de periodo (Semanal por defecto)
function buildPeriodFilter(query, table = 'syn_citas') {
  const { periodo = 'semana', fecha_inicio, fecha_fin, anio } = query
  const params = []
  let where = 'WHERE 1=1'
  let labelPeriodo = 'Semana Actual (9 al 15 Nov 2026)'

  if (periodo === 'mes') {
    where += " AND fecha >= DATE_TRUNC('month', '2026-11-15'::date) AND fecha <= (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date"
    labelPeriodo = 'Mes Actual (Noviembre 2026)'
  } else if (periodo === 'anio') {
    const y = Number(anio) || 2026
    params.push(y)
    where += ` AND anio = $${params.length}`
    labelPeriodo = `Vigencia ${y}`
  } else if (periodo === 'fechas' && fecha_inicio && fecha_fin) {
    params.push(fecha_inicio, fecha_fin)
    where += ` AND fecha >= $${params.length - 1} AND fecha <= $${params.length}`
    labelPeriodo = `${fecha_inicio} al ${fecha_fin}`
  } else {
    // Por defecto: SEMANAL
    where += " AND fecha >= DATE_TRUNC('week', '2026-11-15'::date) AND fecha <= (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date"
    labelPeriodo = 'Semana Actual (9 al 15 Nov 2026)'
  }

  return { where, params, labelPeriodo }
}

const buildCitasFilter = (query) => buildPeriodFilter(query, 'syn_citas')
const buildAutorizacionesFilter = (query) => buildPeriodFilter(query, 'syn_autorizaciones')

// 1. Resumen Ejecutivo de Citas (con filtro dinámico)
indicadoresRouter.get('/citas/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildCitasFilter(req.query)

    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_citas,
        COUNT(CASE WHEN estado_cita = 'Cumplida' THEN 1 END)::int AS cumplidas,
        COUNT(CASE WHEN estado_cita = 'Programada' THEN 1 END)::int AS programadas,
        COUNT(CASE WHEN estado_cita = 'Inasistencia' THEN 1 END)::int AS inasistencias,
        COUNT(CASE WHEN estado_cita = 'Cancelada' THEN 1 END)::int AS canceladas,
        COUNT(CASE WHEN estado_cita = 'Reasignada' THEN 1 END)::int AS reasignadas,
        COUNT(CASE WHEN pvez = 1 THEN 1 END)::int AS primera_vez,
        COUNT(CASE WHEN pvez = 0 THEN 1 END)::int AS control,
        ROUND(AVG(dias_oportunidad)::numeric, 1)::float AS oportunidad_dias_promedio,
        COUNT(DISTINCT idmedico)::int AS total_medicos,
        COUNT(DISTINCT idservicio)::int AS total_servicios,
        COUNT(DISTINCT idcontratante)::int AS total_aseguradores,
        COALESCE(SUM(valortotal), 0)::numeric(18,2) AS valor_total,
        COALESCE(SUM(valorcopago), 0)::numeric(18,2) AS valor_copagos
      FROM syn_citas
      ${where}
    `, params)

    const r = rows[0] || {}
    const total = Number(r.total_citas || 1)

    res.json({
      ...r,
      label_periodo: labelPeriodo,
      pct_cumplimiento: Number(((r.cumplidas / total) * 100).toFixed(1)),
      pct_inasistencias: Number(((r.inasistencias / total) * 100).toFixed(1)),
      pct_canceladas: Number(((r.canceladas / total) * 100).toFixed(1)),
      pct_programadas: Number(((r.programadas / total) * 100).toFixed(1)),
      pct_primera_vez: Number(((r.primera_vez / total) * 100).toFixed(1)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 2. Citas por Especialidad / Servicio (con filtro dinámico)
indicadoresRouter.get('/citas/por-especialidad', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildCitasFilter(req.query)
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        idservicio,
        COALESCE(servicio, 'CONSULTA GENERAL / NO ASIGNADO') AS servicio,
        COUNT(*)::int AS total_citas,
        COUNT(CASE WHEN estado_cita = 'Cumplida' THEN 1 END)::int AS cumplidas,
        COUNT(CASE WHEN estado_cita = 'Inasistencia' THEN 1 END)::int AS inasistencias,
        COUNT(CASE WHEN estado_cita = 'Cancelada' THEN 1 END)::int AS canceladas,
        ROUND(
          COUNT(CASE WHEN estado_cita = 'Cumplida' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
          1
        )::float AS pct_cumplimiento,
        ROUND(AVG(dias_oportunidad)::numeric, 1)::float AS oportunidad_promedio
      FROM syn_citas
      ${where} AND servicio IS NOT NULL AND servicio != ''
      GROUP BY idservicio, servicio
      ORDER BY total_citas DESC
      LIMIT $${limitIdx}
    `, params)

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 3. Rendimiento por Médico (con filtro dinámico)
indicadoresRouter.get('/citas/por-medico', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildCitasFilter(req.query)
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        idmedico,
        COALESCE(medico, 'SIN ASIGNAR') AS medico,
        COUNT(*)::int AS total_citas,
        COUNT(CASE WHEN estado_cita = 'Cumplida' THEN 1 END)::int AS cumplidas,
        COUNT(CASE WHEN estado_cita = 'Inasistencia' THEN 1 END)::int AS inasistencias,
        COUNT(CASE WHEN estado_cita = 'Cancelada' THEN 1 END)::int AS canceladas,
        ROUND(
          COUNT(CASE WHEN estado_cita = 'Cumplida' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
          1
        )::float AS pct_cumplimiento
      FROM syn_citas
      ${where} AND medico IS NOT NULL AND medico != '' AND medico != 'SIN ASIGNAR'
      GROUP BY idmedico, medico
      ORDER BY total_citas DESC
      LIMIT $${limitIdx}
    `, params)

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 4. Distribución por Asegurador / EPS (con filtro dinámico)
indicadoresRouter.get('/citas/por-asegurador', async (req, res) => {
  const limit = Number(req.query.limit) || 8
  try {
    const { where, params } = buildCitasFilter(req.query)
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        idcontratante,
        COALESCE(asegurador, 'PARTICULAR / OTROS') AS asegurador,
        COUNT(*)::int AS total_citas,
        COUNT(CASE WHEN estado_cita = 'Cumplida' THEN 1 END)::int AS cumplidas,
        COUNT(CASE WHEN estado_cita = 'Inasistencia' THEN 1 END)::int AS inasistencias,
        COUNT(CASE WHEN estado_cita = 'Cancelada' THEN 1 END)::int AS canceladas,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_citas ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_citas
      ${where}
      GROUP BY idcontratante, asegurador
      ORDER BY total_citas DESC
      LIMIT $${limitIdx}
    `, params)

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 5. Tendencia Temporal Adaptada al Filtro (Día a día o Mes a mes)
indicadoresRouter.get('/citas/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'anio'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT 
            DATE_TRUNC('week', '2026-11-15'::date) as inicio,
            (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (
          SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia
        )
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia)
            WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié'
            WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom'
          END as label,
          COUNT(c.consecutivo)::int as total_citas,
          COUNT(CASE WHEN c.estado_cita = 'Cumplida' THEN 1 END)::int as cumplidas,
          COUNT(CASE WHEN c.estado_cita = 'Inasistencia' THEN 1 END)::int as inasistencias
        FROM dias d
        LEFT JOIN syn_citas c ON c.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }

    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT 
            DATE_TRUNC('month', '2026-11-15'::date) as inicio,
            (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (
          SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia
        )
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COUNT(c.consecutivo)::int as total_citas,
          COUNT(CASE WHEN c.estado_cita = 'Cumplida' THEN 1 END)::int as cumplidas,
          COUNT(CASE WHEN c.estado_cita = 'Inasistencia' THEN 1 END)::int as inasistencias
        FROM dias d
        LEFT JOIN syn_citas c ON c.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }

    // Default: Anual (Mes a mes)
    const { rows } = await pool.query(`
      SELECT 
        mes,
        COUNT(*)::int AS total_citas,
        COUNT(CASE WHEN estado_cita = 'Cumplida' THEN 1 END)::int AS cumplidas,
        COUNT(CASE WHEN estado_cita = 'Inasistencia' THEN 1 END)::int AS inasistencias,
        COUNT(CASE WHEN estado_cita = 'Cancelada' THEN 1 END)::int AS canceladas
      FROM syn_citas
      WHERE anio = 2026
      GROUP BY mes
      ORDER BY mes ASC
    `)

    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const mesesCompletos = Array.from({ length: 12 }, (_, i) => {
      const num = i + 1
      const found = rows.find(r => r.mes === num)
      return {
        label: nombresMeses[i],
        total_citas: found ? found.total_citas : 0,
        cumplidas: found ? found.cumplidas : 0,
        inasistencias: found ? found.inasistencias : 0,
        canceladas: found ? found.canceladas : 0,
      }
    })

    res.json({ tipo: 'anio', categorias: nombresMeses, data: mesesCompletos })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 6. Exportación de Citas a Excel / CSV con UTF-8 BOM
indicadoresRouter.get('/citas/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildCitasFilter(req.query)

    const { rows } = await pool.query(`
      SELECT 
        consecutivo,
        TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha_cita,
        TO_CHAR(fechasol, 'YYYY-MM-DD') AS fecha_solicitud,
        dias_oportunidad,
        estado_cita,
        COALESCE(servicio, 'NO ASIGNADO') AS servicio,
        COALESCE(medico, 'SIN ASIGNAR') AS medico,
        COALESCE(asegurador, 'PARTICULAR') AS asegurador,
        valortotal,
        valorcopago
      FROM syn_citas
      ${where}
      ORDER BY fecha DESC, consecutivo DESC
      LIMIT 10000
    `, params)

    const filename = `citas_clinica_esperanza_${req.query.periodo || '2026'}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    // Escribir Byte Order Mark (BOM) UTF-8 para que Microsoft Excel abra directo con tildes y caracteres en español
    res.write('\ufeff')

    // Encabezados en español
    res.write('Consecutivo;Fecha Cita;Fecha Solicitud;Días Espera Oportunidad;Estado Cita;Especialidad / Servicio;Médico Especialista;Entidad Aseguradora / EPS;Valor Cita;Copago Recaudado\r\n')

    for (const r of rows) {
      const line = [
        `"${r.consecutivo || ''}"`,
        `"${r.fecha_cita || ''}"`,
        `"${r.fecha_solicitud || ''}"`,
        r.dias_oportunidad || 0,
        `"${r.estado_cita || ''}"`,
        `"${(r.servicio || '').replace(/"/g, '""')}"`,
        `"${(r.medico || '').replace(/"/g, '""')}"`,
        `"${(r.asegurador || '').replace(/"/g, '""')}"`,
        Number(r.valortotal || 0).toFixed(0),
        Number(r.valorcopago || 0).toFixed(0)
      ].join(';')
      res.write(line + '\r\n')
    }

    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 3: RESULTADOS DE APOYO DIAGNÓSTICO (syn_apoyo)
// =====================================================================

indicadoresRouter.get('/apoyo/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_apoyo')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_estudios,
        ROUND(AVG(tiempo_entrega_horas)::numeric, 1)::float AS tiempo_entrega_promedio,
        COUNT(DISTINCT idservicio)::int AS total_servicios,
        COUNT(DISTINCT idmedico)::int AS total_medicos,
        COUNT(DISTINCT asegurador)::int AS total_aseguradores,
        COUNT(CASE WHEN tiempo_entrega_horas <= 24 THEN 1 END)::int AS oportunos_24h
      FROM syn_apoyo
      ${where}
    `, params)

    const r = rows[0] || {}
    const total = Number(r.total_estudios || 1)
    res.json({
      ...r,
      label_periodo: labelPeriodo,
      pct_oportunidad_24h: Number(((r.oportunos_24h / total) * 100).toFixed(1)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/apoyo/por-servicio', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_apoyo')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        idservicio,
        COALESCE(servicio, 'ESTUDIO GENERAL') AS servicio,
        COUNT(*)::int AS total_estudios,
        ROUND(AVG(tiempo_entrega_horas)::numeric, 1)::float AS tiempo_promedio,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_apoyo ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_apoyo
      ${where} AND servicio IS NOT NULL AND servicio != ''
      GROUP BY idservicio, servicio
      ORDER BY total_estudios DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/apoyo/por-medico', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_apoyo')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        idmedico,
        COALESCE(medico, 'MEDICO INFORMANTE') AS medico,
        COALESCE(especialidad, 'ESPECIALISTA') AS especialidad,
        COUNT(*)::int AS total_estudios,
        ROUND(AVG(tiempo_entrega_horas)::numeric, 1)::float AS tiempo_promedio
      FROM syn_apoyo
      ${where} AND medico IS NOT NULL AND medico != ''
      GROUP BY idmedico, medico, especialidad
      ORDER BY total_estudios DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/apoyo/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COUNT(a.norden)::int as total_estudios
        FROM dias d
        LEFT JOIN syn_apoyo a ON a.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COUNT(a.norden)::int as total_estudios
        FROM dias d
        LEFT JOIN syn_apoyo a ON a.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COUNT(*)::int AS total_estudios
      FROM syn_apoyo WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, total_estudios: found ? found.total_estudios : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/apoyo/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_apoyo')
    const { rows } = await pool.query(`
      SELECT norden, noaut, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, COALESCE(servicio, 'ESTUDIO') as servicio, COALESCE(medico, 'MEDICO') as medico, COALESCE(especialidad, 'GENERAL') as especialidad, COALESCE(asegurador, 'PARTICULAR') as asegurador, tipoingreso, tiempo_entrega_horas
      FROM syn_apoyo ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="apoyo_diagnostico_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('N° Orden;N° Autorización;Fecha;Estudio / Procedimiento;Médico Especialista;Especialidad;EPS / Convenio;Tipo Ingreso;Horas Entrega\r\n')
    for (const r of rows) {
      res.write(`"${r.norden}";"${r.noaut}";"${r.fecha}";"${(r.servicio||'').replace(/"/g,'""')}";"${(r.medico||'').replace(/"/g,'""')}";"${r.especialidad}";"${(r.asegurador||'').replace(/"/g,'""')}";"${r.tipoingreso}";${r.tiempo_entrega_horas}\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 4: HISTORIA CLÍNICA (syn_hc)
// =====================================================================

indicadoresRouter.get('/hc/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_hc')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_atenciones,
        COUNT(CASE WHEN cerrada = 1 THEN 1 END)::int AS cerradas_oportunas,
        COUNT(DISTINCT idmedico)::int AS total_medicos,
        COUNT(DISTINCT iddx)::int AS total_diagnosticos
      FROM syn_hc
      ${where}
    `, params)

    const r = rows[0] || {}
    const total = Number(r.total_atenciones || 1)
    res.json({
      ...r,
      label_periodo: labelPeriodo,
      pct_cerradas: Number(((r.cerradas_oportunas / total) * 100).toFixed(1)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/hc/por-diagnostico', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_hc')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        iddx,
        COALESCE(diagnostico, 'CONSULTA GENERAL') AS diagnostico,
        COUNT(*)::int AS total_atenciones,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_hc ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_hc
      ${where} AND diagnostico IS NOT NULL AND diagnostico != ''
      GROUP BY iddx, diagnostico
      ORDER BY total_atenciones DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/hc/por-medico', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_hc')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        idmedico,
        COALESCE(medico, 'MEDICO TRATANTE') AS medico,
        COALESCE(especialidad, 'GENERAL') AS especialidad,
        COUNT(*)::int AS total_atenciones
      FROM syn_hc
      ${where} AND medico IS NOT NULL AND medico != ''
      GROUP BY idmedico, medico, especialidad
      ORDER BY total_atenciones DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// =====================================================================
// ENDPOINTS PROCESO 3: RESULTADOS DE APOYO DIAGNÓSTICO (syn_apoyo)
// =====================================================================

indicadoresRouter.get('/apoyo/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_apoyo')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_estudios,
        ROUND(AVG(tiempo_entrega_horas)::numeric, 1)::float AS tiempo_entrega_promedio,
        COUNT(DISTINCT idservicio)::int AS total_servicios,
        COUNT(DISTINCT idmedico)::int AS total_medicos,
        COUNT(DISTINCT asegurador)::int AS total_aseguradores,
        COUNT(CASE WHEN tiempo_entrega_horas <= 24 THEN 1 END)::int AS oportunos_24h
      FROM syn_apoyo
      ${where}
    `, params)

    const r = rows[0] || {}
    const total = Number(r.total_estudios || 1)
    res.json({
      ...r,
      label_periodo: labelPeriodo,
      pct_oportunidad_24h: Number(((r.oportunos_24h / total) * 100).toFixed(1)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/apoyo/por-servicio', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_apoyo')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        idservicio,
        COALESCE(servicio, 'ESTUDIO GENERAL') AS servicio,
        COUNT(*)::int AS total_estudios,
        ROUND(AVG(tiempo_entrega_horas)::numeric, 1)::float AS tiempo_promedio,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_apoyo ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_apoyo
      ${where} AND servicio IS NOT NULL AND servicio != ''
      GROUP BY idservicio, servicio
      ORDER BY total_estudios DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/apoyo/por-medico', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_apoyo')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        idmedico,
        COALESCE(medico, 'MEDICO INFORMANTE') AS medico,
        COALESCE(especialidad, 'ESPECIALISTA') AS especialidad,
        COUNT(*)::int AS total_estudios,
        ROUND(AVG(tiempo_entrega_horas)::numeric, 1)::float AS tiempo_promedio
      FROM syn_apoyo
      ${where} AND medico IS NOT NULL AND medico != ''
      GROUP BY idmedico, medico, especialidad
      ORDER BY total_estudios DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/apoyo/por-asegurador', async (req, res) => {
  const limit = Number(req.query.limit) || 8
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_apoyo')

    const { rows } = await pool.query(`
      SELECT 
        COALESCE(asegurador, 'PARTICULAR / OTROS') AS asegurador,
        COUNT(*)::int AS total_estudios,
        ROUND(AVG(tiempo_entrega_horas)::numeric, 1)::float AS tiempo_promedio,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_apoyo ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_apoyo
      ${where}
      GROUP BY asegurador
      ORDER BY total_estudios DESC
      LIMIT ${limit}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/apoyo/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COUNT(a.norden)::int as total_estudios
        FROM dias d
        LEFT JOIN syn_apoyo a ON a.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COUNT(a.norden)::int as total_estudios
        FROM dias d
        LEFT JOIN syn_apoyo a ON a.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COUNT(*)::int AS total_estudios
      FROM syn_apoyo WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, total_estudios: found ? found.total_estudios : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/apoyo/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_apoyo')
    const { rows } = await pool.query(`
      SELECT norden, noaut, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, COALESCE(servicio, 'ESTUDIO') as servicio, COALESCE(medico, 'MEDICO') as medico, COALESCE(especialidad, 'GENERAL') as especialidad, COALESCE(asegurador, 'PARTICULAR') as asegurador, tipoingreso, tiempo_entrega_horas
      FROM syn_apoyo ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="apoyo_diagnostico_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('N° Orden;N° Autorización;Fecha;Estudio / Procedimiento;Médico Especialista;Especialidad;EPS / Convenio;Tipo Ingreso;Horas Entrega\r\n')
    for (const r of rows) {
      res.write(`"${r.norden}";"${r.noaut}";"${r.fecha}";"${(r.servicio||'').replace(/"/g,'""')}";"${(r.medico||'').replace(/"/g,'""')}";"${r.especialidad}";"${(r.asegurador||'').replace(/"/g,'""')}";"${r.tipoingreso}";${r.tiempo_entrega_horas}\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 4: HISTORIA CLÍNICA (syn_hc)
// =====================================================================

indicadoresRouter.get('/hc/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_hc')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_atenciones,
        COUNT(CASE WHEN cerrada = 1 THEN 1 END)::int AS cerradas_oportunas,
        COUNT(DISTINCT idmedico)::int AS total_medicos,
        COUNT(DISTINCT iddx)::int AS total_diagnosticos
      FROM syn_hc
      ${where}
    `, params)

    const r = rows[0] || {}
    const total = Number(r.total_atenciones || 1)
    res.json({
      ...r,
      label_periodo: labelPeriodo,
      pct_cerradas: Number(((r.cerradas_oportunas / total) * 100).toFixed(1)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/hc/por-diagnostico', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_hc')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        iddx,
        COALESCE(diagnostico, 'CONSULTA GENERAL') AS diagnostico,
        COUNT(*)::int AS total_atenciones,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_hc ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_hc
      ${where} AND diagnostico IS NOT NULL AND diagnostico != ''
      GROUP BY iddx, diagnostico
      ORDER BY total_atenciones DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/hc/por-medico', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_hc')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        idmedico,
        COALESCE(medico, 'MEDICO TRATANTE') AS medico,
        COALESCE(especialidad, 'GENERAL') AS especialidad,
        COUNT(*)::int AS total_atenciones
      FROM syn_hc
      ${where} AND medico IS NOT NULL AND medico != ''
      GROUP BY idmedico, medico, especialidad
      ORDER BY total_atenciones DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/hc/por-especialidad', async (req, res) => {
  const limit = Number(req.query.limit) || 8
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_hc')

    const { rows } = await pool.query(`
      SELECT 
        COALESCE(especialidad, 'CONSULTA GENERAL') AS especialidad,
        COUNT(*)::int AS total_atenciones,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_hc ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_hc
      ${where}
      GROUP BY especialidad
      ORDER BY total_atenciones DESC
      LIMIT ${limit}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/hc/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COUNT(h.consecutivo)::int as total_atenciones
        FROM dias d
        LEFT JOIN syn_hc h ON h.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COUNT(h.consecutivo)::int as total_atenciones
        FROM dias d
        LEFT JOIN syn_hc h ON h.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COUNT(*)::int AS total_atenciones
      FROM syn_hc WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, total_atenciones: found ? found.total_atenciones : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/hc/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_hc')
    const { rows } = await pool.query(`
      SELECT consecutivo, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, COALESCE(medico, 'MEDICO') as medico, COALESCE(especialidad, 'GENERAL') as especialidad, iddx, COALESCE(diagnostico, 'DIAGNOSTICO') as diagnostico, ambito
      FROM syn_hc ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="historia_clinica_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('Consecutivo HC;Fecha Atención;Médico Tratante;Especialidad;CIE-10;Diagnóstico;Ámbito\r\n')
    for (const r of rows) {
      res.write(`"${r.consecutivo}";"${r.fecha}";"${(r.medico||'').replace(/"/g,'""')}";"${r.especialidad}";"${r.iddx}";"${(r.diagnostico||'').replace(/"/g,'""')}";"${r.ambito}"\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 5: RECAUDOS EN CAJA (syn_caja)
// =====================================================================

indicadoresRouter.get('/caja/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_caja')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_recibos,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(AVG(valor_total)::numeric, 0)::float AS ticket_promedio,
        COUNT(DISTINCT codcaja)::int AS total_cajas,
        COUNT(DISTINCT usuario)::int AS total_cajeros
      FROM syn_caja
      ${where}
    `, params)

    const r = rows[0] || {}
    res.json({
      ...r,
      label_periodo: labelPeriodo
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/caja/por-caja', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_caja')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        codcaja,
        COALESCE(caja_nombre, 'CAJA') AS caja_nombre,
        COUNT(*)::int AS total_recibos,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_caja ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_caja
      ${where}
      GROUP BY codcaja, caja_nombre
      ORDER BY valor_recaudado DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/caja/por-formapago', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_caja')
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(formapago, 'Efectivo') AS formapago,
        COUNT(*)::int AS total_recibos,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_caja ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_caja
      ${where}
      GROUP BY formapago
      ORDER BY valor_recaudado DESC
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/caja/por-tercero', async (req, res) => {
  const limit = Number(req.query.limit) || 8
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_caja')

    const { rows } = await pool.query(`
      SELECT 
        COALESCE(cliente, 'PARTICULAR') AS cliente,
        COUNT(*)::int AS total_recibos,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_caja ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_caja
      ${where}
      GROUP BY cliente
      ORDER BY valor_recaudado DESC
      LIMIT ${limit}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/caja/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COALESCE(SUM(c.valor_total), 0)::numeric(18,2) as valor_recaudado,
          COUNT(c.cnsfpag)::int as total_recibos
        FROM dias d
        LEFT JOIN syn_caja c ON c.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COALESCE(SUM(c.valor_total), 0)::numeric(18,2) as valor_recaudado,
          COUNT(c.cnsfpag)::int as total_recibos
        FROM dias d
        LEFT JOIN syn_caja c ON c.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado, COUNT(*)::int AS total_recibos
      FROM syn_caja WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, valor_recaudado: found ? Number(found.valor_recaudado) : 0, total_recibos: found ? found.total_recibos : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/caja/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_caja')
    const { rows } = await pool.query(`
      SELECT cnsfpag, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, caja_nombre, usuario, cliente, formapago, valor_total
      FROM syn_caja ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="recaudos_caja_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('N° Recibo;Fecha;Caja;Cajero;Cliente / Paciente;Forma Pago;Valor Recaudado\r\n')
    for (const r of rows) {
      res.write(`"${r.cnsfpag}";"${r.fecha}";"${r.caja_nombre}";"${r.usuario}";"${(r.cliente||'').replace(/"/g,'""')}";"${r.formapago}";${Number(r.valor_total||0).toFixed(0)}\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 6: RECAUDOS EN BANCOS (syn_bancos)
// =====================================================================

indicadoresRouter.get('/bancos/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_bancos')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_operaciones,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        COALESCE(SUM(CASE WHEN tipo_canal = 'Giro Directo ADRES' THEN valor_total ELSE 0 END), 0)::numeric(18,2) AS giro_directo_monto,
        COALESCE(SUM(CASE WHEN tipo_canal != 'Giro Directo ADRES' THEN valor_total ELSE 0 END), 0)::numeric(18,2) AS consignacion_eps_monto,
        COUNT(DISTINCT banco)::int AS total_bancos
      FROM syn_bancos
      ${where}
    `, params)

    const r = rows[0] || {}
    const totalV = Number(r.valor_recaudado || 1)
    res.json({
      ...r,
      label_periodo: labelPeriodo,
      pct_giro_directo: Number(((r.giro_directo_monto / totalV) * 100).toFixed(1)),
      pct_consignacion_eps: Number(((r.consignacion_eps_monto / totalV) * 100).toFixed(1)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/bancos/por-banco', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_bancos')
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(banco, 'BANCOLOMBIA') AS banco,
        COALESCE(cuenta, 'PRINCIPAL') AS cuenta,
        COUNT(*)::int AS total_operaciones,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_bancos ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_bancos
      ${where}
      GROUP BY banco, cuenta
      ORDER BY valor_recaudado DESC
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/bancos/por-canal', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_bancos')
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(tipo_canal, 'Consignación Directa EPS') AS tipo_canal,
        COUNT(*)::int AS total_operaciones,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_bancos ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_bancos
      ${where}
      GROUP BY tipo_canal
      ORDER BY valor_recaudado DESC
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/bancos/por-asegurador', async (req, res) => {
  const limit = Number(req.query.limit) || 8
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_bancos')

    const { rows } = await pool.query(`
      SELECT 
        COALESCE(asegurador, 'ENTIDAD ASEGURADORA') AS asegurador,
        COUNT(*)::int AS total_operaciones,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_bancos ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_bancos
      ${where}
      GROUP BY asegurador
      ORDER BY valor_recaudado DESC
      LIMIT ${limit}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/bancos/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COALESCE(SUM(b.valor_total), 0)::numeric(18,2) as valor_recaudado,
          COUNT(b.cnsfpag)::int as total_operaciones
        FROM dias d
        LEFT JOIN syn_bancos b ON b.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COALESCE(SUM(b.valor_total), 0)::numeric(18,2) as valor_recaudado,
          COUNT(b.cnsfpag)::int as total_operaciones
        FROM dias d
        LEFT JOIN syn_bancos b ON b.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado, COUNT(*)::int AS total_operaciones
      FROM syn_bancos WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, valor_recaudado: found ? Number(found.valor_recaudado) : 0, total_operaciones: found ? found.total_operaciones : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/bancos/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_bancos')
    const { rows } = await pool.query(`
      SELECT cnsfpag, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, banco, cuenta, asegurador, tipo_canal, valor_total
      FROM syn_bancos ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="recaudos_bancos_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('N° Operación;Fecha;Banco;Cuenta;Entidad Aseguradora;Canal de Ingreso;Valor Recaudado\r\n')
    for (const r of rows) {
      res.write(`"${r.cnsfpag}";"${r.fecha}";"${r.banco}";"${r.cuenta}";"${(r.asegurador||'').replace(/"/g,'""')}";"${r.tipo_canal}";${Number(r.valor_total||0).toFixed(0)}\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 7: SIAU / SATISFACCIÓN DEL USUARIO (syn_siau)
// =====================================================================

indicadoresRouter.get('/siau/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_siau')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_encuestas,
        COUNT(CASE WHEN es_satisfecho = 1 THEN 1 END)::int AS satisfechos,
        COUNT(CASE WHEN calificacion = 'Excelente' THEN 1 END)::int AS excelente,
        COUNT(CASE WHEN calificacion = 'Buena' THEN 1 END)::int AS buena,
        COUNT(CASE WHEN calificacion IN ('Regular', 'Mala') THEN 1 END)::int AS regular_mala
      FROM syn_siau
      ${where}
    `, params)

    const r = rows[0] || {}
    const total = Number(r.total_encuestas || 1)
    res.json({
      ...r,
      label_periodo: labelPeriodo,
      pct_satisfaccion: Number(((r.satisfechos / total) * 100).toFixed(1)),
      pct_excelente: Number(((r.excelente / total) * 100).toFixed(1)),
      pct_insatisfaccion: Number(((r.regular_mala / total) * 100).toFixed(1)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/siau/por-servicio', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_siau')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        COALESCE(servicio, 'CONSULTA EXTERNA') AS servicio,
        COUNT(*)::int AS total_encuestas,
        COUNT(CASE WHEN es_satisfecho = 1 THEN 1 END)::int AS satisfechos,
        ROUND(
          COUNT(CASE WHEN es_satisfecho = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
          1
        )::float AS pct_satisfaccion
      FROM syn_siau
      ${where}
      GROUP BY servicio
      ORDER BY total_encuestas DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/siau/por-calificacion', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_siau')
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(calificacion, 'Buena') AS calificacion,
        COUNT(*)::int AS total_encuestas,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_siau ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_siau
      ${where}
      GROUP BY calificacion
      ORDER BY total_encuestas DESC
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/siau/por-asegurador', async (req, res) => {
  const limit = Number(req.query.limit) || 8
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_siau')

    const { rows } = await pool.query(`
      SELECT 
        COALESCE(asegurador, 'PARTICULAR / OTROS') AS asegurador,
        COUNT(*)::int AS total_encuestas,
        ROUND(
          COUNT(CASE WHEN es_satisfecho = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
          1
        )::float AS pct_satisfaccion
      FROM syn_siau
      ${where}
      GROUP BY asegurador
      ORDER BY total_encuestas DESC
      LIMIT ${limit}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/siau/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COUNT(s.idencu)::int as total_encuestas,
          COUNT(CASE WHEN s.es_satisfecho = 1 THEN 1 END)::int as satisfechos
        FROM dias d
        LEFT JOIN syn_siau s ON s.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COUNT(s.idencu)::int as total_encuestas,
          COUNT(CASE WHEN s.es_satisfecho = 1 THEN 1 END)::int as satisfechos
        FROM dias d
        LEFT JOIN syn_siau s ON s.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COUNT(*)::int AS total_encuestas, COUNT(CASE WHEN es_satisfecho = 1 THEN 1 END)::int AS satisfechos
      FROM syn_siau WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, total_encuestas: found ? found.total_encuestas : 0, satisfechos: found ? found.satisfechos : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/siau/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_siau')
    const { rows } = await pool.query(`
      SELECT idencu, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, afiliado_nombre, servicio, asegurador, calificacion, observacion
      FROM syn_siau ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="satisfaccion_siau_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('ID Encuesta;Fecha;Usuario / Paciente;Servicio Evaluado;EPS Aseguradora;Calificación;Observación\r\n')
    for (const r of rows) {
      res.write(`"${r.idencu}";"${r.fecha}";"${(r.afiliado_nombre||'').replace(/"/g,'""')}";"${(r.servicio||'').replace(/"/g,'""')}";"${(r.asegurador||'').replace(/"/g,'""')}";"${r.calificacion}";"${(r.observacion||'').replace(/"/g,'""')}"\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


indicadoresRouter.get('/hc/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COUNT(h.consecutivo)::int as total_atenciones
        FROM dias d
        LEFT JOIN syn_hc h ON h.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COUNT(h.consecutivo)::int as total_atenciones
        FROM dias d
        LEFT JOIN syn_hc h ON h.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COUNT(*)::int AS total_atenciones
      FROM syn_hc WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, total_atenciones: found ? found.total_atenciones : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/hc/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_hc')
    const { rows } = await pool.query(`
      SELECT consecutivo, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, COALESCE(medico, 'MEDICO') as medico, COALESCE(especialidad, 'GENERAL') as especialidad, iddx, COALESCE(diagnostico, 'DIAGNOSTICO') as diagnostico, ambito
      FROM syn_hc ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="historia_clinica_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('Consecutivo HC;Fecha Atención;Médico Tratante;Especialidad;CIE-10;Diagnóstico;Ámbito\r\n')
    for (const r of rows) {
      res.write(`"${r.consecutivo}";"${r.fecha}";"${(r.medico||'').replace(/"/g,'""')}";"${r.especialidad}";"${r.iddx}";"${(r.diagnostico||'').replace(/"/g,'""')}";"${r.ambito}"\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 5: RECAUDOS EN CAJA (syn_caja)
// =====================================================================

indicadoresRouter.get('/caja/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_caja')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_recibos,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(AVG(valor_total)::numeric, 0)::float AS ticket_promedio,
        COUNT(DISTINCT codcaja)::int AS total_cajas,
        COUNT(DISTINCT usuario)::int AS total_cajeros
      FROM syn_caja
      ${where}
    `, params)

    const r = rows[0] || {}
    res.json({
      ...r,
      label_periodo: labelPeriodo
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/caja/por-caja', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_caja')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        codcaja,
        COALESCE(caja_nombre, 'CAJA') AS caja_nombre,
        COUNT(*)::int AS total_recibos,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_caja ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_caja
      ${where}
      GROUP BY codcaja, caja_nombre
      ORDER BY valor_recaudado DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/caja/por-formapago', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_caja')
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(formapago, 'Efectivo') AS formapago,
        COUNT(*)::int AS total_recibos,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_caja ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_caja
      ${where}
      GROUP BY formapago
      ORDER BY valor_recaudado DESC
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/caja/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COALESCE(SUM(c.valor_total), 0)::numeric(18,2) as valor_recaudado,
          COUNT(c.cnsfpag)::int as total_recibos
        FROM dias d
        LEFT JOIN syn_caja c ON c.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COALESCE(SUM(c.valor_total), 0)::numeric(18,2) as valor_recaudado,
          COUNT(c.cnsfpag)::int as total_recibos
        FROM dias d
        LEFT JOIN syn_caja c ON c.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado, COUNT(*)::int AS total_recibos
      FROM syn_caja WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, valor_recaudado: found ? Number(found.valor_recaudado) : 0, total_recibos: found ? found.total_recibos : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/caja/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_caja')
    const { rows } = await pool.query(`
      SELECT cnsfpag, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, caja_nombre, usuario, cliente, formapago, valor_total
      FROM syn_caja ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="recaudos_caja_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('N° Recibo;Fecha;Caja;Cajero;Cliente / Paciente;Forma Pago;Valor Recaudado\r\n')
    for (const r of rows) {
      res.write(`"${r.cnsfpag}";"${r.fecha}";"${r.caja_nombre}";"${r.usuario}";"${(r.cliente||'').replace(/"/g,'""')}";"${r.formapago}";${Number(r.valor_total||0).toFixed(0)}\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 6: RECAUDOS EN BANCOS (syn_bancos)
// =====================================================================

indicadoresRouter.get('/bancos/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_bancos')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_operaciones,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        COALESCE(SUM(CASE WHEN tipo_canal = 'Giro Directo ADRES' THEN valor_total ELSE 0 END), 0)::numeric(18,2) AS giro_directo_monto,
        COALESCE(SUM(CASE WHEN tipo_canal != 'Giro Directo ADRES' THEN valor_total ELSE 0 END), 0)::numeric(18,2) AS consignacion_eps_monto,
        COUNT(DISTINCT banco)::int AS total_bancos
      FROM syn_bancos
      ${where}
    `, params)

    const r = rows[0] || {}
    const totalV = Number(r.valor_recaudado || 1)
    res.json({
      ...r,
      label_periodo: labelPeriodo,
      pct_giro_directo: Number(((r.giro_directo_monto / totalV) * 100).toFixed(1)),
      pct_consignacion_eps: Number(((r.consignacion_eps_monto / totalV) * 100).toFixed(1)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/bancos/por-banco', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_bancos')
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(banco, 'BANCOLOMBIA') AS banco,
        COALESCE(cuenta, 'PRINCIPAL') AS cuenta,
        COUNT(*)::int AS total_operaciones,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_bancos ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_bancos
      ${where}
      GROUP BY banco, cuenta
      ORDER BY valor_recaudado DESC
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/bancos/por-canal', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_bancos')
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(tipo_canal, 'Consignación Directa EPS') AS tipo_canal,
        COUNT(*)::int AS total_operaciones,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_bancos ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_bancos
      ${where}
      GROUP BY tipo_canal
      ORDER BY valor_recaudado DESC
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/bancos/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COALESCE(SUM(b.valor_total), 0)::numeric(18,2) as valor_recaudado,
          COUNT(b.cnsfpag)::int as total_operaciones
        FROM dias d
        LEFT JOIN syn_bancos b ON b.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COALESCE(SUM(b.valor_total), 0)::numeric(18,2) as valor_recaudado,
          COUNT(b.cnsfpag)::int as total_operaciones
        FROM dias d
        LEFT JOIN syn_bancos b ON b.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado, COUNT(*)::int AS total_operaciones
      FROM syn_bancos WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, valor_recaudado: found ? Number(found.valor_recaudado) : 0, total_operaciones: found ? found.total_operaciones : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/bancos/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_bancos')
    const { rows } = await pool.query(`
      SELECT cnsfpag, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, banco, cuenta, asegurador, tipo_canal, valor_total
      FROM syn_bancos ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="recaudos_bancos_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('N° Operación;Fecha;Banco;Cuenta;Entidad Aseguradora;Canal de Ingreso;Valor Recaudado\r\n')
    for (const r of rows) {
      res.write(`"${r.cnsfpag}";"${r.fecha}";"${r.banco}";"${r.cuenta}";"${(r.asegurador||'').replace(/"/g,'""')}";"${r.tipo_canal}";${Number(r.valor_total||0).toFixed(0)}\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 7: SIAU / SATISFACCIÓN DEL USUARIO (syn_siau)
// =====================================================================

indicadoresRouter.get('/siau/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_siau')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_encuestas,
        COUNT(CASE WHEN es_satisfecho = 1 THEN 1 END)::int AS satisfechos,
        COUNT(CASE WHEN calificacion = 'Excelente' THEN 1 END)::int AS excelente,
        COUNT(CASE WHEN calificacion = 'Buena' THEN 1 END)::int AS buena,
        COUNT(CASE WHEN calificacion IN ('Regular', 'Mala') THEN 1 END)::int AS regular_mala
      FROM syn_siau
      ${where}
    `, params)

    const r = rows[0] || {}
    const total = Number(r.total_encuestas || 1)
    res.json({
      ...r,
      label_periodo: labelPeriodo,
      pct_satisfaccion: Number(((r.satisfechos / total) * 100).toFixed(1)),
      pct_excelente: Number(((r.excelente / total) * 100).toFixed(1)),
      pct_insatisfaccion: Number(((r.regular_mala / total) * 100).toFixed(1)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/siau/por-servicio', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_siau')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        COALESCE(servicio, 'CONSULTA EXTERNA') AS servicio,
        COUNT(*)::int AS total_encuestas,
        COUNT(CASE WHEN es_satisfecho = 1 THEN 1 END)::int AS satisfechos,
        ROUND(
          COUNT(CASE WHEN es_satisfecho = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
          1
        )::float AS pct_satisfaccion
      FROM syn_siau
      ${where}
      GROUP BY servicio
      ORDER BY total_encuestas DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/siau/por-calificacion', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_siau')
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(calificacion, 'Buena') AS calificacion,
        COUNT(*)::int AS total_encuestas,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_siau ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_siau
      ${where}
      GROUP BY calificacion
      ORDER BY total_encuestas DESC
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/siau/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COUNT(s.idencu)::int as total_encuestas,
          COUNT(CASE WHEN s.es_satisfecho = 1 THEN 1 END)::int as satisfechos
        FROM dias d
        LEFT JOIN syn_siau s ON s.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COUNT(s.idencu)::int as total_encuestas,
          COUNT(CASE WHEN s.es_satisfecho = 1 THEN 1 END)::int as satisfechos
        FROM dias d
        LEFT JOIN syn_siau s ON s.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COUNT(*)::int AS total_encuestas, COUNT(CASE WHEN es_satisfecho = 1 THEN 1 END)::int AS satisfechos
      FROM syn_siau WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, total_encuestas: found ? found.total_encuestas : 0, satisfechos: found ? found.satisfechos : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/siau/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_siau')
    const { rows } = await pool.query(`
      SELECT idencu, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, afiliado_nombre, servicio, asegurador, calificacion, observacion
      FROM syn_siau ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="satisfaccion_siau_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('ID Encuesta;Fecha;Usuario / Paciente;Servicio Evaluado;EPS Aseguradora;Calificación;Observación\r\n')
    for (const r of rows) {
      res.write(`"${r.idencu}";"${r.fecha}";"${(r.afiliado_nombre||'').replace(/"/g,'""')}";"${(r.servicio||'').replace(/"/g,'""')}";"${(r.asegurador||'').replace(/"/g,'""')}";"${r.calificacion}";"${(r.observacion||'').replace(/"/g,'""')}"\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 2: AUTORIZACIONES MÉDICAS
// =====================================================================

// 7. Resumen Ejecutivo de Autorizaciones (con filtro dinámico)
indicadoresRouter.get('/autorizaciones/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildAutorizacionesFilter(req.query)

    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_autorizaciones,
        COUNT(CASE WHEN facturada = 1 THEN 1 END)::int AS facturadas,
        COUNT(CASE WHEN facturada = 0 AND estado != 'Anulada' THEN 1 END)::int AS pendientes_facturar,
        COUNT(CASE WHEN tiene_num_autoriza = 1 THEN 1 END)::int AS con_num_autoriza,
        COUNT(CASE WHEN tiene_num_autoriza = 0 THEN 1 END)::int AS sin_num_autoriza,
        COUNT(CASE WHEN estado = 'Anulada' THEN 1 END)::int AS anuladas,
        ROUND(AVG(dias_tramite)::numeric, 1)::float AS dias_tramite_promedio,
        ROUND(AVG(dias_vigencia)::numeric, 1)::float AS dias_vigencia_promedio,
        COUNT(DISTINCT idcontratante)::int AS total_aseguradores,
        COUNT(DISTINCT idservicio_ppal)::int AS total_servicios,
        COALESCE(SUM(valortotal), 0)::numeric(18,2) AS valor_total,
        COALESCE(SUM(CASE WHEN facturada = 1 THEN valortotal ELSE 0 END), 0)::numeric(18,2) AS valor_facturado,
        COALESCE(SUM(CASE WHEN facturada = 0 AND estado != 'Anulada' THEN valortotal ELSE 0 END), 0)::numeric(18,2) AS valor_pendiente_facturar,
        COALESCE(SUM(valorcopago), 0)::numeric(18,2) AS valor_copagos
      FROM syn_autorizaciones
      ${where}
    `, params)

    const r = rows[0] || {}
    const total = Number(r.total_autorizaciones || 1)

    res.json({
      ...r,
      label_periodo: labelPeriodo,
      pct_facturadas: Number(((r.facturadas / total) * 100).toFixed(1)),
      pct_pendientes: Number(((r.pendientes_facturar / total) * 100).toFixed(1)),
      pct_con_autoriza: Number(((r.con_num_autoriza / total) * 100).toFixed(1)),
      pct_anuladas: Number(((r.anuladas / total) * 100).toFixed(1)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 8. Top Servicios / Procedimientos Autorizados (con filtro dinámico)
indicadoresRouter.get('/autorizaciones/por-servicio', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildAutorizacionesFilter(req.query)
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        idservicio_ppal AS idservicio,
        COALESCE(servicio_ppal, 'CONSULTA / PROCEDIMIENTO GENERAL') AS servicio,
        COUNT(*)::int AS total_autorizaciones,
        COUNT(CASE WHEN facturada = 1 THEN 1 END)::int AS facturadas,
        COUNT(CASE WHEN facturada = 0 AND estado != 'Anulada' THEN 1 END)::int AS pendientes,
        COALESCE(SUM(valortotal), 0)::numeric(18,2) AS valor_total,
        ROUND(
          COUNT(CASE WHEN facturada = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
          1
        )::float AS pct_facturado
      FROM syn_autorizaciones
      ${where} AND servicio_ppal IS NOT NULL AND servicio_ppal != ''
      GROUP BY idservicio_ppal, servicio_ppal
      ORDER BY total_autorizaciones DESC
      LIMIT $${limitIdx}
    `, params)

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 9. Top Aseguradores / EPS en Autorizaciones (con filtro dinámico)
indicadoresRouter.get('/autorizaciones/por-asegurador', async (req, res) => {
  const limit = Number(req.query.limit) || 8
  try {
    const { where, params } = buildAutorizacionesFilter(req.query)
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        idcontratante,
        COALESCE(asegurador, 'PARTICULAR / OTROS') AS asegurador,
        COUNT(*)::int AS total_autorizaciones,
        COUNT(CASE WHEN facturada = 1 THEN 1 END)::int AS facturadas,
        COUNT(CASE WHEN facturada = 0 AND estado != 'Anulada' THEN 1 END)::int AS pendientes,
        COALESCE(SUM(valortotal), 0)::numeric(18,2) AS valor_total,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_autorizaciones ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_autorizaciones
      ${where}
      GROUP BY idcontratante, asegurador
      ORDER BY total_autorizaciones DESC
      LIMIT $${limitIdx}
    `, params)

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 10. Tendencia Temporal de Autorizaciones (Día a día o Mes a mes)
indicadoresRouter.get('/autorizaciones/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT 
            DATE_TRUNC('week', '2026-11-15'::date) as inicio,
            (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (
          SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia
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
          END as label,
          COUNT(a.idaut)::int as total_autorizaciones,
          COUNT(CASE WHEN a.facturada = 1 THEN 1 END)::int as facturadas,
          COUNT(CASE WHEN a.facturada = 0 AND a.estado != 'Anulada' THEN 1 END)::int as pendientes
        FROM dias d
        LEFT JOIN syn_autorizaciones a ON a.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }

    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT 
            DATE_TRUNC('month', '2026-11-15'::date) as inicio,
            (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (
          SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia
        )
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COUNT(a.idaut)::int as total_autorizaciones,
          COUNT(CASE WHEN a.facturada = 1 THEN 1 END)::int as facturadas,
          COUNT(CASE WHEN a.facturada = 0 AND a.estado != 'Anulada' THEN 1 END)::int as pendientes
        FROM dias d
        LEFT JOIN syn_autorizaciones a ON a.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }

    // Default: Anual (Mes a mes)
    const { rows } = await pool.query(`
      SELECT 
        mes,
        COUNT(*)::int AS total_autorizaciones,
        COUNT(CASE WHEN facturada = 1 THEN 1 END)::int AS facturadas,
        COUNT(CASE WHEN facturada = 0 AND estado != 'Anulada' THEN 1 END)::int AS pendientes,
        COUNT(CASE WHEN estado = 'Anulada' THEN 1 END)::int AS anuladas,
        COALESCE(SUM(valortotal), 0)::numeric(18,2) AS valor_total
      FROM syn_autorizaciones
      WHERE anio = 2026
      GROUP BY mes
      ORDER BY mes ASC
    `)

    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const mesesCompletos = Array.from({ length: 12 }, (_, i) => {
      const num = i + 1
      const found = rows.find(r => r.mes === num)
      return {
        label: nombresMeses[i],
        total_autorizaciones: found ? found.total_autorizaciones : 0,
        facturadas: found ? found.facturadas : 0,
        pendientes: found ? found.pendientes : 0,
        anuladas: found ? found.anuladas : 0,
        valor_total: found ? Number(found.valor_total) : 0,
      }
    })

    res.json({ tipo: 'anio', categorias: nombresMeses, data: mesesCompletos })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 11. Exportación de Autorizaciones a Excel / CSV con UTF-8 BOM
indicadoresRouter.get('/autorizaciones/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildAutorizacionesFilter(req.query)

    const { rows } = await pool.query(`
      SELECT 
        idaut,
        noaut,
        TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha_autorizacion,
        TO_CHAR(fechavence, 'YYYY-MM-DD') AS fecha_vencimiento,
        COALESCE(asegurador, 'PARTICULAR') AS asegurador,
        COALESCE(servicio_ppal, 'CONSULTA GENERAL') AS servicio,
        estado,
        CASE WHEN facturada = 1 THEN 'Sí' ELSE 'No' END AS facturada,
        COALESCE(n_factura, '') AS n_factura,
        COALESCE(numautoriza, '') AS num_volante_eps,
        valortotal,
        valorcopago
      FROM syn_autorizaciones
      ${where}
      ORDER BY fecha DESC, idaut DESC
      LIMIT 10000
    `, params)

    const filename = `autorizaciones_clinica_esperanza_${req.query.periodo || 'semana'}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.write('\ufeff')
    res.write('ID Autorización;N° Autorización;Fecha Emisión;Fecha Vencimiento;Asegurador / EPS;Servicio / Procedimiento;Estado;¿Facturada?;N° Factura;N° Volante EPS;Valor Total;Valor Copago\r\n')

    for (const r of rows) {
      const line = [
        `"${r.idaut || ''}"`,
        `"${r.noaut || ''}"`,
        `"${r.fecha_autorizacion || ''}"`,
        `"${r.fecha_vencimiento || ''}"`,
        `"${(r.asegurador || '').replace(/"/g, '""')}"`,
        `"${(r.servicio || '').replace(/"/g, '""')}"`,
        `"${r.estado || ''}"`,
        `"${r.facturada || ''}"`,
        `"${r.n_factura || ''}"`,
        `"${r.num_volante_eps || ''}"`,
        Number(r.valortotal || 0).toFixed(0),
        Number(r.valorcopago || 0).toFixed(0)
      ].join(';')
      res.write(line + '\r\n')
    }

    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 3: RESULTADOS DE APOYO DIAGNÓSTICO (syn_apoyo)
// =====================================================================

indicadoresRouter.get('/apoyo/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_apoyo')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_estudios,
        ROUND(AVG(tiempo_entrega_horas)::numeric, 1)::float AS tiempo_entrega_promedio,
        COUNT(DISTINCT idservicio)::int AS total_servicios,
        COUNT(DISTINCT idmedico)::int AS total_medicos,
        COUNT(DISTINCT asegurador)::int AS total_aseguradores,
        COUNT(CASE WHEN tiempo_entrega_horas <= 24 THEN 1 END)::int AS oportunos_24h
      FROM syn_apoyo
      ${where}
    `, params)

    const r = rows[0] || {}
    const total = Number(r.total_estudios || 1)
    res.json({
      ...r,
      label_periodo: labelPeriodo,
      pct_oportunidad_24h: Number(((r.oportunos_24h / total) * 100).toFixed(1)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/apoyo/por-servicio', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_apoyo')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        idservicio,
        COALESCE(servicio, 'ESTUDIO GENERAL') AS servicio,
        COUNT(*)::int AS total_estudios,
        ROUND(AVG(tiempo_entrega_horas)::numeric, 1)::float AS tiempo_promedio,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_apoyo ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_apoyo
      ${where} AND servicio IS NOT NULL AND servicio != ''
      GROUP BY idservicio, servicio
      ORDER BY total_estudios DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/apoyo/por-medico', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_apoyo')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        idmedico,
        COALESCE(medico, 'MEDICO INFORMANTE') AS medico,
        COALESCE(especialidad, 'ESPECIALISTA') AS especialidad,
        COUNT(*)::int AS total_estudios,
        ROUND(AVG(tiempo_entrega_horas)::numeric, 1)::float AS tiempo_promedio
      FROM syn_apoyo
      ${where} AND medico IS NOT NULL AND medico != ''
      GROUP BY idmedico, medico, especialidad
      ORDER BY total_estudios DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/apoyo/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COUNT(a.norden)::int as total_estudios
        FROM dias d
        LEFT JOIN syn_apoyo a ON a.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COUNT(a.norden)::int as total_estudios
        FROM dias d
        LEFT JOIN syn_apoyo a ON a.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COUNT(*)::int AS total_estudios
      FROM syn_apoyo WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, total_estudios: found ? found.total_estudios : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/apoyo/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_apoyo')
    const { rows } = await pool.query(`
      SELECT norden, noaut, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, COALESCE(servicio, 'ESTUDIO') as servicio, COALESCE(medico, 'MEDICO') as medico, COALESCE(especialidad, 'GENERAL') as especialidad, COALESCE(asegurador, 'PARTICULAR') as asegurador, tipoingreso, tiempo_entrega_horas
      FROM syn_apoyo ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="apoyo_diagnostico_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('N° Orden;N° Autorización;Fecha;Estudio / Procedimiento;Médico Especialista;Especialidad;EPS / Convenio;Tipo Ingreso;Horas Entrega\r\n')
    for (const r of rows) {
      res.write(`"${r.norden}";"${r.noaut}";"${r.fecha}";"${(r.servicio||'').replace(/"/g,'""')}";"${(r.medico||'').replace(/"/g,'""')}";"${r.especialidad}";"${(r.asegurador||'').replace(/"/g,'""')}";"${r.tipoingreso}";${r.tiempo_entrega_horas}\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 4: HISTORIA CLÍNICA (syn_hc)
// =====================================================================

indicadoresRouter.get('/hc/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_hc')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_atenciones,
        COUNT(CASE WHEN cerrada = 1 THEN 1 END)::int AS cerradas_oportunas,
        COUNT(DISTINCT idmedico)::int AS total_medicos,
        COUNT(DISTINCT iddx)::int AS total_diagnosticos
      FROM syn_hc
      ${where}
    `, params)

    const r = rows[0] || {}
    const total = Number(r.total_atenciones || 1)
    res.json({
      ...r,
      label_periodo: labelPeriodo,
      pct_cerradas: Number(((r.cerradas_oportunas / total) * 100).toFixed(1)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/hc/por-diagnostico', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_hc')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        iddx,
        COALESCE(diagnostico, 'CONSULTA GENERAL') AS diagnostico,
        COUNT(*)::int AS total_atenciones,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_hc ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_hc
      ${where} AND diagnostico IS NOT NULL AND diagnostico != ''
      GROUP BY iddx, diagnostico
      ORDER BY total_atenciones DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/hc/por-medico', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_hc')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        idmedico,
        COALESCE(medico, 'MEDICO TRATANTE') AS medico,
        COALESCE(especialidad, 'GENERAL') AS especialidad,
        COUNT(*)::int AS total_atenciones
      FROM syn_hc
      ${where} AND medico IS NOT NULL AND medico != ''
      GROUP BY idmedico, medico, especialidad
      ORDER BY total_atenciones DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/hc/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COUNT(h.consecutivo)::int as total_atenciones
        FROM dias d
        LEFT JOIN syn_hc h ON h.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COUNT(h.consecutivo)::int as total_atenciones
        FROM dias d
        LEFT JOIN syn_hc h ON h.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COUNT(*)::int AS total_atenciones
      FROM syn_hc WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, total_atenciones: found ? found.total_atenciones : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/hc/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_hc')
    const { rows } = await pool.query(`
      SELECT consecutivo, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, COALESCE(medico, 'MEDICO') as medico, COALESCE(especialidad, 'GENERAL') as especialidad, iddx, COALESCE(diagnostico, 'DIAGNOSTICO') as diagnostico, ambito
      FROM syn_hc ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="historia_clinica_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('Consecutivo HC;Fecha Atención;Médico Tratante;Especialidad;CIE-10;Diagnóstico;Ámbito\r\n')
    for (const r of rows) {
      res.write(`"${r.consecutivo}";"${r.fecha}";"${(r.medico||'').replace(/"/g,'""')}";"${r.especialidad}";"${r.iddx}";"${(r.diagnostico||'').replace(/"/g,'""')}";"${r.ambito}"\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 5: RECAUDOS EN CAJA (syn_caja)
// =====================================================================

indicadoresRouter.get('/caja/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_caja')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_recibos,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(AVG(valor_total)::numeric, 0)::float AS ticket_promedio,
        COUNT(DISTINCT codcaja)::int AS total_cajas,
        COUNT(DISTINCT usuario)::int AS total_cajeros
      FROM syn_caja
      ${where}
    `, params)

    const r = rows[0] || {}
    res.json({
      ...r,
      label_periodo: labelPeriodo
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/caja/por-caja', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_caja')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        codcaja,
        COALESCE(caja_nombre, 'CAJA') AS caja_nombre,
        COUNT(*)::int AS total_recibos,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_caja ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_caja
      ${where}
      GROUP BY codcaja, caja_nombre
      ORDER BY valor_recaudado DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/caja/por-formapago', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_caja')
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(formapago, 'Efectivo') AS formapago,
        COUNT(*)::int AS total_recibos,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_caja ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_caja
      ${where}
      GROUP BY formapago
      ORDER BY valor_recaudado DESC
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/caja/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COALESCE(SUM(c.valor_total), 0)::numeric(18,2) as valor_recaudado,
          COUNT(c.cnsfpag)::int as total_recibos
        FROM dias d
        LEFT JOIN syn_caja c ON c.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COALESCE(SUM(c.valor_total), 0)::numeric(18,2) as valor_recaudado,
          COUNT(c.cnsfpag)::int as total_recibos
        FROM dias d
        LEFT JOIN syn_caja c ON c.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado, COUNT(*)::int AS total_recibos
      FROM syn_caja WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, valor_recaudado: found ? Number(found.valor_recaudado) : 0, total_recibos: found ? found.total_recibos : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/caja/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_caja')
    const { rows } = await pool.query(`
      SELECT cnsfpag, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, caja_nombre, usuario, cliente, formapago, valor_total
      FROM syn_caja ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="recaudos_caja_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('N° Recibo;Fecha;Caja;Cajero;Cliente / Paciente;Forma Pago;Valor Recaudado\r\n')
    for (const r of rows) {
      res.write(`"${r.cnsfpag}";"${r.fecha}";"${r.caja_nombre}";"${r.usuario}";"${(r.cliente||'').replace(/"/g,'""')}";"${r.formapago}";${Number(r.valor_total||0).toFixed(0)}\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 6: RECAUDOS EN BANCOS (syn_bancos)
// =====================================================================

indicadoresRouter.get('/bancos/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_bancos')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_operaciones,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        COALESCE(SUM(CASE WHEN tipo_canal = 'Giro Directo ADRES' THEN valor_total ELSE 0 END), 0)::numeric(18,2) AS giro_directo_monto,
        COALESCE(SUM(CASE WHEN tipo_canal != 'Giro Directo ADRES' THEN valor_total ELSE 0 END), 0)::numeric(18,2) AS consignacion_eps_monto,
        COUNT(DISTINCT banco)::int AS total_bancos
      FROM syn_bancos
      ${where}
    `, params)

    const r = rows[0] || {}
    const totalV = Number(r.valor_recaudado || 1)
    res.json({
      ...r,
      label_periodo: labelPeriodo,
      pct_giro_directo: Number(((r.giro_directo_monto / totalV) * 100).toFixed(1)),
      pct_consignacion_eps: Number(((r.consignacion_eps_monto / totalV) * 100).toFixed(1)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/bancos/por-banco', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_bancos')
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(banco, 'BANCOLOMBIA') AS banco,
        COALESCE(cuenta, 'PRINCIPAL') AS cuenta,
        COUNT(*)::int AS total_operaciones,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_bancos ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_bancos
      ${where}
      GROUP BY banco, cuenta
      ORDER BY valor_recaudado DESC
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/bancos/por-canal', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_bancos')
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(tipo_canal, 'Consignación Directa EPS') AS tipo_canal,
        COUNT(*)::int AS total_operaciones,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_bancos ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_bancos
      ${where}
      GROUP BY tipo_canal
      ORDER BY valor_recaudado DESC
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/bancos/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COALESCE(SUM(b.valor_total), 0)::numeric(18,2) as valor_recaudado,
          COUNT(b.cnsfpag)::int as total_operaciones
        FROM dias d
        LEFT JOIN syn_bancos b ON b.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COALESCE(SUM(b.valor_total), 0)::numeric(18,2) as valor_recaudado,
          COUNT(b.cnsfpag)::int as total_operaciones
        FROM dias d
        LEFT JOIN syn_bancos b ON b.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado, COUNT(*)::int AS total_operaciones
      FROM syn_bancos WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, valor_recaudado: found ? Number(found.valor_recaudado) : 0, total_operaciones: found ? found.total_operaciones : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/bancos/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_bancos')
    const { rows } = await pool.query(`
      SELECT cnsfpag, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, banco, cuenta, asegurador, tipo_canal, valor_total
      FROM syn_bancos ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="recaudos_bancos_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('N° Operación;Fecha;Banco;Cuenta;Entidad Aseguradora;Canal de Ingreso;Valor Recaudado\r\n')
    for (const r of rows) {
      res.write(`"${r.cnsfpag}";"${r.fecha}";"${r.banco}";"${r.cuenta}";"${(r.asegurador||'').replace(/"/g,'""')}";"${r.tipo_canal}";${Number(r.valor_total||0).toFixed(0)}\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =====================================================================
// ENDPOINTS PROCESO 7: SIAU / SATISFACCIÓN DEL USUARIO (syn_siau)
// =====================================================================

indicadoresRouter.get('/siau/kpis', async (req, res) => {
  try {
    const { where, params, labelPeriodo } = buildPeriodFilter(req.query, 'syn_siau')
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_encuestas,
        COUNT(CASE WHEN es_satisfecho = 1 THEN 1 END)::int AS satisfechos,
        COUNT(CASE WHEN calificacion = 'Excelente' THEN 1 END)::int AS excelente,
        COUNT(CASE WHEN calificacion = 'Buena' THEN 1 END)::int AS buena,
        COUNT(CASE WHEN calificacion IN ('Regular', 'Mala') THEN 1 END)::int AS regular_mala
      FROM syn_siau
      ${where}
    `, params)

    const r = rows[0] || {}
    const total = Number(r.total_encuestas || 1)
    res.json({
      ...r,
      label_periodo: labelPeriodo,
      pct_satisfaccion: Number(((r.satisfechos / total) * 100).toFixed(1)),
      pct_excelente: Number(((r.excelente / total) * 100).toFixed(1)),
      pct_insatisfaccion: Number(((r.regular_mala / total) * 100).toFixed(1)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/siau/por-servicio', async (req, res) => {
  const limit = Number(req.query.limit) || 10
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_siau')
    const limitIdx = params.length + 1
    params.push(limit)

    const { rows } = await pool.query(`
      SELECT 
        COALESCE(servicio, 'CONSULTA EXTERNA') AS servicio,
        COUNT(*)::int AS total_encuestas,
        COUNT(CASE WHEN es_satisfecho = 1 THEN 1 END)::int AS satisfechos,
        ROUND(
          COUNT(CASE WHEN es_satisfecho = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
          1
        )::float AS pct_satisfaccion
      FROM syn_siau
      ${where}
      GROUP BY servicio
      ORDER BY total_encuestas DESC
      LIMIT $${limitIdx}
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/siau/por-calificacion', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_siau')
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(calificacion, 'Buena') AS calificacion,
        COUNT(*)::int AS total_encuestas,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_siau ${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_siau
      ${where}
      GROUP BY calificacion
      ORDER BY total_encuestas DESC
    `, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/siau/tendencia', async (req, res) => {
  const periodo = req.query.periodo || 'semana'
  try {
    if (periodo === 'semana') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('week', '2026-11-15'::date) as inicio, (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          TO_CHAR(d.dia, 'YYYY-MM-DD') as fecha,
          CASE EXTRACT(ISODOW FROM d.dia) WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mié' WHEN 4 THEN 'Jue' WHEN 5 THEN 'Vie' WHEN 6 THEN 'Sáb' WHEN 7 THEN 'Dom' END as label,
          COUNT(s.idencu)::int as total_encuestas,
          COUNT(CASE WHEN s.es_satisfecho = 1 THEN 1 END)::int as satisfechos
        FROM dias d
        LEFT JOIN syn_siau s ON s.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'semana', categorias: rows.map(r => r.label), data: rows })
    }
    if (periodo === 'mes') {
      const { rows } = await pool.query(`
        WITH limites AS (
          SELECT DATE_TRUNC('month', '2026-11-15'::date) as inicio, (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date as fin
        ),
        dias AS (SELECT generate_series((SELECT inicio FROM limites), (SELECT fin FROM limites), INTERVAL '1 day')::date as dia)
        SELECT 
          EXTRACT(DAY FROM d.dia)::int as dia,
          TO_CHAR(d.dia, 'DD') as label,
          COUNT(s.idencu)::int as total_encuestas,
          COUNT(CASE WHEN s.es_satisfecho = 1 THEN 1 END)::int as satisfechos
        FROM dias d
        LEFT JOIN syn_siau s ON s.fecha = d.dia
        GROUP BY d.dia
        ORDER BY d.dia ASC
      `)
      return res.json({ tipo: 'mes', categorias: rows.map(r => r.label), data: rows })
    }
    const { rows } = await pool.query(`
      SELECT mes, COUNT(*)::int AS total_encuestas, COUNT(CASE WHEN es_satisfecho = 1 THEN 1 END)::int AS satisfechos
      FROM syn_siau WHERE anio = 2026 GROUP BY mes ORDER BY mes ASC
    `)
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = nombresMeses.map((m, i) => {
      const found = rows.find(r => r.mes === i + 1)
      return { label: m, total_encuestas: found ? found.total_encuestas : 0, satisfechos: found ? found.satisfechos : 0 }
    })
    res.json({ tipo: 'anio', categorias: nombresMeses, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

indicadoresRouter.get('/siau/exportar-csv', async (req, res) => {
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_siau')
    const { rows } = await pool.query(`
      SELECT idencu, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, afiliado_nombre, servicio, asegurador, calificacion, observacion
      FROM syn_siau ${where} ORDER BY fecha DESC LIMIT 10000
    `, params)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="satisfaccion_siau_${req.query.periodo || 'semana'}.csv"`)
    res.write('\ufeff')
    res.write('ID Encuesta;Fecha;Usuario / Paciente;Servicio Evaluado;EPS Aseguradora;Calificación;Observación\r\n')
    for (const r of rows) {
      res.write(`"${r.idencu}";"${r.fecha}";"${(r.afiliado_nombre||'').replace(/"/g,'""')}";"${(r.servicio||'').replace(/"/g,'""')}";"${(r.asegurador||'').replace(/"/g,'""')}";"${r.calificacion}";"${(r.observacion||'').replace(/"/g,'""')}"\r\n`)
    }
    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
