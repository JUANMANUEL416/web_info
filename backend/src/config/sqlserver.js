import sql from 'mssql'

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Falta ${name} para conectar a SQL Server KESPERANZA`)
  }
  return value
}

export function getSqlServerConfig() {
  return {
    server: required('MSSQL_HOST'),
    port: Number(process.env.MSSQL_PORT || 1433),
    user: required('MSSQL_USER'),
    password: required('MSSQL_PASSWORD'),
    database: process.env.MSSQL_DATABASE || 'KESPERANZA',
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    connectionTimeout: 20000,
    requestTimeout: 60000,
  }
}

let mssqlPool = null

export async function getSqlServerPool() {
  if (!mssqlPool) {
    mssqlPool = await sql.connect(getSqlServerConfig())
  }
  return mssqlPool
}
