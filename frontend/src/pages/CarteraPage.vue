<template>
  <q-page class="vi-page">
    <div class="vi-wrap">
      <TableroEncabezado
        kicker="Clínica Esperanza · Gestión de Cartera"
        titulo="Cartera Ejecutiva y Edades de Vencimiento"
        :subtitulo="`Corte sincronizado al ${fechaCorteTexto}. Análisis de $${millones(resumen.saldo_total)} millones en cartera activa.`"
      />

      <div v-if="loading" class="text-center q-my-xl">
        <q-spinner-dots size="48px" color="primary" />
        <div class="q-mt-sm text-grey-7">Cargando información de cartera...</div>
      </div>

      <div v-else-if="error" class="q-my-md q-pa-md bg-red-1 text-negative border-radius-8">
        {{ error }}
      </div>

      <template v-else>
        <!-- KPI Cards -->
        <section class="vi-kpis">
          <article class="vi-kpi">
            <span>Saldo Total de Cartera</span>
            <strong>{{ cop(resumen.saldo_total) }}</strong>
            <em>{{ resumen.total_facturas }} facturas · {{ resumen.total_deudores }} terceros</em>
          </article>
          <article class="vi-kpi">
            <span>Corriente (0-30 días)</span>
            <strong>{{ cop(resumen.d0_30) }}</strong>
            <em>{{ pct(pctCorriente) }} del saldo total</em>
          </article>
          <article class="vi-kpi">
            <span>Vencida (> 30 días)</span>
            <strong class="text-negative">{{ cop(vencidoMas30) }}</strong>
            <em>{{ pct(pctVencida) }} del total activo</em>
          </article>
          <article class="vi-kpi">
            <span>Crítica (> 180 días)</span>
            <strong style="color: #c92a2a">{{ cop(criticaMas180) }}</strong>
            <em>{{ pct(pctCritica) }} en alto riesgo</em>
          </article>
        </section>

        <!-- Bloque de Estado de Radicación de Cuentas de Cobro -->
        <article class="vi-card q-my-sm" style="border-left: 4px solid var(--vi-azul);">
          <div class="row items-center justify-between q-mb-xs">
            <div>
              <h2 class="q-ma-none text-subtitle2 text-weight-bold">Control de Radicación de Cuentas de Cobro</h2>
              <div class="text-caption text-grey-7">Trazabilidad de entrega ante entidades pagadoras / EPS</div>
            </div>
            <q-badge color="primary" label="Trazabilidad Institucional" />
          </div>
          <div class="row q-col-gutter-sm q-pt-xs">
            <div class="col-12 col-md-6">
              <div class="q-pa-sm bg-green-1 border-radius-8">
                <div class="row items-center justify-between">
                  <div>
                    <div class="text-caption text-weight-bold text-positive">CUENTAS RADICADAS FORMALMENTE</div>
                    <div class="text-subtitle1 text-weight-bold text-positive">{{ radStats.radicadasCount }} cuentas ({{ radStats.radicadasFacturas }} facturas)</div>
                  </div>
                  <q-icon name="check_circle" size="24px" color="positive" />
                </div>
                <div class="text-caption text-grey-8">{{ cop(radStats.radicadasValor) }} en trámite de pago</div>
              </div>
            </div>
            <div class="col-12 col-md-6">
              <div class="q-pa-sm bg-orange-1 border-radius-8">
                <div class="row items-center justify-between">
                  <div>
                    <div class="text-caption text-weight-bold text-orange-9">PENDIENTES POR RADICAR</div>
                    <div class="text-subtitle1 text-weight-bold text-orange-9">{{ radStats.pendientesCount }} cuentas ({{ radStats.pendientesFacturas }} facturas)</div>
                  </div>
                  <q-icon name="schedule" size="24px" color="orange" />
                </div>
                <div class="text-caption text-grey-8">{{ cop(radStats.pendientesValor) }} por entregar a EPS</div>
              </div>
            </div>
          </div>
        </article>

        <!-- Gráficos de Edades y Composición -->
        <section class="vi-grid-2">
          <article class="vi-card">
            <h2>Distribución por Edades de Vencimiento</h2>
            <ChartBars titulo="Aging de Cartera (COP)" :items="edadesItems" :format="cop" />
          </article>
          <article class="vi-card">
            <h2>Riesgo de Cartera</h2>
            <ChartDonut
              titulo="Composición por Calidad de Deuda"
              :items="composicionRiesgo"
              :centro="millones(resumen.saldo_total)"
              subtitulo="millones"
              :format="cop"
            />
          </article>
        </section>

        <!-- Tabla Top Deudores -->
        <article class="vi-card q-mt-md">
          <div class="row items-center justify-between q-mb-md">
            <div>
              <h2 class="q-ma-none">Top Deudores de Mayor Concentración</h2>
              <div class="text-caption text-grey-7">Entidades que concentran el mayor saldo en la cartera institucional</div>
            </div>
            <q-badge color="primary" :label="`${topDeudores.length} deudores principales`" />
          </div>

          <q-table
            class="vi-table"
            flat
            :rows="topDeudores"
            :columns="columnas"
            row-key="idtercero"
            hide-bottom
            :pagination="{ rowsPerPage: 15 }"
          >
            <template #body-cell-saldo_total="props">
              <q-td :props="props" class="text-weight-bold">
                {{ cop(props.value) }}
              </q-td>
            </template>
            <template #body-cell-saldo_vencido="props">
              <q-td :props="props" class="text-negative">
                {{ cop(props.value) }}
              </q-td>
            </template>
            <template #body-cell-pct_concentracion="props">
              <q-td :props="props">
                <q-linear-progress
                  :value="props.row.saldo_total / resumen.saldo_total"
                  color="primary"
                  track-color="grey-3"
                  class="q-mt-xs"
                  rounded
                />
                <span class="text-caption">{{ pct((props.row.saldo_total / resumen.saldo_total) * 100) }}</span>
              </q-td>
            </template>
          </q-table>
        </article>
      </template>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from 'boot/api'
