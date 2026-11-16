<template>
  <q-page class="vi-page">
    <div class="vi-wrap">
      <!-- ENCABEZADO INSTITUCIONAL CON SELECTOR DE AÑO -->
      <div class="row items-center justify-between q-mb-xs">
        <TableroEncabezado
          kicker="Clínica Esperanza · Tesorería"
          titulo="Cuentas por Pagar"
          :subtitulo="`Obligaciones con proveedores, gestión del pasivo y programación de pagos en Producción (${anioSeleccionado}).`"
        />
        <div class="row items-center q-gutter-xs">
          <q-btn-toggle
            v-model="anioSeleccionado"
            toggle-color="primary"
            dense
            outlined
            :options="[
              { label: '2026', value: 2026 },
              { label: '2025', value: 2025 }
            ]"
            @update:model-value="cambiarAnio"
          />
          <q-badge color="positive" text-color="white" class="q-px-sm q-py-xs text-weight-medium">
            <q-icon name="check_circle" size="14px" class="q-mr-xs" />
            Producción KESPERANZA
          </q-badge>
          <q-badge color="grey-3" text-color="grey-9" class="q-px-sm q-py-xs">
            {{ fechaCorteTexto }}
          </q-badge>
          <q-btn flat dense round icon="refresh" color="primary" :loading="loading" @click="cargarTodo">
            <q-tooltip>Actualizar datos</q-tooltip>
          </q-btn>
        </div>
      </div>

      <div v-if="loading" class="text-center q-my-xl">
        <q-spinner-dots size="48px" color="primary" />
        <div class="q-mt-sm text-grey-7">Cargando indicadores, temporalidades y aging de cuentas por pagar...</div>
      </div>

      <div v-else-if="error" class="q-pa-md bg-red-1 text-negative rounded-borders q-my-md">
        <div class="row items-center">
          <q-icon name="error_outline" size="24px" class="q-mr-sm" />
          <span>{{ error }}</span>
          <q-space />
          <q-btn flat dense label="Reintentar" color="negative" @click="cargarTodo" />
        </div>
      </div>

      <template v-else>
        <!-- 1. KPIS GENERALES (CAUSACIÓN DEL PERIODO Y SALDO ACTIVO) -->
        <section class="vi-kpis q-mb-sm">
          <!-- Card 1: Causación del Año Seleccionado -->
          <article class="vi-kpi" style="border-top-color: #0B3B60;">
            <div class="row items-center justify-between">
              <span>Causado Año {{ anioSeleccionado }}</span>
              <q-badge color="primary" dense>{{ cxpAnual.obligaciones_anio || 0 }} obligaciones</q-badge>
            </div>
            <strong style="color: #0B3B60;">{{ cop(cxpAnual.total_anio) }}</strong>
            <em>Total obligaciones radicadas en {{ anioSeleccionado }}</em>
          </article>

          <!-- Card 2: Causación del Mes Actual -->
          <article class="vi-kpi" style="border-top-color: #0072CE;">
            <div class="row items-center justify-between">
              <span>Causado Mes Actual</span>
              <q-badge color="teal" dense>{{ cxpMes.obligaciones_mes || 0 }} facturas</q-badge>
            </div>
            <strong style="color: #0072CE;">{{ cop(cxpMes.total_mes) }}</strong>
            <em>{{ cxpMes.mes_nombre || 'Noviembre 2026' }}</em>
          </article>

          <!-- Card 3: Causación de la Semana Actual -->
          <article class="vi-kpi" style="border-top-color: #00B5E2;">
            <div class="row items-center justify-between">
              <span>Causado Semana Actual</span>
              <q-badge color="cyan-9" text-color="white" dense>{{ cxpSemana.obligaciones_semana || 0 }} fac</q-badge>
            </div>
            <strong style="color: #00B5E2;">{{ cop(cxpSemana.total_semana) }}</strong>
            <em>Semana en curso (Lun - Dom)</em>
          </article>

          <!-- Card 4: Saldo Total Activo por Pagar -->
          <article class="vi-kpi" style="border-top-color: #EF4444;">
            <div class="row items-center justify-between">
              <span>Saldo Pendiente Actual</span>
              <q-badge color="negative" dense>{{ resumen.total_proveedores || 0 }} acreedores</q-badge>
            </div>
            <strong class="text-negative">{{ cop(resumen.saldo_total) }}</strong>
            <em>{{ resumen.total_obligaciones || 0 }} cuentas activas en mora/plazo</em>
          </article>
        </section>

        <!-- 2. ANÁLISIS TEMPORAL: SEMANA ACTUAL Y MES ACTUAL (DÍA A DÍA CON PROCEDENCIA) -->
        <section class="vi-grid-2 q-mb-sm">
          <!-- Izquierda: CxP de la Semana Actual -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-xs">
              <div>
                <h2 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">CxP de la Semana Actual</h2>
                <div class="text-caption text-grey-7">Día a día (Lun - Dom) · {{ cxpSemana.obligaciones_semana || 0 }} obligaciones</div>
              </div>
              <q-badge color="primary" :label="cop(cxpSemana.total_semana)" class="text-weight-bold" />
            </div>

            <!-- Chips de Procedencia en la Semana -->
            <div class="row items-center q-gutter-xs q-mb-xs">
              <q-chip
                v-for="p in cxpSemana.procedencias"
                :key="p.procedencia"
                size="xs"
                text-color="white"
                :style="{ background: colorProcedencia(p.procedencia) }"
              >
                {{ p.procedencia }}: {{ cop(p.total) }} ({{ p.cantidad }})
              </q-chip>
            </div>

            <ChartLine
              titulo="CxP semanal día a día (COP)"
              :categories="cxpSemanaCategorias"
              :series="serieCxpSemana"
              :format="cop"
            />
          </article>

          <!-- Derecha: CxP del Mes Actual -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-xs">
              <div>
                <h2 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">CxP del Mes Actual</h2>
                <div class="text-caption text-grey-7">{{ cxpMes.mes_nombre }} · {{ cxpMes.obligaciones_mes || 0 }} obligaciones</div>
              </div>
              <q-badge color="teal" :label="cop(cxpMes.total_mes)" class="text-weight-bold" />
            </div>

            <!-- Chips de Procedencia en el Mes -->
            <div class="row items-center q-gutter-xs q-mb-xs">
              <q-chip
                v-for="p in cxpMes.procedencias"
                :key="p.procedencia"
                size="xs"
                text-color="white"
                :style="{ background: colorProcedencia(p.procedencia) }"
              >
                {{ p.procedencia }}: {{ cop(p.total) }} ({{ p.cantidad }})
              </q-chip>
            </div>

            <ChartLine
              titulo="Evolución diaria del mes actual (COP)"
              :categories="cxpMesCategorias"
              :series="serieCxpMes"
              :format="cop"
            />
          </article>
        </section>

        <!-- 3. TENDENCIA ANUAL Y PROCEDENCIA DEL AÑO SELECCIONADO -->
        <section class="vi-grid-2 q-mb-sm">
          <!-- Izquierda: Tendencia Mensual del Año -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-xs">
              <div>
                <h2 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">CxP {{ anioSeleccionado }} · Tendencia Mensual</h2>
                <div class="text-caption text-grey-7">Causación mes a mes (Ene - Dic) de obligaciones</div>
              </div>
              <q-badge color="indigo-9" text-color="white" :label="cop(cxpAnual.total_anio)" class="text-weight-bold" />
            </div>
            <ChartLine
              titulo="Consolidado mensual de CxP (COP)"
              :categories="mesesNombres"
              :series="serieCxpAnual"
              :format="cop"
            />
          </article>

          <!-- Derecha: Desglose Anual por Procedencia -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-xs">
              <div>
                <h2 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">CxP por Procedencia (Año {{ anioSeleccionado }})</h2>
                <div class="text-caption text-grey-7">Participación según la naturaleza del gasto</div>
              </div>
              <q-badge color="grey-3" text-color="grey-8">{{ cxpAnual.procedencias ? cxpAnual.procedencias.length : 0 }} Categorías</q-badge>
            </div>
            <ChartBars titulo="CxP por Procedencia" :items="cxpProcedenciasAnualItems" :format="cop" />
          </article>
        </section>

        <!-- 4. CARTERA PASIVA: AGING DE LA DEUDA Y COMPOSICIÓN DEL SALDO ACTIVO -->
        <section class="vi-grid-2 q-mb-sm">
          <!-- Izquierda: Aging / Edad de las Obligaciones -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-xs">
              <div>
                <h2 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Edad de las Obligaciones (Aging del Saldo)</h2>
                <div class="text-caption text-grey-7">Envejecimiento de la mora en cartera pasiva activa</div>
              </div>
              <q-badge color="grey-3" text-color="grey-8">7 Franjas</q-badge>
            </div>
            <ChartBars titulo="Aging de Cuentas por Pagar" :items="agingItems" :format="cop" />
          </article>

          <!-- Derecha: Donut de Procedencia del Saldo Pendiente -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-xs">
              <div>
                <h2 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Saldo Pendiente por Procedencia</h2>
                <div class="text-caption text-grey-7">Distribución del saldo activo (\$ 425 M) según línea</div>
              </div>
              <q-badge color="grey-3" text-color="grey-8">Saldo Activo</q-badge>
            </div>
            <ChartDonut
              titulo="Composición por Procedencia"
              :items="donutItems"
              :centro="millones(resumen.saldo_total) + ' M'"
              subtitulo="Saldo Total"
              :format="cop"
            />
          </article>
        </section>

        <!-- 5. TABLA: TOP ACREEDORES / PROVEEDORES CON MAYOR SALDO -->
        <article class="vi-card q-mb-sm">
          <div class="row items-center justify-between q-mb-xs">
            <div>
              <h2 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Top Acreedores con Mayor Saldo Pendiente</h2>
              <div class="text-caption text-grey-7">
                Concentración de la cartera pasiva por proveedor (Top 15 acreedores)
              </div>
            </div>
            <div class="row items-center q-gutter-sm">
              <q-input
                v-model="filtroTop"
                dense
                outlined
                placeholder="Buscar proveedor o NIT..."
                class="search-input"
                style="min-width: 240px;"
              >
                <template #append>
                  <q-icon name="search" size="16px" />
                </template>
              </q-input>
            </div>
          </div>

          <q-table
            class="vi-table"
            flat
            dense
            :rows="topProveedoresFiltrados"
            :columns="colTop"
            row-key="idtercero"
            hide-bottom
            :pagination="{ rowsPerPage: 15 }"
          >
            <template #body-cell-razon_social="props">
              <q-td :props="props">
                <div class="text-weight-bold" style="color: #0B3B60;">{{ props.value }}</div>
                <div class="text-caption text-grey-6">NIT: {{ props.row.nit || 'Sin NIT' }}</div>
              </q-td>
            </template>

            <template #body-cell-procedencia_principal="props">
              <q-td :props="props">
                <q-badge
                  text-color="white"
                  :style="{ background: colorProcedencia(props.value) }"
                  class="q-px-xs q-py-none text-weight-medium"
                >
                  {{ props.value || 'General' }}
                </q-badge>
              </q-td>
            </template>

            <template #body-cell-saldo_vencido="props">
              <q-td :props="props" class="text-negative text-weight-medium">
                {{ cop(props.value) }}
              </q-td>
            </template>

            <template #body-cell-saldo_pendiente="props">
              <q-td :props="props" class="text-weight-bold" style="color: #0B3B60;">
                {{ cop(props.value) }}
              </q-td>
            </template>

            <template #body-cell-concentracion="props">
              <q-td :props="props" style="min-width: 140px;">
                <div class="row items-center no-wrap q-gutter-xs">
                  <q-linear-progress
                    :value="resumen.saldo_total ? props.row.saldo_pendiente / resumen.saldo_total : 0"
                    color="primary"
                    track-color="grey-3"
                    rounded
                    style="height: 6px; flex: 1;"
                  />
                  <span class="text-caption text-grey-8" style="font-size: 11px; min-width: 45px; text-align: right;">
                    {{ pct(resumen.saldo_total ? (props.row.saldo_pendiente / resumen.saldo_total) * 100 : 0) }}
                  </span>
                </div>
              </q-td>
            </template>
          </q-table>
        </article>

        <!-- 6. TABLA: DETALLE DE OBLIGACIONES Y PRÓXIMOS PAGOS -->
        <article class="vi-card">
          <div class="row items-center justify-between q-mb-xs">
            <div>
              <h2 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Obligaciones y Cuentas por Pagar</h2>
              <div class="text-caption text-grey-7">
                Trazabilidad detallada por factura con días de mora y estado
              </div>
            </div>

            <div class="row items-center q-gutter-sm">
              <q-btn-toggle
                v-model="filtroProcedencia"
                dense
                outlined
                toggle-color="primary"
                :options="[
                  { label: 'Todos', value: 'Todos' },
                  { label: 'Servicios', value: 'Servicios' },
                  { label: 'Nómina', value: 'Nomina' },
                  { label: 'Anticipos', value: 'Anticipos' },
                  { label: 'Compras', value: 'Compras' },
                ]"
              />

              <q-input
                v-model="filtroObligacion"
                dense
                outlined
                placeholder="Buscar por factura o proveedor..."
                class="search-input"
                style="min-width: 220px;"
              >
                <template #append>
                  <q-icon name="search" size="16px" />
                </template>
              </q-input>
            </div>
          </div>

          <q-table
            class="vi-table"
            flat
            dense
            :rows="obligacionesFiltradas"
            :columns="colOblig"
            row-key="cnsfcxp"
            :pagination="{ rowsPerPage: 10 }"
          >
            <template #body-cell-noreferencia="props">
              <q-td :props="props">
                <span class="text-weight-bold" style="color: #0072CE;">{{ props.value }}</span>
                <div class="text-caption text-grey-6">{{ props.row.cnsfcxp }}</div>
              </q-td>
            </template>

            <template #body-cell-procedencia="props">
              <q-td :props="props">
                <q-badge
                  text-color="white"
                  :style="{ background: colorProcedencia(props.value) }"
                  class="q-px-xs q-py-none text-weight-medium"
                >
                  {{ props.value }}
                </q-badge>
              </q-td>
            </template>

            <template #body-cell-dias_vence="props">
              <q-td :props="props">
                <q-badge
                  :color="badgeMora(props.value).color"
                  :text-color="badgeMora(props.value).textColor"
                  class="q-px-xs q-py-none text-weight-medium"
                >
                  {{ badgeMora(props.value).label }}
                </q-badge>
              </q-td>
            </template>

            <template #body-cell-valor="props">
              <q-td :props="props" class="text-grey-8">
                {{ cop(props.value) }}
              </q-td>
            </template>

            <template #body-cell-saldo="props">
              <q-td :props="props" class="text-weight-bold" style="color: #0B3B60;">
                {{ cop(props.value) }}
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
import ChartLine from '../components/charts/ChartLine.vue'
import ChartDonut from '../components/charts/ChartDonut.vue'
import { cop, millones, pct } from '../utils/formato.js'

