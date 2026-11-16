-- Presupuesto proyectado — esquema PostgreSQL
-- Motor: PostgreSQL 14+

BEGIN;

-- ---------------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------------

CREATE TYPE estado_vigencia AS ENUM ('abierta', 'cerrada');
CREATE TYPE estado_periodo AS ENUM ('abierto', 'cerrado');
CREATE TYPE estado_version AS ENUM ('borrador', 'aprobada', 'vigente', 'archivada');
CREATE TYPE naturaleza_cuenta AS ENUM ('debito', 'credito');
CREATE TYPE tipo_rubro AS ENUM (
    'ingreso_operativo',
    'ingreso_no_operativo',
    'costo_variable',
    'comision',
    'gasto_fijo',
    'contingencia'
);
CREATE TYPE naturaleza_traslado AS ENUM ('origen', 'destino', 'nula');
CREATE TYPE estado_movimiento AS ENUM ('borrador', 'aprobado', 'anulado');
CREATE TYPE origen_proyeccion AS ENUM ('formula', 'manual');
CREATE TYPE tipo_calculo_gasto AS ENUM ('porcentaje_ingreso', 'valor_fijo', 'contingencia');
CREATE TYPE estado_lote_balance AS ENUM ('cargado', 'reemplazado');

-- ---------------------------------------------------------------------------
-- Catálogos y seguridad
-- ---------------------------------------------------------------------------

CREATE TABLE empresa (
    id              BIGSERIAL PRIMARY KEY,
    nit             VARCHAR(20)  NOT NULL,
    razon_social    VARCHAR(255) NOT NULL,
    moneda_codigo   CHAR(3)      NOT NULL DEFAULT 'COP',
    activa          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_empresa_nit UNIQUE (nit)
);

CREATE TABLE usuario (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      BIGINT       NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
    nombre          VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    password_hash   TEXT         NOT NULL,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    ultimo_acceso   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_usuario_email UNIQUE (email)
);

CREATE TABLE rol (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      BIGINT       NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
    codigo          VARCHAR(50)  NOT NULL,
    nombre          VARCHAR(100) NOT NULL,
    descripcion     TEXT,
    CONSTRAINT uq_rol_empresa_codigo UNIQUE (empresa_id, codigo)
);

CREATE TABLE permiso (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(80)  NOT NULL,
    modulo          VARCHAR(50)  NOT NULL,
    nombre          VARCHAR(150) NOT NULL,
    CONSTRAINT uq_permiso_codigo UNIQUE (codigo)
);

