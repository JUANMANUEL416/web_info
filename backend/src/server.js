import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'node:path'
import { checkDbConnection, pool } from './config/db.js'
import { presupuestosRouter } from './routes/presupuestos.js'
import { rubrosRouter } from './routes/rubros.js'
import { presentacionRouter } from './routes/presentacion.js'
import { tablerosRouter } from './routes/tableros.js'
import { facturacionRouter } from './routes/facturacion.js'
import { indicadoresRouter } from './routes/indicadores.js'
import { proyeccionesRouter } from './routes/proyecciones.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 3000)

const corsOriginRaw = process.env.CORS_ORIGIN || 'http://localhost:9000'
const corsOrigin = corsOriginRaw.includes(',')
  ? corsOriginRaw.split(',').map((s) => s.trim())
  : corsOriginRaw

app.use(cors({ origin: corsOrigin, credentials: true }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'view-info-backend',
    env: process.env.NODE_ENV || 'development',
    appEnv: process.env.APP_ENV || 'development',
  })
})

app.get('/api/health/db', async (_req, res) => {
  try {
    const info = await checkDbConnection()
    res.json({
      ok: true,
      database: info.db,
      serverTime: info.server_time,
    })
  } catch (err) {
    res.status(503).json({
      ok: false,
      error: err.message,
    })
  }
})

app.use('/api/presupuestos', presupuestosRouter)
app.use('/api/rubros', rubrosRouter)
app.use('/api/presentacion', presentacionRouter)
app.use('/api/tableros', tablerosRouter)
app.use('/api/facturacion-tablero', facturacionRouter)
app.use('/api/indicadores', indicadoresRouter)
app.use('/api/proyecciones', proyeccionesRouter)

app.get('/api/vigencias', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT v.id, v.anio, v.estado, e.razon_social
       FROM vigencia v
       INNER JOIN empresa e ON e.id = v.empresa_id
       ORDER BY v.anio DESC
       LIMIT 50`,
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

const staticDir = process.env.STATIC_DIR
if (staticDir) {
  const root = path.resolve(staticDir)
  app.use(express.static(root))
  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ ok: false, error: 'No encontrado' })
      return
    }
    res.sendFile(path.join(root, 'index.html'))
  })
}

app.listen(port, () => {
  const appEnv = process.env.APP_ENV || 'development'
  console.log(`API [${appEnv}] http://localhost:${port}`)
  if (staticDir) console.log(`Tableros estáticos en ${path.resolve(staticDir)}`)
})