const loading = ref(true)
const error = ref('')

const anioSeleccionado = ref(2026)

// Métricas de Saldo Activo y Aging (VWK_CXPDIASVTO)
const resumen = ref({
  total_obligaciones: 0,
  total_proveedores: 0,
  valor_bruto: 0,
  saldo_total: 0,
  vlr_abonos: 0,
  por_vencer: 0,
  dm0_30: 0,
  dm31_60: 0,
  dm61_90: 0,
  dm91_180: 0,
  dm181_360: 0,
  dm361_mas: 0,
  vencido_total: 0,
  fecha_corte: null,
})

const agingItems = ref([])
const procedencias = ref([])
const topProveedores = ref([])
const obligaciones = ref([])

// Métricas Temporales (Semana, Mes, Año)
const cxpSemana = ref({
  total_semana: 0,
  obligaciones_semana: 0,
  semana: [],
  procedencias: [],
})

const cxpMes = ref({
  total_mes: 0,
  obligaciones_mes: 0,
  mes_nombre: 'Mes Actual',
  dias: [],
  procedencias: [],
})

const cxpAnual = ref({
  anio: 2026,
  total_anio: 0,
  obligaciones_anio: 0,
  meses: [],
  procedencias: [],
})

const filtroTop = ref('')
const filtroProcedencia = ref('Todos')
const filtroObligacion = ref('')

