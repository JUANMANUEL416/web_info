import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function calculateProjections() {
  console.log('=== VERIFICANDO DATOS EXACTOS PARA EL MODELO PROYECTIVO ===\n')

  // 1. Facturación 2026 (Ene - Oct cerrados, y Nov parcial)
  const ftr2026 = await pool.query(`
    SELECT 
      EXTRACT(MONTH FROM fecha)::int as mes,
      COUNT(*)::int as facturas,
      SUM(valor_total)::numeric(18,2) as total
    FROM syn_factura
    WHERE fecha >= '2026-01-01' AND fecha <= '2026-11-15'
    GROUP BY mes
    ORDER BY mes ASC
  `)
  console.log('Facturación 2026 por mes:')
  console.table(ftr2026.rows)

  // 2. Facturación 2025 completa (para estacionalidad de Dic)
  const ftr2025 = await pool.query(`
    SELECT 
      EXTRACT(MONTH FROM fecha)::int as mes,
      COUNT(*)::int as facturas,
      SUM(valor_total)::numeric(18,2) as total
    FROM syn_factura
    WHERE fecha >= '2025-01-01' AND fecha <= '2025-12-31'
    GROUP BY mes
    ORDER BY mes ASC
  `)
  console.log('Facturación 2025 completa:')
  console.table(ftr2025.rows)

  // 3. Saldo de Cartera Actual
  const cartera = await pool.query(`
    SELECT 
      COALESCE(SUM(saldo_neto), 0)::numeric(18,2) as saldo_cartera_actual,
      COALESCE(SUM(por_vencer), 0)::numeric(18,2) as por_vencer,
      COALESCE(SUM(d0_30 + d31_60 + d61_90), 0)::numeric(18,2) as corriente_vencida_90,
      COALESCE(SUM(d91_120 + d121_150 + d151_180 + d181_360 + d361_mas), 0)::numeric(18,2) as mayor_90_dias
    FROM syn_cartera_foto
    WHERE fecha_corte = (SELECT MAX(fecha_corte) FROM syn_cartera_foto)
  `)
  console.log('Saldo de Cartera Actual:')
  console.table(cartera.rows)

  // 4. Recaudos 2026 por mes
  const rec2026 = await pool.query(`
    SELECT 
      EXTRACT(MONTH FROM fecha_confirmacion)::int as mes,
      COUNT(*)::int as recibos,
      SUM(valor_pago)::numeric(18,2) as total
    FROM syn_recaudo
    WHERE fecha_confirmacion >= '2026-01-01' AND fecha_confirmacion <= '2026-11-15'
    GROUP BY mes
    ORDER BY mes ASC
  `)
  console.log('Recaudos 2026 por mes:')
  console.table(rec2026.rows)

  // 5. Citas 2026 por mes
  const cit2026 = await pool.query(`
    SELECT 
      mes,
      COUNT(*)::int as total_citas,
      COUNT(CASE WHEN estado_cita = 'Cumplida' THEN 1 END)::int as cumplidas,
      COUNT(CASE WHEN estado_cita = 'Programada' THEN 1 END)::int as programadas
    FROM syn_citas
    WHERE anio = 2026
    GROUP BY mes
    ORDER BY mes ASC
  `)
  console.log('Citas 2026 por mes:')
  console.table(cit2026.rows)

  await pool.end()
}

calculateProjections().catch(console.error)
