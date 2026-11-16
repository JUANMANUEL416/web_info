-- ===========================================================================
-- Esquema de réplica local para Ciclo de Ingresos, Cartera y Glosas (Qrystalos)
-- Base de datos destino: PostgreSQL (View Info)
-- ===========================================================================

BEGIN;

-- 1. Tabla de Facturación diaria (espejo enriquecido de FTR)
CREATE TABLE IF NOT EXISTS syn_factura (
    n_factura           VARCHAR(20) PRIMARY KEY,
    idtercero           VARCHAR(20) NOT NULL,
    razon_social        VARCHAR(255),
    nit                 VARCHAR(20),
    fecha               DATE NOT NULL,
    f_vence             DATE,
    valor_total         NUMERIC(18, 2) NOT NULL DEFAULT 0,
    estado              VARCHAR(2) NOT NULL DEFAULT 'O', -- O=Operativa, A=Anulada, P=Pendiente
    facte               SMALLINT DEFAULT 0,              -- 0=Sin notificar, 1=Encolada, 2=Exitosa DIAN
    cufe                TEXT,
    procedencia         VARCHAR(20),
    idplan              VARCHAR(10),
    regimen             VARCHAR(30),
    tipottec            VARCHAR(20),
    fecha_sync          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_syn_factura_tercero ON syn_factura(idtercero);
CREATE INDEX IF NOT EXISTS idx_syn_factura_fecha ON syn_factura(fecha);

-- 2. Tabla de Notas Crédito y Débito (espejo de FNOT)
CREATE TABLE IF NOT EXISTS syn_nota_credito (
    cnsfnot             VARCHAR(20) PRIMARY KEY,
    clase               VARCHAR(2) NOT NULL, -- C=Crédito, D=Débito
    n_factura           VARCHAR(20) NOT NULL,
    idtercero           VARCHAR(20),
    fecha               DATE NOT NULL,
    vr_total            NUMERIC(18, 2) NOT NULL DEFAULT 0,
    procedencia         VARCHAR(30),         -- CARTERA, AJUSTE, etc.
    motivo              VARCHAR(50),
    observacion         TEXT,
    estado              VARCHAR(2) DEFAULT 'O',
    cerrada             SMALLINT DEFAULT 1,
    anula_factura       BOOLEAN DEFAULT FALSE,
    fecha_sync          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_syn_nota_factura ON syn_nota_credito(n_factura);
CREATE INDEX IF NOT EXISTS idx_syn_nota_fecha ON syn_nota_credito(fecha);

-- 3. Tabla de Cuentas de Cobro (espejo de FCXC y detalle FCXCD)
CREATE TABLE IF NOT EXISTS syn_cuenta_cobro (
    cnscxc              VARCHAR(20) NOT NULL,
    n_factura           VARCHAR(20) NOT NULL,
    idtercero           VARCHAR(20) NOT NULL,
    fecha_cxc           DATE,
    cerrada             SMALLINT DEFAULT 0,
    radicada            BOOLEAN DEFAULT FALSE,
    f_radicado          DATE,
    num_radicado        VARCHAR(50),
    quien_recibe        VARCHAR(150),
    valor_factura       NUMERIC(18, 2) DEFAULT 0,
    fecha_sync          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (cnscxc, n_factura)
);

CREATE INDEX IF NOT EXISTS idx_syn_cxc_factura ON syn_cuenta_cobro(n_factura);
CREATE INDEX IF NOT EXISTS idx_syn_cxc_radicado ON syn_cuenta_cobro(radicada, f_radicado);

-- 4. Tabla de Recaudos / Pagos de Cartera (espejo de FPAG / FPAGD)
CREATE TABLE IF NOT EXISTS syn_recaudo (
    id_recaudo_detalle  BIGSERIAL PRIMARY KEY,
    cnsfpag             VARCHAR(20) NOT NULL,
    n_factura           VARCHAR(20) NOT NULL,
    cnscxc              VARCHAR(20),
    idtercero           VARCHAR(20),
    fecha_creacion      DATE NOT NULL,
    fecha_confirmacion  DATE,
    origen_pago         VARCHAR(20), -- BANCOS, CAJA, CXP, etc.
    valor_pago          NUMERIC(18, 2) NOT NULL DEFAULT 0,
    valor_impuestos     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    valor_descuento     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    estado              VARCHAR(20) DEFAULT 'Cerrado',
    cerrado             SMALLINT DEFAULT 1,
    fecha_sync          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_syn_recaudo_factura ON syn_recaudo(n_factura);
CREATE INDEX IF NOT EXISTS idx_syn_recaudo_fecha ON syn_recaudo(fecha_confirmacion, fecha_creacion);

-- 5. Tabla de Glosas, Respuestas y Conciliaciones (espejo de FGLO / FGLOI / FCONCID)
CREATE TABLE IF NOT EXISTS syn_glosa (
    cnsglo              VARCHAR(20) NOT NULL,
    n_factura           VARCHAR(20) NOT NULL,
    cnscxc              VARCHAR(20),
    idtercero           VARCHAR(20),
    motivo_codigo       VARCHAR(20),
    motivo_descripcion  TEXT,
    fecha_notificacion  DATE,
    valor_glosado       NUMERIC(18, 2) NOT NULL DEFAULT 0,
    cerrada             SMALLINT DEFAULT 0,
    fecha_cierre        DATE,
    -- Hito de respuesta
    respondida          BOOLEAN DEFAULT FALSE,
    fecha_respuesta     DATE,
    valor_aceptado      NUMERIC(18, 2) NOT NULL DEFAULT 0,
    valor_recuperar     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    -- Hito de conciliación
    conciliada          BOOLEAN DEFAULT FALSE,
    fecha_conciliacion  DATE,
    valor_conciliado    NUMERIC(18, 2) NOT NULL DEFAULT 0,
    fecha_sync          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (cnsglo, n_factura)
);

CREATE INDEX IF NOT EXISTS idx_syn_glosa_factura ON syn_glosa(n_factura);
CREATE INDEX IF NOT EXISTS idx_syn_glosa_fecha ON syn_glosa(fecha_notificacion);

-- 6. Foto Diaria de Cartera Activa (espejo de VWK_CXCDIASVTO)
CREATE TABLE IF NOT EXISTS syn_cartera_foto (
    id_foto             BIGSERIAL PRIMARY KEY,
    fecha_corte         DATE NOT NULL,
    n_factura           VARCHAR(20) NOT NULL,
    cnscxc              VARCHAR(20),
    idtercero           VARCHAR(20) NOT NULL,
    saldo_neto          NUMERIC(18, 2) NOT NULL DEFAULT 0,
    saldo_inicial       NUMERIC(18, 2) NOT NULL DEFAULT 0,
    dias_vence          INT DEFAULT 0,
    por_vencer          NUMERIC(18, 2) DEFAULT 0,
    d0_30               NUMERIC(18, 2) DEFAULT 0,
    d31_60              NUMERIC(18, 2) DEFAULT 0,
    d61_90              NUMERIC(18, 2) DEFAULT 0,
    d91_120             NUMERIC(18, 2) DEFAULT 0,
    d121_150            NUMERIC(18, 2) DEFAULT 0,
    d151_180            NUMERIC(18, 2) DEFAULT 0,
    d181_360            NUMERIC(18, 2) DEFAULT 0,
    d361_mas            NUMERIC(18, 2) DEFAULT 0,
    radicada            VARCHAR(2) DEFAULT 'NO',
    regimen             VARCHAR(30),
    tipottec            VARCHAR(20),
    fecha_sync          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cartera_foto UNIQUE (fecha_corte, n_factura, cnscxc)
);

CREATE INDEX IF NOT EXISTS idx_syn_foto_corte ON syn_cartera_foto(fecha_corte);
CREATE INDEX IF NOT EXISTS idx_syn_foto_factura ON syn_cartera_foto(n_factura);

-- 7. Historial y Auditoría de Salida de Cartera
CREATE TABLE IF NOT EXISTS syn_factura_baja_cartera (
    id_baja             BIGSERIAL PRIMARY KEY,
    n_factura           VARCHAR(20) NOT NULL,
    idtercero           VARCHAR(20) NOT NULL,
    ultimo_saldo        NUMERIC(18, 2) NOT NULL,
    fecha_salida        DATE NOT NULL,
    motivo_salida       VARCHAR(50) NOT NULL, -- 'PAGADA', 'ANULADA_NC', 'GLOSA_ACEPTADA', 'DEVUELTA_CXC'
    detalle_soporte     TEXT,
    fecha_registro      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_syn_baja_factura ON syn_factura_baja_cartera(n_factura);

COMMIT;