// Series para Gráficos Temporales
const cxpSemanaCategorias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const serieCxpSemana = computed(() => {
  const valores = [0, 0, 0, 0, 0, 0, 0]
  if (cxpSemana.value.semana && cxpSemana.value.semana.length) {
    cxpSemana.value.semana.forEach(item => {
      const idx = Number(item.dia_num) - 1
      if (idx >= 0 && idx < 7) {
        valores[idx] = Number(item.total_valor || 0)
      }
    })
  }
  return [{ name: 'Semana Actual', color: '#0B3B60', values: valores }]
})

const cxpMesCategorias = computed(() => {
  if (cxpMes.value.dias && cxpMes.value.dias.length) {
    return cxpMes.value.dias.map(d => String(d.dia))
  }
  return Array.from({ length: 30 }, (_, i) => String(i + 1))
})

const serieCxpMes = computed(() => {
  let valores = []
  if (cxpMes.value.dias && cxpMes.value.dias.length) {
    valores = cxpMes.value.dias.map(d => Number(d.total_valor || 0))
  }
  return [{ name: cxpMes.value.mes_nombre || 'Mes Actual', color: '#0072CE', values: valores }]
})

const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const serieCxpAnual = computed(() => {
  const vals = new Array(12).fill(0)
  if (cxpAnual.value.meses && cxpAnual.value.meses.length) {
    cxpAnual.value.meses.forEach(m => {
      if (m.mes >= 1 && m.mes <= 12) vals[m.mes - 1] = Number(m.total_valor || 0)
    })
  }
  return [{ name: `CxP ${anioSeleccionado.value}`, color: '#0B3B60', values: vals }]
})

