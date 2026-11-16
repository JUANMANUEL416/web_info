import fs from 'fs'

let content = fs.readFileSync('src/routes/indicadores.js', 'utf8')

// Clean up any existing broken blocks if present
function removeBlock(c, startStr, endStr) {
  const s = c.indexOf(startStr)
  if (s !== -1) {
    const e = c.indexOf(endStr, s)
    if (e !== -1) {
      return c.slice(0, s) + c.slice(e)
    }
  }
  return c
}

content = removeBlock(content, "indicadoresRouter.get('/apoyo/por-asegurador'", "indicadoresRouter.get('/apoyo/tendencia'")
content = removeBlock(content, "indicadoresRouter.get('/hc/por-especialidad'", "indicadoresRouter.get('/hc/tendencia'")
content = removeBlock(content, "indicadoresRouter.get('/caja/por-tercero'", "indicadoresRouter.get('/caja/tendencia'")
content = removeBlock(content, "indicadoresRouter.get('/bancos/por-asegurador'", "indicadoresRouter.get('/bancos/tendencia'")
content = removeBlock(content, "indicadoresRouter.get('/siau/por-asegurador'", "indicadoresRouter.get('/siau/tendencia'")

// 1. Apoyo por asegurador
const codeApoyo = `indicadoresRouter.get('/apoyo/por-asegurador', async (req, res) => {
  const limit = Number(req.query.limit) || 8
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_apoyo')

    const { rows } = await pool.query(\`
      SELECT 
        COALESCE(asegurador, 'PARTICULAR / OTROS') AS asegurador,
        COUNT(*)::int AS total_estudios,
        ROUND(AVG(tiempo_entrega_horas)::numeric, 1)::float AS tiempo_promedio,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_apoyo \${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_apoyo
      \${where}
      GROUP BY asegurador
      ORDER BY total_estudios DESC
      LIMIT \${limit}
    \`, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

`

// 2. HC por especialidad
const codeHc = `indicadoresRouter.get('/hc/por-especialidad', async (req, res) => {
  const limit = Number(req.query.limit) || 8
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_hc')

    const { rows } = await pool.query(\`
      SELECT 
        COALESCE(especialidad, 'CONSULTA GENERAL') AS especialidad,
        COUNT(*)::int AS total_atenciones,
        ROUND(
          COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM syn_hc \${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_hc
      \${where}
      GROUP BY especialidad
      ORDER BY total_atenciones DESC
      LIMIT \${limit}
    \`, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

`

// 3. Caja por tercero
const codeCaja = `indicadoresRouter.get('/caja/por-tercero', async (req, res) => {
  const limit = Number(req.query.limit) || 8
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_caja')

    const { rows } = await pool.query(\`
      SELECT 
        COALESCE(cliente, 'PARTICULAR') AS cliente,
        COUNT(*)::int AS total_recibos,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_caja \${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_caja
      \${where}
      GROUP BY cliente
      ORDER BY valor_recaudado DESC
      LIMIT \${limit}
    \`, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

`

// 4. Bancos por asegurador
const codeBancos = `indicadoresRouter.get('/bancos/por-asegurador', async (req, res) => {
  const limit = Number(req.query.limit) || 8
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_bancos')

    const { rows } = await pool.query(\`
      SELECT 
        COALESCE(asegurador, 'ENTIDAD ASEGURADORA') AS asegurador,
        COUNT(*)::int AS total_operaciones,
        COALESCE(SUM(valor_total), 0)::numeric(18,2) AS valor_recaudado,
        ROUND(
          SUM(valor_total) * 100.0 / NULLIF((SELECT SUM(valor_total) FROM syn_bancos \${where}), 0),
          1
        )::float AS pct_participacion
      FROM syn_bancos
      \${where}
      GROUP BY asegurador
      ORDER BY valor_recaudado DESC
      LIMIT \${limit}
    \`, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

`

// 5. SIAU por asegurador
const codeSiau = `indicadoresRouter.get('/siau/por-asegurador', async (req, res) => {
  const limit = Number(req.query.limit) || 8
  try {
    const { where, params } = buildPeriodFilter(req.query, 'syn_siau')

    const { rows } = await pool.query(\`
      SELECT 
        COALESCE(asegurador, 'PARTICULAR / OTROS') AS asegurador,
        COUNT(*)::int AS total_encuestas,
        ROUND(
          COUNT(CASE WHEN es_satisfecho = 1 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
          1
        )::float AS pct_satisfaccion
      FROM syn_siau
      \${where}
      GROUP BY asegurador
      ORDER BY total_encuestas DESC
      LIMIT \${limit}
    \`, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

`

content = content.replace("indicadoresRouter.get('/apoyo/tendencia',", codeApoyo + "indicadoresRouter.get('/apoyo/tendencia',")
content = content.replace("indicadoresRouter.get('/hc/tendencia',", codeHc + "indicadoresRouter.get('/hc/tendencia',")
content = content.replace("indicadoresRouter.get('/caja/tendencia',", codeCaja + "indicadoresRouter.get('/caja/tendencia',")
content = content.replace("indicadoresRouter.get('/bancos/tendencia',", codeBancos + "indicadoresRouter.get('/bancos/tendencia',")
content = content.replace("indicadoresRouter.get('/siau/tendencia',", codeSiau + "indicadoresRouter.get('/siau/tendencia',")

fs.writeFileSync('src/routes/indicadores.js', content, 'utf8')
console.log('Successfully re-injected 5 endpoints with safe integer limits!')
