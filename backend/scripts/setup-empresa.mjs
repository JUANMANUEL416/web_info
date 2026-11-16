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

  // Check columns of empresa, usuario, vigencia
  const cols = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('empresa', 'usuario', 'vigencia')
    ORDER BY table_name, ordinal_position
  `);
  console.log('Columns:', cols.rows);

  // Clear existing dummy data if any
  await pool.query('DELETE FROM usuario');
  await pool.query('DELETE FROM vigencia');
  await pool.query('DELETE FROM empresa');

  // Insert Clínica Esperanza
  const empRes = await pool.query(`
    INSERT INTO empresa (nit, razon_social, moneda_codigo)
    VALUES ('892120115-1', 'Clínica Esperanza', 'COP')
    RETURNING id
  `);
  const empresaId = empRes.rows[0].id;

  // Insert Default Director User
  await pool.query(`
    INSERT INTO usuario (empresa_id, nombre, email, password_hash)
    VALUES ($1, 'Dirección General', 'direccion@clinicaesperanza.com.co', $2)
  `, [empresaId, 'no-login']);

  // Insert Active Vigencia 2026
  await pool.query(`
    INSERT INTO vigencia (empresa_id, anio, fecha_inicio, fecha_fin, estado)
    VALUES ($1, 2026, '2026-01-01', '2026-12-31', 'abierta')
  `, [empresaId]);

  console.log('Inserted Clínica Esperanza into empresa, usuario, and vigencia tables!');

  const test = await pool.query(`
    SELECT e.nit, e.razon_social, e.moneda_codigo,
           u.nombre AS usuario_nombre, u.email AS usuario_email,
           v.anio, v.estado AS vigencia_estado
    FROM empresa e
    LEFT JOIN usuario u ON u.empresa_id = e.id
    LEFT JOIN vigencia v ON v.empresa_id = e.id
    ORDER BY v.anio DESC NULLS LAST, u.id
    LIMIT 1
  `);
  console.log('Result for /api/presentacion/empresa:', test.rows[0]);

  await pool.end();
}

run().catch(console.error);