const cxpProcedenciasAnualItems = computed(() => {
  if (cxpAnual.value.procedencias && cxpAnual.value.procedencias.length) {
    return cxpAnual.value.procedencias.map(p => ({
      label: p.procedencia,
      value: Number(p.total || 0),
      color: colorProcedencia(p.procedencia),
    }))
  }
  return []
})

const fechaCorteTexto = computed(() => {
  if (!resumen.value.fecha_corte) return 'Corte Reciente'
  return new Date(resumen.value.fecha_corte).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})

const donutItems = computed(() => {
  return procedencias.value.map((proc) => ({
    label: proc.procedencia,
    value: Number(proc.saldo_pendiente || 0),
    color: colorProcedencia(proc.procedencia),
  }))
})

function colorProcedencia(proc) {
  switch (proc) {
    case 'Servicios':
      return '#0072CE' // Azul Institucional
    case 'Nomina':
      return '#00B5E2' // Cyan Esperanza
    case 'Anticipos':
      return '#F59E0B' // Ámbar / Alerta
    case 'Compras':
      return '#10B981' // Verde
    default:
      return '#0B3B60' // Navy
  }
}

function badgeMora(dias) {
  const d = Number(dias || 0)
  if (d < 0) {
    return { color: 'positive', textColor: 'white', label: `Al día (${Math.abs(d)}d plazo)` }
  }
  if (d === 0) {
    return { color: 'positive', textColor: 'white', label: 'Vence hoy' }
  }
  if (d <= 30) {
    return { color: 'cyan-8', textColor: 'white', label: `${d}d mora` }
  }
  if (d <= 60) {
    return { color: 'primary', textColor: 'white', label: `${d}d mora` }
  }
  if (d <= 180) {
    return { color: 'warning', textColor: 'white', label: `${d}d mora` }
  }
  return { color: 'negative', textColor: 'white', label: `${d}d mora` }
}

