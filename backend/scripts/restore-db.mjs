import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

dotenv.config()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dump = path.join(root, 'sql', '003_standalone_full_dump.sql.gz')

const host = process.env.PGHOST || 'localhost'
const port = process.env.PGPORT || '5432'
const database = process.env.PGDATABASE
const user = process.env.PGUSER

if (!database || !user) {
  console.error('Defina PGDATABASE y PGUSER. En el servidor, Docker carga el volcado solo la primera vez.')
  process.exit(1)
}

console.log(`Restaurando ${dump} en ${user}@${host}:${port}/${database}`)

const gunzip = spawn('gzip', ['-dc', dump], { stdio: ['ignore', 'pipe', 'inherit'] })
const psql = spawn(
  'psql',
  ['-h', host, '-p', String(port), '-U', user, '-d', database, '-v', 'ON_ERROR_STOP=1'],
  { stdio: ['pipe', 'inherit', 'inherit'], env: process.env },
)

gunzip.stdout.pipe(psql.stdin)
gunzip.on('error', (err) => {
  console.error('No se pudo ejecutar gzip:', err.message)
  process.exit(1)
})
psql.on('error', (err) => {
  console.error('No se pudo ejecutar psql:', err.message)
  process.exit(1)
})
psql.on('exit', (code) => process.exit(code ?? 1))
