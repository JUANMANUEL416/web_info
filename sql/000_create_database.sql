-- Crear la base vacía conectado a postgres, antes de aplicar el esquema.
-- Con Docker no hace falta: docker compose crea la base y carga el volcado.

-- CREATE DATABASE view_info_kesperanza
--   WITH OWNER = view_info
--   ENCODING = 'UTF8'
--   TEMPLATE = template0;

-- Desarrollo local, sin el volcado completo:
--   psql -d view_info_kesperanza -f sql/001_presupuesto.sql
--   psql -d view_info_kesperanza -f sql/002_replica_operativa.sql
