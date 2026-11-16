import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
})

async function test() {
  const sem = await pool.query(`
    SELECT COUNT(*) as total,
      COUNT(CASE WHEN estado_cita = 'Cumplida' THEN 1 END) as cumplidas,
      COUNT(CASE WHEN estado_cita = 'Inasistencia' THEN 1 END) as inasistencias,
      COUNT(CASE WHEN estado_cita = 'Programada' THEN 1 END) as programadas,
      COUNT(CASE WHEN estado_cita = 'Cancelada' THEN 1 END) as canceladas
    FROM syn_citas
    WHERE fecha >= DATE_TRUNC('week', '2026-11-15'::date) AND fecha <= (DATE_TRUNC('week', '2026-11-15'::date) + INTERVAL '6 days')::date
  `)
  console.log('Semana Citas:', sem.rows[0])

  const mes = await pool.query(`
    SELECT COUNT(*) as total,
      COUNT(CASE WHEN estado_cita = 'Cumplida' THEN 1 END) as cumplidas,
      COUNT(CASE WHEN estado_cita = 'Inasistencia' THEN 1 END) as inasistencias,
      COUNT(CASE WHEN estado_cita = 'Programada' THEN 1 END) as programadas,
      COUNT(CASE WHEN estado_cita = 'Cancelada' THEN 1 END) as canceladas
    FROM syn_citas
    WHERE fecha >= DATE_TRUNC('month', '2026-11-15'::date) AND fecha <= (DATE_TRUNC('month', '2026-11-15'::date) + INTERVAL '1 month - 1 day')::date
  `)
  console.log('Mes Noviembre Citas:', mes.rows[0])

  await pool.end()
}
test()
