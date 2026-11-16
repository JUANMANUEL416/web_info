# Montaje en servidor — KESPERANZA

Un solo cliente: Clínica Esperanza. Docker levanta PostgreSQL y la aplicación (API + tableros).

## Requisitos

- Linux con Docker y el plugin Compose.
- El puerto **8080** abierto hacia quien va a usar los tableros.
- El archivo `sql/003_standalone_full_dump.sql.gz` (viene en el repositorio). Es la réplica operativa de KESPERANZA.

## Pasos

En el servidor, dentro de la carpeta del proyecto:

```bash
cp .env.server.example .env
```

Edite `.env` y cambie `POSTGRES_PASSWORD`. Si va a volver a traer datos desde el SQL Server de la clínica, complete también `MSSQL_PASSWORD`. No copie ese archivo a git.

```bash
docker compose up -d --build
```

Abra `http://IP-DEL-SERVIDOR:8080`.

La primera vez PostgreSQL importa el volcado y crea usuarios, presupuesto y tablas `syn_*`. Puede tardar unos minutos. Compruebe:

```bash
docker compose ps
curl -s http://127.0.0.1:8080/api/health
curl -s http://127.0.0.1:8080/api/health/db
```

PostgreSQL solo escucha en `127.0.0.1` del servidor. No hace falta abrirlo a internet.

## Volver a cargar la base

El volcado entra solo cuando el volumen está vacío. Para repetirlo se borra el volumen (se pierde lo que se haya modificado dentro de PostgreSQL):

```bash
docker compose down -v
docker compose up -d
```

## Actualizar la aplicación

```bash
git pull
docker compose up -d --build
```

El volumen de PostgreSQL se conserva.

## Resincronizar desde KESPERANZA

Los tableros leen PostgreSQL. Para traer datos nuevos del SQL Server, con las variables `MSSQL_*` en `.env`:

```bash
docker compose exec app node scripts/sync-all-indicators-prod.mjs
```

Hay un script por proceso en `backend/scripts/sync-*-prod.mjs`. Cada uno usa las variables de entorno; no hay otra base configurada.
