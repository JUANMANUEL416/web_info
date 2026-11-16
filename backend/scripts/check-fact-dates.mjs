import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const pool = new pg.Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });
  const r = await pool.query("SELECT MAX(fecha) as max_fecha, MIN(fecha) as min_fecha, COUNT(*) as total FROM syn_factura");
  console.log('Fechas en syn_factura:', r.rows);

  const r2 = await pool.query(`
    SELECT fecha, count(*), sum(valor_total) as total_dia 
    FROM syn_factura 
    GROUP BY fecha 
    ORDER BY fecha DESC 
    LIMIT 20
  `);
  console.log('Últimos 20 días con facturación:', r2.rows);

  // Group by day of week for the latest week
  const maxFecha = r.rows[0].max_fecha;
  const rWeek = await pool.query(`
    SELECT 
      TO_CHAR(fecha, 'Dy') as dia_sem,
      TO_CHAR(fecha, 'YYYY-MM-DD') as fecha_str,
      EXTRACT(DOW FROM fecha) as dow,
      count(*) as cantidad,
      sum(valor_total) as total
    FROM syn_factura
    WHERE fecha >= ($1::date - INTERVAL '6 days') AND fecha <= $1::date
    GROUP BY fecha, TO_CHAR(fecha, 'Dy'), EXTRACT(DOW FROM fecha)
    ORDER BY fecha ASC
  `, [maxFecha]);
  console.log('Semana reciente:', rWeek.rows);

  // Current month daily breakdown
  const rMonth = await pool.query(`
    SELECT 
      EXTRACT(DAY FROM fecha) as dia,
      TO_CHAR(fecha, 'YYYY-MM-DD') as fecha_str,
      count(*) as cantidad,
      sum(valor_total) as total
    FROM syn_factura
    WHERE TO_CHAR(fecha, 'YYYY-MM') = TO_CHAR($1::date, 'YYYY-MM')
    GROUP BY fecha, EXTRACT(DAY FROM fecha)
    ORDER BY fecha ASC
  `, [maxFecha]);
  console.log('Días del mes reciente:', rMonth.rows.length, 'días facturados');

  await pool.end();
}

run().catch(console.error);