const topProveedoresFiltrados = computed(() => {
  if (!filtroTop.value.trim()) return topProveedores.value
  const q = filtroTop.value.toLowerCase().trim()
  return topProveedores.value.filter(
    (p) =>
      (p.razon_social && p.razon_social.toLowerCase().includes(q)) ||
      (p.nit && p.nit.toLowerCase().includes(q))
  )
})

const obligacionesFiltradas = computed(() => {
  let list = obligaciones.value
  if (filtroProcedencia.value !== 'Todos') {
    list = list.filter((o) => o.procedencia === filtroProcedencia.value)
  }
  if (filtroObligacion.value.trim()) {
    const q = filtroObligacion.value.toLowerCase().trim()
    list = list.filter(
      (o) =>
        (o.noreferencia && o.noreferencia.toLowerCase().includes(q)) ||
        (o.razon_social && o.razon_social.toLowerCase().includes(q)) ||
        (o.cnsfcxp && o.cnsfcxp.toLowerCase().includes(q))
    )
  }
  return list
})

const colTop = [
  { name: 'razon_social', label: 'Acreedor / Proveedor', field: 'razon_social', align: 'left' },
  { name: 'procedencia_principal', label: 'Línea', field: 'procedencia_principal', align: 'center' },
  { name: 'facturas_pendientes', label: 'Facturas', field: 'facturas_pendientes', align: 'center' },
  { name: 'por_vencer', label: 'Por Vencer', field: 'por_vencer', align: 'right', format: (v) => cop(v) },
  { name: 'saldo_vencido', label: 'Saldo Vencido', field: 'saldo_vencido', align: 'right' },
  { name: 'saldo_pendiente', label: 'Saldo Total', field: 'saldo_pendiente', align: 'right' },
  { name: 'concentracion', label: 'Concentración', field: 'saldo_pendiente', align: 'left' },
]