CREATE TABLE rol_permiso (
    rol_id          BIGINT NOT NULL REFERENCES rol (id) ON DELETE CASCADE,
    permiso_id      BIGINT NOT NULL REFERENCES permiso (id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE usuario_rol (
    usuario_id      BIGINT NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    rol_id          BIGINT NOT NULL REFERENCES rol (id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, rol_id)
);

CREATE TABLE bitacora (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      BIGINT       NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
    usuario_id      BIGINT       REFERENCES usuario (id) ON DELETE SET NULL,
    entidad         VARCHAR(80)  NOT NULL,
    entidad_id      BIGINT,
    accion          VARCHAR(50)  NOT NULL,
    detalle         JSONB,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bitacora_empresa_fecha ON bitacora (empresa_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Tiempo y parámetros
-- ---------------------------------------------------------------------------

CREATE TABLE vigencia (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      BIGINT           NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
    anio            SMALLINT         NOT NULL,
    fecha_inicio    DATE             NOT NULL,
    fecha_fin       DATE             NOT NULL,
    estado          estado_vigencia  NOT NULL DEFAULT 'abierta',
    CONSTRAINT uq_vigencia_empresa_anio UNIQUE (empresa_id, anio),
    CONSTRAINT ck_vigencia_fechas CHECK (fecha_fin >= fecha_inicio)
);

CREATE TABLE periodo (
    id              BIGSERIAL PRIMARY KEY,
    vigencia_id     BIGINT           NOT NULL REFERENCES vigencia (id) ON DELETE RESTRICT,
    numero_mes      SMALLINT         NOT NULL,
    nombre          VARCHAR(30)      NOT NULL,
    fecha_inicio    DATE             NOT NULL,
    fecha_fin       DATE             NOT NULL,
    estado          estado_periodo   NOT NULL DEFAULT 'abierto',
    CONSTRAINT uq_periodo_vigencia_mes UNIQUE (vigencia_id, numero_mes),
    CONSTRAINT ck_periodo_numero_mes CHECK (numero_mes BETWEEN 1 AND 12),
    CONSTRAINT ck_periodo_fechas CHECK (fecha_fin >= fecha_inicio)
);

CREATE TABLE version_presupuesto (
    id              BIGSERIAL PRIMARY KEY,
    vigencia_id     BIGINT           NOT NULL REFERENCES vigencia (id) ON DELETE RESTRICT,
    codigo          VARCHAR(30)      NOT NULL,
    nombre          VARCHAR(150)     NOT NULL,
    estado          estado_version   NOT NULL DEFAULT 'borrador',
    es_vigente      BOOLEAN          NOT NULL DEFAULT FALSE,
    aprobada_por    BIGINT           REFERENCES usuario (id) ON DELETE SET NULL,
    aprobada_en     TIMESTAMPTZ,
    CONSTRAINT uq_version_vigencia_codigo UNIQUE (vigencia_id, codigo)
);

CREATE UNIQUE INDEX uq_version_una_vigente_por_vigencia
    ON version_presupuesto (vigencia_id)
    WHERE es_vigente = TRUE;

CREATE TABLE parametro_proyeccion (
    id                          BIGSERIAL PRIMARY KEY,
    version_id                  BIGINT NOT NULL REFERENCES version_presupuesto (id) ON DELETE CASCADE,
    tasa_crecimiento_anual      NUMERIC(9, 6) NOT NULL DEFAULT 0,
    pct_costo_sobre_ingreso     NUMERIC(9, 6) NOT NULL DEFAULT 0,
    pct_comision_sobre_ingreso  NUMERIC(9, 6) NOT NULL DEFAULT 0,
    pct_contingencia_sobre_fijos NUMERIC(9, 6) NOT NULL DEFAULT 0.05,
    CONSTRAINT uq_parametro_version UNIQUE (version_id),
    CONSTRAINT ck_tasa_crecimiento CHECK (tasa_crecimiento_anual >= -1),
    CONSTRAINT ck_pct_costo CHECK (pct_costo_sobre_ingreso BETWEEN 0 AND 1),
    CONSTRAINT ck_pct_comision CHECK (pct_comision_sobre_ingreso BETWEEN 0 AND 1),
    CONSTRAINT ck_pct_contingencia CHECK (pct_contingencia_sobre_fijos BETWEEN 0 AND 1)
);

CREATE TABLE estacionalidad (
    id              BIGSERIAL PRIMARY KEY,
    version_id      BIGINT       NOT NULL REFERENCES version_presupuesto (id) ON DELETE CASCADE,
    numero_mes      SMALLINT     NOT NULL,
    indice          NUMERIC(9, 6) NOT NULL DEFAULT 1.000000,
    CONSTRAINT uq_estacionalidad_version_mes UNIQUE (version_id, numero_mes),
    CONSTRAINT ck_estacionalidad_mes CHECK (numero_mes BETWEEN 1 AND 12),
    CONSTRAINT ck_estacionalidad_indice CHECK (indice > 0)
);

-- ---------------------------------------------------------------------------
-- Rubros y homologación
-- ---------------------------------------------------------------------------

CREATE TABLE cuenta_contable (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      BIGINT            NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
    codigo          VARCHAR(30)       NOT NULL,
    nombre          VARCHAR(255)      NOT NULL,
    cuenta_padre_id BIGINT            REFERENCES cuenta_contable (id) ON DELETE RESTRICT,
    nivel           SMALLINT          NOT NULL DEFAULT 1,
    naturaleza      naturaleza_cuenta NOT NULL,
    es_imputable    BOOLEAN           NOT NULL DEFAULT TRUE,
    activa          BOOLEAN           NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_cuenta_empresa_codigo UNIQUE (empresa_id, codigo)
);

CREATE TABLE rubro (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      BIGINT       NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
    vigencia_id     BIGINT       NOT NULL REFERENCES vigencia (id) ON DELETE RESTRICT,
    codigo          VARCHAR(30)  NOT NULL,
    nombre          VARCHAR(255) NOT NULL,
    rubro_padre_id  BIGINT       REFERENCES rubro (id) ON DELETE RESTRICT,
    nivel           SMALLINT     NOT NULL DEFAULT 1,
    tipo            tipo_rubro   NOT NULL,
    es_imputable    BOOLEAN      NOT NULL DEFAULT TRUE,
    orden           SMALLINT     NOT NULL DEFAULT 0,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_rubro_vigencia_codigo UNIQUE (vigencia_id, codigo)
);

CREATE TABLE rubro_cuenta (
    id                  BIGSERIAL PRIMARY KEY,
    rubro_id            BIGINT  NOT NULL REFERENCES rubro (id) ON DELETE RESTRICT,
    cuenta_contable_id  BIGINT  NOT NULL REFERENCES cuenta_contable (id) ON DELETE RESTRICT,
    porcentaje          NUMERIC(9, 4) NOT NULL DEFAULT 100,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_rubro_cuenta UNIQUE (rubro_id, cuenta_contable_id),
    CONSTRAINT ck_rubro_cuenta_porcentaje CHECK (porcentaje > 0 AND porcentaje <= 100)
);

CREATE TABLE centro_costo (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      BIGINT       NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
    codigo          VARCHAR(30)  NOT NULL,
    nombre          VARCHAR(255) NOT NULL,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_centro_costo_empresa_codigo UNIQUE (empresa_id, codigo)
);

-- ---------------------------------------------------------------------------
-- Histórico base
-- ---------------------------------------------------------------------------

CREATE TABLE historico_base (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      BIGINT       NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
    anio_origen     SMALLINT     NOT NULL,
    numero_mes      SMALLINT     NOT NULL,
    rubro_id        BIGINT       NOT NULL REFERENCES rubro (id) ON DELETE RESTRICT,
    valor           NUMERIC(18, 2) NOT NULL DEFAULT 0,
    CONSTRAINT uq_historico_base UNIQUE (empresa_id, anio_origen, numero_mes, rubro_id),
    CONSTRAINT ck_historico_mes CHECK (numero_mes BETWEEN 1 AND 12)
);

-- ---------------------------------------------------------------------------
-- Movimientos presupuestales
-- ---------------------------------------------------------------------------

CREATE TABLE tipo_movimiento (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL,
    nombre          VARCHAR(80) NOT NULL,
    signo           SMALLINT    NOT NULL,
    CONSTRAINT uq_tipo_movimiento_codigo UNIQUE (codigo),
    CONSTRAINT ck_tipo_movimiento_signo CHECK (signo IN (-1, 0, 1))
);

CREATE TABLE movimiento_presupuesto (
    id                  BIGSERIAL PRIMARY KEY,
    empresa_id          BIGINT              NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
    vigencia_id         BIGINT              NOT NULL REFERENCES vigencia (id) ON DELETE RESTRICT,
    version_id          BIGINT              NOT NULL REFERENCES version_presupuesto (id) ON DELETE RESTRICT,
    tipo_movimiento_id  BIGINT              NOT NULL REFERENCES tipo_movimiento (id) ON DELETE RESTRICT,
    numero              VARCHAR(30)         NOT NULL,
    fecha               DATE                NOT NULL,
    periodo_id          BIGINT              REFERENCES periodo (id) ON DELETE RESTRICT,
    descripcion         TEXT,
    estado              estado_movimiento   NOT NULL DEFAULT 'borrador',
    usuario_id          BIGINT              NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
    aprobado_por        BIGINT              REFERENCES usuario (id) ON DELETE SET NULL,
    aprobado_en         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_movimiento_empresa_numero UNIQUE (empresa_id, numero)
);

CREATE INDEX idx_movimiento_version_estado ON movimiento_presupuesto (version_id, estado);

CREATE TABLE movimiento_detalle (
    id                      BIGSERIAL PRIMARY KEY,
    movimiento_id           BIGINT              NOT NULL REFERENCES movimiento_presupuesto (id) ON DELETE CASCADE,
    rubro_id                BIGINT              NOT NULL REFERENCES rubro (id) ON DELETE RESTRICT,
    periodo_id              BIGINT              NOT NULL REFERENCES periodo (id) ON DELETE RESTRICT,
    centro_costo_id         BIGINT              REFERENCES centro_costo (id) ON DELETE RESTRICT,
    naturaleza_traslado     naturaleza_traslado NOT NULL DEFAULT 'nula',
    valor                   NUMERIC(18, 2)      NOT NULL,
    observacion             TEXT,
    CONSTRAINT ck_movimiento_detalle_valor CHECK (valor >= 0)
);

CREATE INDEX idx_movimiento_detalle_rubro_periodo ON movimiento_detalle (rubro_id, periodo_id);

-- ---------------------------------------------------------------------------
-- Proyección
-- ---------------------------------------------------------------------------

CREATE TABLE proyeccion_ingreso (
    id                  BIGSERIAL PRIMARY KEY,
    version_id          BIGINT            NOT NULL REFERENCES version_presupuesto (id) ON DELETE CASCADE,
    periodo_id          BIGINT            NOT NULL REFERENCES periodo (id) ON DELETE RESTRICT,
    rubro_id            BIGINT            NOT NULL REFERENCES rubro (id) ON DELETE RESTRICT,
    venta_base          NUMERIC(18, 2)    NOT NULL DEFAULT 0,
    indice_estacional   NUMERIC(9, 6)     NOT NULL DEFAULT 1,
    tasa_crecimiento    NUMERIC(9, 6)     NOT NULL DEFAULT 0,
    valor_proyectado    NUMERIC(18, 2)    NOT NULL DEFAULT 0,
    origen              origen_proyeccion NOT NULL DEFAULT 'formula',
    updated_by          BIGINT            REFERENCES usuario (id) ON DELETE SET NULL,
    updated_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_proyeccion_ingreso UNIQUE (version_id, periodo_id, rubro_id)
);

CREATE TABLE proyeccion_gasto (
    id                  BIGSERIAL PRIMARY KEY,
    version_id          BIGINT                NOT NULL REFERENCES version_presupuesto (id) ON DELETE CASCADE,
    periodo_id          BIGINT                NOT NULL REFERENCES periodo (id) ON DELETE RESTRICT,
    rubro_id            BIGINT                NOT NULL REFERENCES rubro (id) ON DELETE RESTRICT,
    tipo_calculo        tipo_calculo_gasto    NOT NULL,
    base_calculo        NUMERIC(18, 2)        NOT NULL DEFAULT 0,
    porcentaje          NUMERIC(9, 6)         NOT NULL DEFAULT 0,
    valor_proyectado    NUMERIC(18, 2)        NOT NULL DEFAULT 0,
    origen              origen_proyeccion     NOT NULL DEFAULT 'formula',
    updated_by          BIGINT                REFERENCES usuario (id) ON DELETE SET NULL,
    updated_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_proyeccion_gasto UNIQUE (version_id, periodo_id, rubro_id)
);

-- ---------------------------------------------------------------------------
-- Balance contable
-- ---------------------------------------------------------------------------

CREATE TABLE lote_balance (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      BIGINT                NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
    periodo_id      BIGINT                NOT NULL REFERENCES periodo (id) ON DELETE RESTRICT,
    nombre_archivo  VARCHAR(255),
    usuario_id      BIGINT                NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
    fecha_carga     TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    estado          estado_lote_balance   NOT NULL DEFAULT 'cargado'
);

CREATE UNIQUE INDEX uq_lote_balance_periodo_activo
    ON lote_balance (periodo_id)
    WHERE estado = 'cargado';

CREATE TABLE balance_contable (
    id                  BIGSERIAL PRIMARY KEY,
    lote_id             BIGINT         NOT NULL REFERENCES lote_balance (id) ON DELETE CASCADE,
    periodo_id          BIGINT         NOT NULL REFERENCES periodo (id) ON DELETE RESTRICT,
    cuenta_contable_id  BIGINT         NOT NULL REFERENCES cuenta_contable (id) ON DELETE RESTRICT,
    centro_costo_id     BIGINT         REFERENCES centro_costo (id) ON DELETE RESTRICT,
    saldo_inicial       NUMERIC(18, 2) NOT NULL DEFAULT 0,
    debitos             NUMERIC(18, 2) NOT NULL DEFAULT 0,
    creditos            NUMERIC(18, 2) NOT NULL DEFAULT 0,
    saldo_final         NUMERIC(18, 2) NOT NULL DEFAULT 0,
    CONSTRAINT uq_balance_lote_cuenta_cc UNIQUE (lote_id, cuenta_contable_id, centro_costo_id)
);

CREATE INDEX idx_balance_periodo_cuenta ON balance_contable (periodo_id, cuenta_contable_id);

-- ---------------------------------------------------------------------------
-- Datos semilla: tipos de movimiento y permisos
-- ---------------------------------------------------------------------------

INSERT INTO tipo_movimiento (codigo, nombre, signo) VALUES
    ('inicial',   'Presupuesto inicial',  1),
    ('adicion',   'Adición',              1),
    ('reduccion', 'Reducción',           -1),
    ('traslado',  'Traslado',             0);

INSERT INTO permiso (codigo, modulo, nombre) VALUES
    ('vigencias.ver',       'vigencias',     'Ver vigencias'),
    ('vigencias.crear',     'vigencias',     'Crear vigencias'),
    ('vigencias.editar',    'vigencias',     'Editar vigencias'),
    ('vigencias.cerrar',    'vigencias',     'Cerrar vigencias'),
    ('periodos.ver',        'periodos',      'Ver periodos'),
    ('periodos.crear',      'periodos',      'Crear periodos'),
    ('periodos.cerrar',     'periodos',      'Cerrar periodos'),
    ('rubros.ver',          'rubros',        'Ver rubros'),
    ('rubros.crear',        'rubros',        'Crear rubros'),
    ('rubros.editar',       'rubros',        'Editar rubros'),
    ('homologacion.ver',    'homologacion',  'Ver homologación rubro-cuenta'),
    ('homologacion.editar', 'homologacion',  'Editar homologación rubro-cuenta'),
    ('movimientos.ver',     'movimientos',   'Ver movimientos presupuestales'),
    ('movimientos.crear',   'movimientos',   'Crear movimientos'),
    ('movimientos.editar',  'movimientos',   'Editar movimientos'),
    ('movimientos.aprobar', 'movimientos',   'Aprobar movimientos'),
    ('movimientos.anular',  'movimientos',   'Anular movimientos'),
    ('proyeccion.ver',      'proyeccion',    'Ver proyección'),
    ('proyeccion.crear',    'proyeccion',    'Generar proyección'),
    ('proyeccion.editar',   'proyeccion',    'Editar proyección'),
    ('proyeccion.aprobar',  'proyeccion',    'Aprobar proyección'),
    ('balance.ver',         'balance',       'Ver balance contable'),
    ('balance.cargar',      'balance',       'Cargar balance contable'),
    ('ejecucion.ver',       'ejecucion',     'Ver ejecución presupuestal'),
    ('usuarios.ver',        'usuarios',      'Ver usuarios'),
    ('usuarios.crear',      'usuarios',      'Crear usuarios'),
    ('usuarios.editar',     'usuarios',      'Editar usuarios');

-- ---------------------------------------------------------------------------
-- Vistas analíticas
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_proyeccion_rubro_mes AS
SELECT
    version_id,
    periodo_id,
    rubro_id,
    valor_proyectado
FROM proyeccion_ingreso
UNION ALL
SELECT
    version_id,
    periodo_id,
    rubro_id,
    valor_proyectado
FROM proyeccion_gasto;

CREATE OR REPLACE VIEW v_presupuesto_vigente AS
SELECT
    mp.version_id,
    md.periodo_id,
    md.rubro_id,
    SUM(
        CASE
            WHEN tm.codigo = 'traslado' THEN
                CASE md.naturaleza_traslado
                    WHEN 'origen'  THEN -md.valor
                    WHEN 'destino' THEN  md.valor
                    ELSE 0
                END
            ELSE tm.signo * md.valor
        END
    ) AS valor_vigente
FROM movimiento_detalle md
INNER JOIN movimiento_presupuesto mp ON mp.id = md.movimiento_id
INNER JOIN tipo_movimiento tm ON tm.id = mp.tipo_movimiento_id
WHERE mp.estado = 'aprobado'
GROUP BY mp.version_id, md.periodo_id, md.rubro_id;

CREATE OR REPLACE VIEW v_balance_por_rubro AS
SELECT
    vp.id AS version_id,
    bc.periodo_id,
    rc.rubro_id,
    SUM(bc.saldo_final * rc.porcentaje / 100.0) AS valor_balance
FROM balance_contable bc
INNER JOIN lote_balance lb ON lb.id = bc.lote_id AND lb.estado = 'cargado'
INNER JOIN rubro_cuenta rc ON rc.cuenta_contable_id = bc.cuenta_contable_id AND rc.activo = TRUE
INNER JOIN rubro r ON r.id = rc.rubro_id
INNER JOIN version_presupuesto vp ON vp.vigencia_id = r.vigencia_id
GROUP BY vp.id, bc.periodo_id, rc.rubro_id;

CREATE OR REPLACE VIEW v_ejecucion_mensual AS
SELECT
    vp.id AS version_id,
    p.id AS periodo_id,
    r.id AS rubro_id,
    COALESCE(proy.valor_proyectado, 0) AS valor_proyectado,
    COALESCE(vig.valor_vigente, 0) AS valor_vigente,
    COALESCE(bal.valor_balance, 0) AS valor_balance,
    COALESCE(bal.valor_balance, 0) - COALESCE(proy.valor_proyectado, 0) AS desviacion_vs_proyectado,
    COALESCE(bal.valor_balance, 0) - COALESCE(vig.valor_vigente, 0) AS desviacion_vs_vigente,
    CASE
        WHEN COALESCE(proy.valor_proyectado, 0) = 0 THEN NULL
        ELSE COALESCE(bal.valor_balance, 0) / proy.valor_proyectado
    END AS pct_ejecucion
FROM version_presupuesto vp
INNER JOIN periodo p ON p.vigencia_id = vp.vigencia_id
INNER JOIN rubro r ON r.vigencia_id = vp.vigencia_id AND r.es_imputable = TRUE AND r.activo = TRUE
LEFT JOIN v_proyeccion_rubro_mes proy
    ON proy.version_id = vp.id AND proy.periodo_id = p.id AND proy.rubro_id = r.id
LEFT JOIN v_presupuesto_vigente vig
    ON vig.version_id = vp.id AND vig.periodo_id = p.id AND vig.rubro_id = r.id
LEFT JOIN v_balance_por_rubro bal
    ON bal.version_id = vp.id AND bal.periodo_id = p.id AND bal.rubro_id = r.id;

CREATE OR REPLACE VIEW v_totalizador_mensual AS
WITH base AS (
    SELECT
        e.version_id,
        e.periodo_id,
        p.numero_mes,
        r.tipo,
        e.valor_proyectado,
        e.valor_balance
    FROM v_ejecucion_mensual e
    INNER JOIN rubro r ON r.id = e.rubro_id
    INNER JOIN periodo p ON p.id = e.periodo_id
),
agg AS (
    SELECT
        version_id,
        periodo_id,
        numero_mes,
        SUM(valor_proyectado) FILTER (WHERE tipo = 'ingreso_operativo') AS ing_oper_proy,
        SUM(valor_proyectado) FILTER (WHERE tipo = 'ingreso_no_operativo') AS ing_no_oper_proy,
        SUM(valor_proyectado) FILTER (WHERE tipo = 'costo_variable') AS costo_var_proy,
        SUM(valor_proyectado) FILTER (WHERE tipo = 'comision') AS comision_proy,
        SUM(valor_proyectado) FILTER (WHERE tipo = 'gasto_fijo') AS gasto_fijo_proy,
        SUM(valor_proyectado) FILTER (WHERE tipo = 'contingencia') AS contingencia_proy,
        SUM(valor_proyectado) FILTER (WHERE tipo IN (
            'ingreso_operativo', 'ingreso_no_operativo'
        )) AS ingresos_proyectados,
        SUM(valor_proyectado) FILTER (WHERE tipo IN (
            'costo_variable', 'comision', 'gasto_fijo', 'contingencia'
        )) AS gastos_proyectados,
        SUM(valor_balance) FILTER (WHERE tipo IN (
            'ingreso_operativo', 'ingreso_no_operativo'
        )) AS ingresos_balance,
        SUM(valor_balance) FILTER (WHERE tipo IN (
            'costo_variable', 'comision', 'gasto_fijo', 'contingencia'
        )) AS gastos_balance
    FROM base
    GROUP BY version_id, periodo_id, numero_mes
),
calc AS (
    SELECT
        version_id,
        periodo_id,
        numero_mes,
        ingresos_proyectados,
        gastos_proyectados,
        ing_oper_proy - costo_var_proy AS utilidad_bruta,
        ing_oper_proy - costo_var_proy - comision_proy - gasto_fijo_proy - contingencia_proy AS utilidad_operativa,
        ing_oper_proy - costo_var_proy - comision_proy - gasto_fijo_proy - contingencia_proy + ing_no_oper_proy AS flujo_caja_neto,
        ingresos_balance,
        gastos_balance,
        (ingresos_balance - gastos_balance) - (ingresos_proyectados - gastos_proyectados) AS desviacion,
        CASE
            WHEN (ing_oper_proy + ing_no_oper_proy) = 0 THEN NULL
            ELSE (
                ing_oper_proy - costo_var_proy - comision_proy - gasto_fijo_proy - contingencia_proy + ing_no_oper_proy
            ) / (ing_oper_proy + ing_no_oper_proy)
        END AS margen_neto_mes
    FROM agg
)
SELECT
    version_id,
    periodo_id,
    ingresos_proyectados,
    gastos_proyectados,
    utilidad_bruta,
    utilidad_operativa,
    flujo_caja_neto,
    ingresos_balance,
    gastos_balance,
    desviacion,
    margen_neto_mes,
    CASE
        WHEN SUM(ingresos_proyectados) OVER w = 0 THEN NULL
        ELSE SUM(flujo_caja_neto) OVER w / SUM(ingresos_proyectados) OVER w
    END AS margen_neto_acumulado
FROM calc
WINDOW w AS (
    PARTITION BY version_id
    ORDER BY numero_mes
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
);

COMMIT;
