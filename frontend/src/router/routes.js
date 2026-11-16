const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/IndexPage.vue') },
      { path: 'facturacion', component: () => import('pages/FacturacionPage.vue') },
      { path: 'cartera', component: () => import('pages/CarteraPage.vue') },
      { path: 'cuentas-por-pagar', component: () => import('pages/CuentasPagarPage.vue') },
      { path: 'indicadores', component: () => import('pages/IndicadoresPage.vue') },
      { path: 'proyecciones', component: () => import('pages/ProyeccionesPage.vue') },
      { path: 'presupuestos', component: () => import('pages/PresupuestosPage.vue') },
      { path: 'rubros', component: () => import('pages/RubrosPage.vue') },
      { path: 'parametros', component: () => import('pages/ModuloTablaPage.vue'), meta: { modulo: 'parametros' } },
      { path: 'proyeccion', component: () => import('pages/ModuloTablaPage.vue'), meta: { modulo: 'proyeccion' } },
      { path: 'movimientos', component: () => import('pages/ModuloTablaPage.vue'), meta: { modulo: 'movimientos' } },
      { path: 'balance', component: () => import('pages/ModuloTablaPage.vue'), meta: { modulo: 'balance' } },
      { path: 'ejecucion', component: () => import('pages/ModuloTablaPage.vue'), meta: { modulo: 'ejecucion' } },
    ],
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
