import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function checkSizes() {
  const tRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)

  const results = []
  for (const r of tRes.rows) {
    const cRes = await pool.query(`SELECT COUNT(*)::int as count FROM ${r.table_name}`)
    results.push({ table: r.table_name, count: cRes.rows[0].count })
  }

  results.sort((a, b) => b.count - a.count)
  console.table(results)
  await pool.end()
}

checkSizes().catch(console.error)
