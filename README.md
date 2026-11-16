# View Info — Clínica Esperanza (KESPERANZA)

Tableros directivos y presupuesto de **Clínica Esperanza**. La única fuente operativa es el SQL Server **KESPERANZA**. PostgreSQL guarda la réplica que consultan los tableros.

Stack: PostgreSQL, Node/Express y Vue 3 + Quasar.

## Servidor

La forma de montarlo está en [DEPLOYMENT.md](DEPLOYMENT.md).

```powershell
copy .env.server.example .env
docker compose up -d --build
```

La aplicación queda en el puerto **8080**. La base se llena la primera vez con `sql/003_standalone_full_dump.sql.gz`.

## Desarrollo local

1. Cree la base `view_info_kesperanza` y aplique `sql/001_presupuesto.sql` y `sql/002_replica_operativa.sql`, o restaure el volcado.
2. Copie `backend/.env.example` a `backend/.env` y `frontend/.env.example` a `frontend/.env`.
3. Desde la raíz:

```powershell
npm install
npm run dev
```

API en el puerto **3000**. Frontend en el puerto que muestre Quasar (habitualmente **9000**).

`backend/.env` y `frontend/.env` no se suben a git.
