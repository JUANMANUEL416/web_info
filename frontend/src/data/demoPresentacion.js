export const corteTexto = 'Tiempo Real'

export const tinta = {
  actual: '#0B3B60',
  azul: '#0072CE',
  cyan: '#00B5E2',
  verde: '#10B981',
  naranja: '#F59E0B',
  ciruela: '#0072CE',
  rojo: '#DC2626',
}

export const fichaRespaldo = {
  nit: '892120115-1',
  razon_social: 'Clínica Esperanza',
  moneda_codigo: 'COP',
  usuario_nombre: 'Dirección General',
  usuario_email: 'direccion@clinicaesperanza.com.co',
  anio: 2026,
  vigencia_estado: 'abierta',
}

export const avisosIniciales = [
  {
    id: 'kesperanza',
    titulo: 'Producción KESPERANZA',
    detalle: 'Facturación, cartera y cuentas por pagar de Clínica Esperanza.',
    momento: 'Hoy',
    tono: 'info',
    to: '/',
    leida: false,
  },
  {
    id: 'facturacion',
    titulo: 'Tablero de facturación',
    detalle: 'Corte de facturas, notas y estado DIAN de Clínica Esperanza.',
    momento: 'Hoy',
    tono: 'ok',
    to: '/facturacion',
    leida: false,
  },
]