const colOblig = [
  { name: 'noreferencia', label: 'Factura Ref.', field: 'noreferencia', align: 'left' },
  { name: 'razon_social', label: 'Proveedor', field: 'razon_social', align: 'left' },
  { name: 'procedencia', label: 'Procedencia', field: 'procedencia', align: 'center' },
  { name: 'fecha', label: 'Fecha Radicado', field: 'fecha', align: 'center' },
  { name: 'f_vence', label: 'Vencimiento', field: 'f_vence', align: 'center' },
  { name: 'dias_vence', label: 'Días Mora', field: 'dias_vence', align: 'center' },
  { name: 'valor', label: 'Valor Original', field: 'valor', align: 'right' },
  { name: 'saldo', label: 'Saldo Pendiente', field: 'saldo', align: 'right' },
]

async function cambiarAnio() {
  try {
    const resAnio = await api.get(`/tableros/cxp/tendencia-anual?anio=${anioSeleccionado.value}`)
    if (resAnio.data) cxpAnual.value = resAnio.data
  } catch (err) {
    console.error('Error cargando tendencia de año:', err)
  }
}

async function cargarTodo() {
  loading.value = true
  error.value = ''
  try {
    const [
      resumenRes, agingRes, procRes, topRes, obligRes,
      semanaRes, mesRes, anioRes
    ] = await Promise.all([
      api.get('/tableros/cxp/resumen'),
      api.get('/tableros/cxp/aging'),
      api.get('/tableros/cxp/procedencia'),
      api.get('/tableros/cxp/top-proveedores?limit=15'),
      api.get('/tableros/cxp/obligaciones?limit=100'),
      api.get('/tableros/cxp/semana'),
      api.get('/tableros/cxp/mes'),
      api.get(`/tableros/cxp/tendencia-anual?anio=${anioSeleccionado.value}`),
    ])

    resumen.value = resumenRes.data || {}
    agingItems.value = agingRes.data || []
    procedencias.value = procRes.data || []
    topProveedores.value = topRes.data || []
    obligaciones.value = obligRes.data || []

    cxpSemana.value = semanaRes.data || {}
    cxpMes.value = mesRes.data || {}
    cxpAnual.value = anioRes.data || {}

  } catch (err) {
    console.error('Error cargando Cuentas por Pagar:', err)
    error.value = 'No se pudieron cargar los datos de Cuentas por Pagar. Por favor verifica la conexión con el servidor.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  cargarTodo()
})
</script>

<style scoped>
.search-input :deep(.q-field__control) {
  height: 32px;
  min-height: 32px;
  border-radius: 6px;
  background: #f8fafc;
}

.search-input :deep(.q-field__native) {
  font-size: 12px;
}

.vi-table :deep(th) {
  font-size: 11px;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
  letter-spacing: 0.03em;
  background-color: #f8fafc;
}

.vi-table :deep(td) {
  font-size: 12px;
  padding: 6px 12px;
}
</style>
