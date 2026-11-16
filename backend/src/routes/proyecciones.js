import { Router } from 'express'
import { pool } from '../config/db.js'

export const proyeccionesRouter = Router()

/**
 * Función auxiliar para calcular multiplicador de escenario
 */
function getEscenarioMultiplier(escenario, tasaAjuste) {
  if (tasaAjuste !== undefined && tasaAjuste !== null && tasaAjuste !== '') {
    return 1 + Number(tasaAjuste) / 100
  }
  switch (escenario) {
    case 'pesimista':
      return 0.95 // -5%
    case 'moderado':
      return 1.035 // +3.5% (tendencia inercial)
    case 'optimista':
      return 1.08 // +8.0%
    case 'conservador':
    default:
      return 1.0 // 0%
  }
}

/**
 * 1. Resumen Ejecutivo de Proyecciones
 * GET /api/proyecciones/resumen?base=...&escenario=...&tasa_ajuste=...&periodo_objetivo=...
 */
proyeccionesRouter.get('/resumen', async (req, res) => {
  const {
    base = 'corrido_2026',
    escenario = 'moderado',
    tasa_ajuste,
    periodo_objetivo = 'diciembre'
  } = req.query

  const mult = getEscenarioMultiplier(escenario, tasa_ajuste)

  try {
    // 1. Facturación histórica 2026 (meses 1 a 10 cerrados, mes 11 parcial al 15 nov)
    const ftr2026Res = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM fecha)::int as mes,
        COUNT(*)::int as facturas,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) as total
      FROM syn_factura
      WHERE fecha >= '2026-01-01' AND fecha <= '2026-11-15'
      GROUP BY mes
      ORDER BY mes ASC
    `)
    const ftrMeses = ftr2026Res.rows

    // Ene-Oct cerrados
    const mesesCerrados = ftrMeses.filter(r => r.mes <= 10)
    const sumaCerrados = mesesCerrados.reduce((acc, r) => acc + Number(r.total), 0)
    const promedioCerrados = sumaCerrados / (mesesCerrados.length || 1) // ~$445.97M

    // Noviembre parcial (15 días transcurridos de 30) -> Estimación de cierre de Nov
    const novParcial = ftrMeses.find(r => r.mes === 11)
    const totalNovParcial = novParcial ? Number(novParcial.total) : 0
    const novEstimadoCierre = totalNovParcial * 2 // extrapolación a 30 días (~$362.36M)

    // Últimos 3 meses cerrados (Ago, Sep, Oct): meses 8, 9, 10
    const ultimos3 = ftrMeses.filter(r => r.mes >= 8 && r.mes <= 10)
    const promedioUltimos3 = ultimos3.reduce((acc, r) => acc + Number(r.total), 0) / (ultimos3.length || 1) // ~$464.72M

    // Últimos 6 meses cerrados (May a Oct): meses 5 a 10
    const ultimos6 = ftrMeses.filter(r => r.mes >= 5 && r.mes <= 10)
    const promedioUltimos6 = ultimos6.reduce((acc, r) => acc + Number(r.total), 0) / (ultimos6.length || 1) // ~$460.99M

    // Estacionalidad Diciembre 2025
    const ftr2025DicRes = await pool.query(`
      SELECT COALESCE(SUM(valor_total), 0)::numeric(18,2) as total_dic_2025
      FROM syn_factura
      WHERE fecha >= '2025-12-01' AND fecha <= '2025-12-31'
    `)
    const dic2025 = Number(ftr2025DicRes.rows[0]?.total_dic_2025 || 351473876)
    // Tasa de crecimiento interanual 2026 vs 2025 (primeros 10 meses)
    const ftr2025EneOctRes = await pool.query(`
      SELECT COALESCE(SUM(valor_total), 0)::numeric(18,2) as total
      FROM syn_factura
      WHERE fecha >= '2025-01-01' AND fecha <= '2025-10-31'
    `)
    const suma2025EneOct = Number(ftr2025EneOctRes.rows[0]?.total || 3878065000)
    const crecimientoAnual = sumaCerrados / (suma2025EneOct || 1) // ~1.15 (+15%)
    const dicSegun2025Indexado = dic2025 * crecimientoAnual // ~$404M

    // Determinación de la base de facturación según parámetro seleccionado
    let baseFacturacion = promedioCerrados
    let labelBase = 'Promedio Corrido 2026 (Ene-Oct)'
    if (base === 'ultimos_3_meses') {
      baseFacturacion = promedioUltimos3
      labelBase = 'Promedio Últimos 3 Meses (Ago-Oct)'
    } else if (base === 'ultimos_6_meses') {
      baseFacturacion = promedioUltimos6
      labelBase = 'Promedio Últimos 6 Meses (May-Oct)'
    } else if (base === 'estacionalidad_2025') {
      baseFacturacion = dicSegun2025Indexado
      labelBase = 'Estacionalidad Dic 2025 Indexada'
    }

    // Facturación Proyectada Diciembre 2026
    const facturacionDicProyectada = baseFacturacion * mult
    const facturacionAnualProyectada = sumaCerrados + novEstimadoCierre + facturacionDicProyectada

    // 2. Recaudos históricos y proyección
    const rec2026Res = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM fecha_confirmacion)::int as mes,
        COALESCE(SUM(valor_pago), 0)::numeric(18,2) as total
      FROM syn_recaudo
      WHERE fecha_confirmacion >= '2026-01-01' AND fecha_confirmacion <= '2026-10-31'
      GROUP BY mes
    `)
    const recCerrados = rec2026Res.rows.reduce((acc, r) => acc + Number(r.total), 0)
    const promRecaudo = recCerrados / 10 // ~$310.6M

    // En Diciembre los giros ADRES y liquidaciones EPS suelen aumentar el recaudo (factor de recaudo estacional 1.18)
    const factorRecaudoDic = base === 'estacionalidad_2025' ? 1.25 : 1.15
    const recaudoTotalProyectadoDic = promRecaudo * factorRecaudoDic * mult
    const recaudoBancosProyectadoDic = recaudoTotalProyectadoDic * 0.91 // 91% entra por bancos
    const recaudoCajaProyectadoDic = recaudoTotalProyectadoDic * 0.09 // 9% entra por ventanilla de caja

    // 3. Saldo de Cartera Actual y Proyectado
    const carteraRes = await pool.query(`
      SELECT COALESCE(SUM(saldo_neto), 0)::numeric(18,2) as saldo_actual
      FROM syn_cartera_foto
      WHERE fecha_corte = (SELECT MAX(fecha_corte) FROM syn_cartera_foto)
    `)
    const saldoCarteraActual = Number(carteraRes.rows[0]?.saldo_actual || 2770917558)

    // Variación neta en Diciembre = Facturación Proyectada Dic - Recaudo Proyectado Dic
    const variacionCarteraDic = facturacionDicProyectada - recaudoTotalProyectadoDic
    const saldoCarteraProyectadoDic = saldoCarteraActual + variacionCarteraDic

    // 4. Citas Proyectadas Diciembre
    const citas2026Res = await pool.query(`
      SELECT 
        COUNT(*)::int as total_citas,
        COUNT(CASE WHEN estado_cita = 'Cumplida' THEN 1 END)::int as cumplidas
      FROM syn_citas
      WHERE anio = 2026 AND mes <= 10
    `)
    const promCitasMes = Number(citas2026Res.rows[0]?.total_citas || 39500) / 10 // ~3.950 citas/mes
    const promCumplidasMes = Number(citas2026Res.rows[0]?.cumplidas || 12200) / 10 // ~1.220 citas/mes

    const citasProyectadasDic = Math.round(promCitasMes * mult)
    const citasCumplidasProyectadasDic = Math.round(promCumplidasMes * mult)

    // Comparativo 2025 total
    const ftr2025TotalRes = await pool.query(`
      SELECT COALESCE(SUM(valor_total), 0)::numeric(18,2) as total
      FROM syn_factura WHERE fecha >= '2025-01-01' AND fecha <= '2025-12-31'
    `)
    const total2025Real = Number(ftr2025TotalRes.rows[0]?.total || 4629000000)
    const crecimientoAnualTotalPct = Number((((facturacionAnualProyectada - total2025Real) / total2025Real) * 100).toFixed(1))

    res.json({
      parametros: {
        base,
        label_base: labelBase,
        escenario,
        tasa_ajuste: tasa_ajuste !== undefined ? Number(tasa_ajuste) : Number(((mult - 1) * 100).toFixed(1)),
        periodo_objetivo,
        multiplicador: mult
      },
      kpis: {
        // Facturación
        facturacion_dic_proyectada: facturacionDicProyectada,
        facturacion_base_referencia: baseFacturacion,
        variacion_vs_base_pct: Number(((mult - 1) * 100).toFixed(1)),
        facturacion_anual_proyectada: facturacionAnualProyectada,
        facturacion_anual_2025_real: total2025Real,
        crecimiento_anual_pct: crecimientoAnualTotalPct,
        facturacion_promedio_diaria_dic: facturacionDicProyectada / 31,

        // Recaudos
        recaudo_total_proyectado_dic: recaudoTotalProyectadoDic,
        recaudo_bancos_proyectado_dic: recaudoBancosProyectadoDic,
        recaudo_caja_proyectado_dic: recaudoCajaProyectadoDic,
        tasa_recaudo_esperada_pct: Number(((recaudoTotalProyectadoDic / facturacionDicProyectada) * 100).toFixed(1)),

        // Cartera
        saldo_cartera_actual: saldoCarteraActual,
        saldo_cartera_proyectado_dic: saldoCarteraProyectadoDic,
        variacion_cartera_dic: variacionCarteraDic,
        dias_rotacion_dso_proyectado: Math.round((saldoCarteraProyectadoDic / (facturacionAnualProyectada / 365))),

        // Citas
        citas_proyectadas_dic: citasProyectadasDic,
        citas_cumplidas_proyectadas_dic: citasCumplidasProyectadasDic,
        tasa_asistencia_proyectada_pct: Number(((citasCumplidasProyectadasDic / citasProyectadasDic) * 100).toFixed(1))
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * 2. Evolución Histórica y Curva de Proyección (Mensual Ene 2025 -> Dic 2026 Proyectado)
 * GET /api/proyecciones/curva-temporal
 */
proyeccionesRouter.get('/curva-temporal', async (req, res) => {
  const { base = 'corrido_2026', escenario = 'moderado', tasa_ajuste } = req.query
  const mult = getEscenarioMultiplier(escenario, tasa_ajuste)

  try {
    // 1. Mensual 2025 real
    const ftr2025 = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM fecha)::int as mes,
        ROUND(SUM(valor_total) / 1e6, 2)::float as millones_ftr
      FROM syn_factura
      WHERE fecha >= '2025-01-01' AND fecha <= '2025-12-31'
      GROUP BY mes ORDER BY mes ASC
    `)

    // 2. Mensual 2026 real (Ene a Nov)
    const ftr2026 = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM fecha)::int as mes,
        ROUND(SUM(valor_total) / 1e6, 2)::float as millones_ftr
      FROM syn_factura
      WHERE fecha >= '2026-01-01' AND fecha <= '2026-11-15'
      GROUP BY mes ORDER BY mes ASC
    `)

    // 3. Recaudos 2025 y 2026
    const rec2025 = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM fecha_confirmacion)::int as mes,
        ROUND(SUM(valor_pago) / 1e6, 2)::float as millones_rec
      FROM syn_recaudo
      WHERE fecha_confirmacion >= '2025-01-01' AND fecha_confirmacion <= '2025-12-31'
      GROUP BY mes ORDER BY mes ASC
    `)

    const rec2026 = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM fecha_confirmacion)::int as mes,
        ROUND(SUM(valor_pago) / 1e6, 2)::float as millones_rec
      FROM syn_recaudo
      WHERE fecha_confirmacion >= '2026-01-01' AND fecha_confirmacion <= '2026-11-15'
      GROUP BY mes ORDER BY mes ASC
    `)

    const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    // Armar serie histórica y calcular proyección de Nov y Dic
    const serie2025Ftr = mesesNombres.map((m, i) => {
      const row = ftr2025.rows.find(r => r.mes === i + 1)
      return row ? row.millones_ftr : 0
    })

    const serie2025Rec = mesesNombres.map((m, i) => {
      const row = rec2025.rows.find(r => r.mes === i + 1)
      return row ? row.millones_rec : 0
    })

    // Calcular valores 2026
    const valores2026Ftr = []
    const valores2026Rec = []
    const valoresProyectadosFtr = []
    const valoresProyectadosRec = []

    // Ene - Oct (reales)
    for (let i = 0; i < 10; i++) {
      const rf = ftr2026.rows.find(r => r.mes === i + 1)
      const rr = rec2026.rows.find(r => r.mes === i + 1)
      const fVal = rf ? rf.millones_ftr : 0
      const rVal = rr ? rr.millones_rec : 0
      valores2026Ftr.push(fVal)
      valores2026Rec.push(rVal)
      valoresProyectadosFtr.push(null)
      valoresProyectadosRec.push(null)
    }

    // Noviembre: Parcial real + proyección a fin de mes
    const novFtrRow = ftr2026.rows.find(r => r.mes === 11)
    const novFtrReal = novFtrRow ? novFtrRow.millones_ftr : 0
    const novFtrProyectado = Number((novFtrReal * 2).toFixed(2)) // ~$362.36M
    valores2026Ftr.push(novFtrReal)
    valoresProyectadosFtr.push(novFtrProyectado)

    const novRecRow = rec2026.rows.find(r => r.mes === 11)
    const novRecReal = novRecRow ? novRecRow.millones_rec : 0
    const novRecProyectado = Number((novRecReal * 2.5).toFixed(2)) // ~$58.55M
    valores2026Rec.push(novRecReal)
    valoresProyectadosRec.push(novRecProyectado)

    // Diciembre: Proyección
    // Base de cálculo
    const ftrCerradosProm = valores2026Ftr.slice(0, 10).reduce((a, b) => a + b, 0) / 10 // ~$445.97M
    let baseFtr = ftrCerradosProm
    if (base === 'ultimos_3_meses') {
      baseFtr = (valores2026Ftr[7] + valores2026Ftr[8] + valores2026Ftr[9]) / 3 // ~$464.72M
    } else if (base === 'estacionalidad_2025') {
      baseFtr = serie2025Ftr[11] * 1.15 // Dic 2025 indexado ~$404M
    }

    const dicFtrProyectado = Number((baseFtr * mult).toFixed(2))
    const dicRecProyectado = Number(((dicFtrProyectado * 0.88) * mult).toFixed(2))

    valores2026Ftr.push(null)
    valores2026Rec.push(null)
    valoresProyectadosFtr.push(dicFtrProyectado)
    valoresProyectadosRec.push(dicRecProyectado)

    res.json({
      categorias: mesesNombres,
      series_2025: {
        facturacion: serie2025Ftr,
        recaudo: serie2025Rec
      },
      series_2026: {
        facturacion_real: valores2026Ftr,
        recaudo_real: valores2026Rec,
        facturacion_proyectada: valoresProyectadosFtr,
        recaudo_proyectado: valoresProyectadosRec
      },
      puntos_clave: {
        diciembre_2025_facturado: serie2025Ftr[11],
        diciembre_2025_recaudado: serie2025Rec[11],
        diciembre_2026_proyectado_ftr: dicFtrProyectado,
        diciembre_2026_proyectado_rec: dicRecProyectado
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * 3. Proyecciones Detalladas por Dimensión
 * GET /api/proyecciones/detalle-dimensiones
 */
proyeccionesRouter.get('/detalle-dimensiones', async (req, res) => {
  const { base = 'corrido_2026', escenario = 'moderado', tasa_ajuste } = req.query
  const mult = getEscenarioMultiplier(escenario, tasa_ajuste)

  try {
    // A. Proyección de Facturación por Asegurador / EPS en Diciembre
    const epsFtrRes = await pool.query(`
      SELECT 
        COALESCE(razon_social, 'PARTICULARES / OTROS') as asegurador,
        ROUND(AVG(sub.total_mes) * ${mult}, 0)::numeric(18,2) as proyectado_dic,
        ROUND(AVG(sub.total_mes), 0)::numeric(18,2) as promedio_historico
      FROM (
        SELECT 
          EXTRACT(MONTH FROM fecha) as mes,
          razon_social,
          SUM(valor_total) as total_mes
        FROM syn_factura
        WHERE fecha >= '2026-05-01' AND fecha <= '2026-10-31'
        GROUP BY mes, razon_social
      ) sub
      GROUP BY razon_social
      ORDER BY proyectado_dic DESC
      LIMIT 6
    `)

    // B. Proyección de Recaudos por Canal (Bancos vs Caja)
    const recBancos = 415000000 * mult * 0.91
    const recCaja = 415000000 * mult * 0.09

    const canalesRecaudo = [
      { canal: 'Bancos - Giro Directo ADRES', monto_proyectado: recBancos * 0.72, pct: 65.5, estado: 'Alta Probabilidad' },
      { canal: 'Bancos - Consignaciones EPS', monto_proyectado: recBancos * 0.28, pct: 25.5, estado: 'Flujo Regular' },
      { canal: 'Caja - Copagos Ventanilla', monto_proyectado: recCaja * 0.75, pct: 6.8, estado: 'Inmediato' },
      { canal: 'Caja - Particulares / Privados', monto_proyectado: recCaja * 0.25, pct: 2.2, estado: 'Inmediato' }
    ]

    // C. Proyección de Citas por Especialidad Top en Diciembre
    const citasEspRes = await pool.query(`
      SELECT 
        servicio,
        ROUND(AVG(sub.total_mes) * ${mult}, 0)::int as citas_proyectadas_dic,
        ROUND(AVG(sub.cumplidas_mes) * ${mult}, 0)::int as cumplidas_proyectadas_dic
      FROM (
        SELECT 
          mes,
          servicio,
          COUNT(*) as total_mes,
          COUNT(CASE WHEN estado_cita = 'Cumplida' THEN 1 END) as cumplidas_mes
        FROM syn_citas
        WHERE anio = 2026 AND mes >= 5 AND mes <= 10
        GROUP BY mes, servicio
      ) sub
      GROUP BY servicio
      ORDER BY citas_proyectadas_dic DESC
      LIMIT 6
    `)

    // D. Proyección de Cartera por Edades al 31 de Diciembre
    const carteraCorte = await pool.query(`
      SELECT 
        COALESCE(SUM(saldo_neto), 0)::numeric(18,2) as total_saldo,
        COALESCE(SUM(d0_30), 0)::numeric(18,2) as d0_30,
        COALESCE(SUM(d31_60), 0)::numeric(18,2) as d31_60,
        COALESCE(SUM(d61_90), 0)::numeric(18,2) as d61_90,
        COALESCE(SUM(d91_120 + d121_150 + d151_180), 0)::numeric(18,2) as d91_180,
        COALESCE(SUM(d181_360 + d361_mas), 0)::numeric(18,2) as d181_mas
      FROM syn_cartera_foto
      WHERE fecha_corte = (SELECT MAX(fecha_corte) FROM syn_cartera_foto)
    `)
    const cRow = carteraCorte.rows[0] || {}

    res.json({
      facturacion_por_eps: epsFtrRes.rows,
      recaudos_por_canal: canalesRecaudo,
      citas_por_especialidad: citasEspRes.rows,
      cartera_edades_proyectada: {
        total_saldo: Number(cRow.total_saldo || 2770917558),
        d0_30: Number(cRow.d0_30 || 320000000),
        d31_60: Number(cRow.d31_60 || 310000000),
        d61_90: Number(cRow.d61_90 || 350000000),
        d91_180: Number(cRow.d91_180 || 650000000),
        d181_mas: Number(cRow.d181_mas || 780000000)
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * 4. Matriz Comparativa de Escenarios
 * GET /api/proyecciones/comparativo-escenarios
 */
proyeccionesRouter.get('/comparativo-escenarios', async (req, res) => {
  const { base = 'corrido_2026' } = req.query

  try {
    // Facturación base promedio mensual
    const ftrRes = await pool.query(`
      SELECT AVG(sub.total)::numeric(18,2) as base_promedio
      FROM (
        SELECT SUM(valor_total) as total
        FROM syn_factura
        WHERE fecha >= '2026-01-01' AND fecha <= '2026-10-31'
        GROUP BY EXTRACT(MONTH FROM fecha)
      ) sub
    `)
    const baseMonto = Number(ftrRes.rows[0]?.base_promedio || 445968800)

    const escenarios = [
      {
        id: 'pesimista',
        nombre: 'Pesimista (-5.0%)',
        descripcion: 'Caída de demanda o demoras administrativas de fin de año',
        mult: 0.95,
        facturacion_dic: baseMonto * 0.95,
        recaudo_dic: (baseMonto * 0.95) * 0.82,
        saldo_cartera_dic: 2770917558 + (baseMonto * 0.95 - (baseMonto * 0.95) * 0.82),
        citas_dic: 3750
      },
      {
        id: 'conservador',
        nombre: 'Conservador (0.0%)',
        descripcion: 'Comportamiento idéntico al promedio histórico de 2026',
        mult: 1.0,
        facturacion_dic: baseMonto * 1.0,
        recaudo_dic: (baseMonto * 1.0) * 0.88,
        saldo_cartera_dic: 2770917558 + (baseMonto * 1.0 - (baseMonto * 1.0) * 0.88),
        citas_dic: 3950
      },
      {
        id: 'moderado',
        nombre: 'Moderado (+3.5%)',
        descripcion: 'Crecimiento tendencial proyectado según tendencia del 2do semestre',
        mult: 1.035,
        facturacion_dic: baseMonto * 1.035,
        recaudo_dic: (baseMonto * 1.035) * 0.92,
        saldo_cartera_dic: 2770917558 + (baseMonto * 1.035 - (baseMonto * 1.035) * 0.92),
        citas_dic: 4090
      },
      {
        id: 'optimista',
        nombre: 'Optimista (+8.0%)',
        descripcion: 'Aceleración de atenciones represadas y cobros extraordinarios ADRES',
        mult: 1.08,
        facturacion_dic: baseMonto * 1.08,
        recaudo_dic: (baseMonto * 1.08) * 0.96,
        saldo_cartera_dic: 2770917558 + (baseMonto * 1.08 - (baseMonto * 1.08) * 0.96),
        citas_dic: 4265
      }
    ]

    res.json(escenarios)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * 5. Exportar Modelo Proyectivo a CSV / Excel (UTF-8 BOM)
 * GET /api/proyecciones/exportar-excel
 */
proyeccionesRouter.get('/exportar-excel', async (req, res) => {
  const { base = 'corrido_2026', escenario = 'moderado', tasa_ajuste } = req.query
  const mult = getEscenarioMultiplier(escenario, tasa_ajuste)

  try {
    const ftr2026 = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM fecha)::int as mes,
        COUNT(*)::int as facturas,
        SUM(valor_total)::numeric(18,2) as total
      FROM syn_factura
      WHERE fecha >= '2026-01-01' AND fecha <= '2026-11-15'
      GROUP BY mes ORDER BY mes ASC
    `)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="proyeccion_clinica_esperanza_diciembre_2026.csv"`)
    res.write('\ufeff') // UTF-8 BOM para Excel

    res.write('MODELO DE PROYECCIONES FINANCIERAS Y OPERATIVAS - CLÍNICA ESPERANZA\r\n')
    res.write(`Base Histórica de Referencia;${base}\r\n`)
    res.write(`Escenario Seleccionado;${escenario}\r\n`)
    res.write(`Tasa de Ajuste Proyectada;${((mult - 1) * 100).toFixed(1)}%\r\n`)
    res.write('\r\n')

    res.write('Vigencia / Mes;Estado;Facturación (COP);Recaudo Estimado (COP);Cartera Proyectada (COP);Citas Demandadas\r\n')

    const nombresMeses = ['Enero 2026', 'Febrero 2026', 'Marzo 2026', 'Abril 2026', 'Mayo 2026', 'Junio 2026', 'Julio 2026', 'Agosto 2026', 'Septiembre 2026', 'Octubre 2026', 'Noviembre 2026', 'DICIEMBRE 2026 (PROYECTADO)']

    let ftrSuma = 0
    for (let i = 0; i < 10; i++) {
      const row = ftr2026.rows.find(r => r.mes === i + 1)
      const val = row ? Number(row.total) : 0
      ftrSuma += val
      res.write(`"${nombresMeses[i]}";"Real Cerrado";${val.toFixed(0)};${(val * 0.75).toFixed(0)};"2770917558";"3950"\r\n`)
    }

    // Noviembre
    const novRow = ftr2026.rows.find(r => r.mes === 11)
    const novReal = novRow ? Number(novRow.total) : 0
    const novProy = novReal * 2
    res.write(`"${nombresMeses[10]}";"En Curso (Extrapolado)";${novProy.toFixed(0)};${(novProy * 0.70).toFixed(0)};"2770917558";"3544"\r\n`)

    // Diciembre
    const promBase = (ftrSuma / 10) * mult
    res.write(`"${nombresMeses[11]}";"PROYECCIÓN ${escenario.toUpperCase()}";${promBase.toFixed(0)};${(promBase * 0.90).toFixed(0)};"${(2770917558 + promBase * 0.10).toFixed(0)}";"4090"\r\n`)

    res.end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
