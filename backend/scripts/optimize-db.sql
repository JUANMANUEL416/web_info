-- 1. Tabla catálogo de terceros limpia y rápida
CREATE TABLE IF NOT EXISTS syn_tercero (
    idtercero       VARCHAR(20) PRIMARY KEY,
    razon_social    VARCHAR(255) NOT NULL,
    nit             VARCHAR(20),
    fecha_sync      TIMESTAMPTZ DEFAULT NOW()
);

-- Poblar con los terceros que ya tenemos en facturas
INSERT INTO syn_tercero (idtercero, razon_social, nit)
SELECT idtercero, MAX(razon_social), MAX(nit)
FROM syn_factura
WHERE idtercero IS NOT NULL AND razon_social IS NOT NULL AND razon_social <> ''
GROUP BY idtercero
ON CONFLICT (idtercero) DO UPDATE SET
  razon_social = EXCLUDED.razon_social,
  nit = EXCLUDED.nit;

-- 2. Índices de aceleración para syn_cartera_foto
CREATE INDEX IF NOT EXISTS idx_cartera_foto_corte_tercero 
ON syn_cartera_foto(fecha_corte, idtercero);

CREATE INDEX IF NOT EXISTS idx_cartera_foto_saldo 
ON syn_cartera_foto(saldo_neto);