import TableroEncabezado from '../components/panel/TableroEncabezado.vue'
import ChartBars from '../components/charts/ChartBars.vue'
import ChartDonut from '../components/charts/ChartDonut.vue'
import { tinta } from '../data/demoPresentacion.js'
import { cop, millones, pct } from '../utils/formato.js'

const loading = ref(true)
const error = ref('')
const resumen = ref({
  saldo_total: 0,
  d0_30: 0,
  d31_60: 0,
  d61_90: 0,
  d91_120: 0,
  d121_150: 0,
  d151_180: 0,
  d181_360: 0,
  d361_mas: 0,
  total_facturas: 0,
  total_deudores: 0,
  fecha_corte: null,
})
const topDeudores = ref([])
const radicacionData = ref([])

const radStats = computed(() => {
  const rad = radicacionData.value.find((r) => r.radicada === true) || {}
  const pend = radicacionData.value.find((r) => r.radicada === false) || {}
  return {
    radicadasCount: Number(rad.total_cuentas || 0),
    radicadasFacturas: Number(rad.total_facturas || 0),
    radicadasValor: Number(rad.valor_total || 0),
    pendientesCount: Number(pend.total_cuentas || 0),
    pendientesFacturas: Number(pend.total_facturas || 0),
    pendientesValor: Number(pend.valor_total || 0),
  }
})

const fechaCorteTexto = computed(() => {
  if (!resumen.value.fecha_corte) return 'Último corte'
  return new Date(resumen.value.fecha_corte).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

const vencidoMas30 = computed(() => {
  const r = resumen.value
  return (
    Number(r.d31_60 || 0) +
    Number(r.d61_90 || 0) +
    Number(r.d91_120 || 0) +
    Number(r.d121_150 || 0) +
    Number(r.d151_180 || 0) +
    Number(r.d181_360 || 0) +
    Number(r.d361_mas || 0)
  )
})

const criticaMas180 = computed(() => {
  const r = resumen.value
  return Number(r.d181_360 || 0) + Number(r.d361_mas || 0)
})

const pctCorriente = computed(() => {
  if (!resumen.value.saldo_total) return 0
  return (Number(resumen.value.d0_30) / Number(resumen.value.saldo_total)) * 100
})

const pctVencida = computed(() => {
  if (!resumen.value.saldo_total) return 0
  return (vencidoMas30.value / Number(resumen.value.saldo_total)) * 100
})

const pctCritica = computed(() => {
  if (!resumen.value.saldo_total) return 0
  return (criticaMas180.value / Number(resumen.value.saldo_total)) * 100
})

const edadesItems = computed(() => [
  { label: '0 a 30 días', value: Number(resumen.value.d0_30 || 0), color: tinta.verde },
  { label: '31 a 60 días', value: Number(resumen.value.d31_60 || 0), color: tinta.cyan },
  { label: '61 a 90 días', value: Number(resumen.value.d61_90 || 0), color: tinta.azul },
  { label: '91 a 120 días', value: Number(resumen.value.d91_120 || 0), color: tinta.actual },
  { label: '121 a 180 días', value: Number(resumen.value.d121_150 || 0) + Number(resumen.value.d151_180 || 0), color: tinta.naranja },
  { label: '181 a 360 días', value: Number(resumen.value.d181_360 || 0), color: '#EA580C' },
  { label: '> 360 días', value: Number(resumen.value.d361_mas || 0), color: tinta.rojo },
])

const composicionRiesgo = computed(() => [
  { label: '0-30 días (Corriente)', value: Number(resumen.value.d0_30 || 0), color: tinta.verde },
  { label: '31-180 días (Media mora)', value: vencidoMas30.value - criticaMas180.value, color: tinta.naranja },
  { label: '>180 días (Deterioro crítico)', value: criticaMas180.value, color: tinta.rojo },
])

const columnas = [
  { name: 'razon_social', label: 'Razón Social / Pagador', field: 'razon_social', align: 'left', style: 'max-width: 320px; white-space: normal;' },
  { name: 'nit', label: 'NIT', field: 'nit', align: 'left' },
  { name: 'total_facturas', label: 'Facturas', field: 'total_facturas', align: 'center' },
  { name: 'saldo_total', label: 'Saldo Total', field: 'saldo_total', align: 'right' },
  { name: 'saldo_vencido', label: 'Saldo Vencido', field: 'saldo_vencido', align: 'right' },
  { name: 'dias_promedio', label: 'Días Mora Prom.', field: 'dias_promedio', align: 'center' },
  { name: 'pct_concentracion', label: '% Riesgo Concentrado', field: 'saldo_total', align: 'left', style: 'min-width: 140px;' },
]

async function cargarDatos() {
  loading.value = true
  error.value = ''
  try {
    const [resResumen, resTop, resRad] = await Promise.all([
      api.get('/tableros/cartera/resumen'),
      api.get('/tableros/cartera/top-deudores?limit=10'),
      api.get('/tableros/cartera/radicacion'),
    ])
    if (resResumen.data) resumen.value = resResumen.data
    if (resTop.data) topDeudores.value = resTop.data
    if (resRad.data) radicacionData.value = resRad.data
  } catch (err) {
    error.value = 'No se pudo cargar la información de cartera: ' + (err.message || '')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  cargarDatos()
})
</script>
