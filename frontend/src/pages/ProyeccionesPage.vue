<template>
  <q-page class="vi-page">
    <div class="vi-wrap">
      <!-- 1. ENCABEZADO INSTITUCIONAL -->
      <div class="row items-center justify-between q-mb-xs">
        <TableroEncabezado
          kicker="Clínica Esperanza · Modelos Predictivos y Financieros"
          titulo="Módulo de Proyecciones Operativas y Financieras"
          subtitulo="Estimación predictiva para Diciembre 2026 y cierre de vigencia según datos históricos reales (2025 - 2026)."
        />
        <div class="row items-center q-gutter-xs">
          <q-badge color="primary" text-color="white" class="q-px-sm q-py-xs text-weight-medium">
            <q-icon name="auto_graph" size="14px" class="q-mr-xs" />
            Modelo Predictivo KESPERANZA
          </q-badge>
          <q-btn flat dense round icon="refresh" color="primary" :loading="loading" @click="cargarDatos">
            <q-tooltip>Recalcular proyecciones</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- 2. BARRA DE PARÁMETROS DE COMPARACIÓN Y CONFIGURACIÓN DEL MODELO -->
      <div class="filtro-bar vi-card q-pa-sm q-mb-sm">
        <div class="row items-center justify-between q-col-gutter-xs">
          <!-- Parámetro 1: Base de Referencia Histórica -->
          <div class="col-12 col-md-4 row items-center q-gutter-xs no-wrap">
            <span class="text-caption text-weight-bold text-grey-8" style="white-space: nowrap;">Base Histórica:</span>
            <q-select
              v-model="paramBase"
              dense
              outlined
              emit-value
              map-options
              options-dense
              class="col"
              style="min-width: 190px; font-size: 11px;"
              :options="[
                { label: 'Corrido 2026 (Ene-Oct)', value: 'corrido_2026' },
                { label: 'Últimos 3 Meses (Ago-Oct)', value: 'ultimos_3_meses' },
                { label: 'Últimos 6 Meses (May-Oct)', value: 'ultimos_6_meses' },
                { label: 'Estacionalidad Dic 2025', value: 'estacionalidad_2025' }
              ]"
              @update:model-value="cargarDatos"
            />
          </div>

          <!-- Parámetro 2: Escenario Proyectivo -->
          <div class="col-12 col-md-4 row items-center q-gutter-xs no-wrap">
            <span class="text-caption text-weight-bold text-grey-8" style="white-space: nowrap;">Escenario:</span>
            <q-btn-toggle
              v-model="paramEscenario"
              dense
              no-caps
              outlined
              toggle-color="primary"
              class="filtro-toggle col"
              :options="[
                { label: 'Pesimista (-5%)', value: 'pesimista' },
                { label: 'Conservador (0%)', value: 'conservador' },
                { label: 'Moderado (+3.5%)', value: 'moderado' },
                { label: 'Optimista (+8%)', value: 'optimista' },
                { label: 'Manual', value: 'personalizado' }
              ]"
              @update:model-value="cambiarEscenario"
            />
          </div>

          <!-- Parámetro 3: Tasa de Ajuste Manual y Exportar -->
          <div class="col-12 col-md-4 row items-center justify-end q-gutter-xs no-wrap">
            <template v-if="paramEscenario === 'personalizado'">
              <span class="text-caption text-weight-bold text-grey-7">Tasa:</span>
              <q-input
                v-model.number="paramTasaAjuste"
                type="number"
                dense
                outlined
                suffix="%"
                style="width: 80px;"
                class="q-mr-xs text-caption"
                @update:model-value="cargarDatos"
              />
            </template>

            <q-btn
              unelevated
              no-caps
              color="positive"
              icon="table_view"
              label="Exportar Modelo"
              size="sm"
              class="text-weight-bold q-px-sm"
              :loading="exportando"
              @click="exportarExcel"
            >
              <q-tooltip>Descargar modelo predictivo completo en Excel / CSV</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>

      <!-- ESTADO DE CARGA -->
      <div v-if="loading" class="text-center q-my-xl">
        <q-spinner-dots size="48px" color="primary" />
        <div class="q-mt-sm text-grey-7">Calculando proyecciones con base {{ labelBaseActiva }}...</div>
      </div>

      <template v-else>
        <!-- 3. SECCIÓN KPIS PROYECTADOS PARA DICIEMBRE 2026 (6 TARJETAS EN 2 FILAS DE 3) -->
        <section class="vi-kpis--3 q-mb-xs">
          <!-- KPI 1: Facturación Diciembre -->
          <article class="vi-kpi" style="border-top-color: #0072CE;">
            <div class="row items-center justify-between">
              <span>Facturación Proyectada (Dic)</span>
              <q-badge color="primary" dense>
                {{ kpis.variacion_vs_base_pct > 0 ? '+' : '' }}{{ kpis.variacion_vs_base_pct }}%
              </q-badge>
            </div>
            <strong style="color: #0072CE;">{{ formatDinero(kpis.facturacion_dic_proyectada) }}</strong>
            <em>Base Ref: {{ formatDinero(kpis.facturacion_base_referencia) }} ({{ formatDinero(kpis.facturacion_promedio_diaria_dic) }}/día)</em>
          </article>

          <!-- KPI 2: Recaudos Totales Diciembre -->
          <article class="vi-kpi" style="border-top-color: #10B981;">
            <div class="row items-center justify-between">
              <span>Recaudo Estimado (Dic)</span>
              <q-badge color="positive" dense>Cobro {{ kpis.tasa_recaudo_esperada_pct }}%</q-badge>
            </div>
            <strong class="text-positive">{{ formatDinero(kpis.recaudo_total_proyectado_dic) }}</strong>
            <em>Bancos: {{ formatDinero(kpis.recaudo_bancos_proyectado_dic) }} · Caja: {{ formatDinero(kpis.recaudo_caja_proyectado_dic) }}</em>
          </article>

          <!-- KPI 3: Saldo Cartera Proyectado -->
          <article class="vi-kpi" style="border-top-color: #F59E0B;">
            <div class="row items-center justify-between">
              <span>Saldo Cartera Proyectado (31 Dic)</span>
              <q-badge color="cyan-9" text-color="white" dense>{{ kpis.dias_rotacion_dso_proyectado }} días DSO</q-badge>
            </div>
            <strong style="color: #D97706;">{{ formatDinero(kpis.saldo_cartera_proyectado_dic) }}</strong>
            <em>Actual: {{ formatDinero(kpis.saldo_cartera_actual) }} (Var: {{ formatDinero(kpis.variacion_cartera_dic) }})</em>
          </article>
        </section>

        <section class="vi-kpis--3 q-mb-sm">
          <!-- KPI 4: Citas Médicas Proyectadas -->
          <article class="vi-kpi" style="border-top-color: #8B5CF6;">
            <div class="row items-center justify-between">
              <span>Citas Demandadas (Dic)</span>
              <q-badge color="purple-9" text-color="white" dense>Efectividad {{ kpis.tasa_asistencia_proyectada_pct }}%</q-badge>
            </div>
            <strong style="color: #8B5CF6;">{{ (kpis.citas_proyectadas_dic || 0).toLocaleString('es-CO') }} citas</strong>
            <em>Cumplidas esperadas: {{ (kpis.citas_cumplidas_proyectadas_dic || 0).toLocaleString('es-CO') }} pacientes</em>
          </article>

          <!-- KPI 5: Cierre Total Anual Facturación -->
          <article class="vi-kpi" style="border-top-color: #0B3B60;">
            <div class="row items-center justify-between">
              <span>Cierre Anual 2026 Facturación</span>
              <q-badge color="positive" dense>+{{ kpis.crecimiento_anual_pct }}% vs 2025</q-badge>
            </div>
            <strong style="color: #0B3B60;">{{ formatDinero(kpis.facturacion_anual_proyectada) }}</strong>
            <em>Real 2025: {{ formatDinero(kpis.facturacion_anual_2025_real) }} (Expansión sólida)</em>
          </article>

          <!-- KPI 6: Composición Flujo de Recaudo -->
          <article class="vi-kpi" style="border-top-color: #00B5E2;">
            <div class="row items-center justify-between">
              <span>Composición del Recaudo</span>
              <q-badge color="cyan-9" text-color="white" dense>Canales</q-badge>
            </div>
            <strong style="color: #00B5E2;">91% Bancos / 9% Caja</strong>
            <em>Giro ADRES (65.5%) · Consig. EPS (25.5%)</em>
          </article>
        </section>

        <!-- 4. PANELES GRÁFICOS EN 3 COLUMNAS: EVOLUCIÓN HISTÓRICA Y PROYECCIÓN -->
        <section class="vi-grid-3 q-mb-sm">
          <!-- Gráfico 1: Curva de Facturación -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-xs">
              <div>
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Facturación: 2025 vs 2026 (Dic Proy.)</h3>
                <div class="text-caption text-grey-7">Comportamiento real y proyección Diciembre</div>
              </div>
              <q-badge color="primary">{{ labelEscenarioActivo }}</q-badge>
            </div>
            <ChartLine
              titulo="Facturación Real y Proyectada"
              unidad="Millones COP"
              :en-millones="false"
              :categories="curvaTemporal.categorias"
              :series="serieFacturacionGrafico"
              :format="(v) => `$ ${Number(v || 0).toLocaleString('es-CO')}M`"
            />
          </article>

          <!-- Gráfico 2: Curva de Recaudos -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-xs">
              <div>
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Recaudos: 2025 vs 2026 (Dic Proy.)</h3>
                <div class="text-caption text-grey-7">Ingresos confirmados y meta fin de año</div>
              </div>
              <q-badge color="positive">Recaudos</q-badge>
            </div>
            <ChartLine
              titulo="Recaudos Reales y Proyectados"
              unidad="Millones COP"
              :en-millones="false"
              :categories="curvaTemporal.categorias"
              :series="serieRecaudosGrafico"
              :format="(v) => `$ ${Number(v || 0).toLocaleString('es-CO')}M`"
            />
          </article>

          <!-- Gráfico 3: Canales de Recaudo Proyectados en Diciembre -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-xs">
              <div>
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Fuentes de Recaudo (Diciembre)</h3>
                <div class="text-caption text-grey-7">Distribución esperada por canal</div>
              </div>
              <q-badge color="grey-3" text-color="grey-8">Canales</q-badge>
            </div>
            <ChartDonut
              titulo="Recaudo por Canal"
              :items="donutCanalesRecaudo"
              :centro="formatDinero(kpis.recaudo_total_proyectado_dic)"
              subtitulo="Total Dic"
              :format="(v) => formatDinero(v)"
            />
          </article>
        </section>

        <!-- 5. TABLAS DE DETALLE EN 3 COLUMNAS: FACTURACIÓN EPS, CANALES Y CITAS -->
        <section class="vi-grid-3 q-mb-sm">
          <!-- Tabla 1: Facturación Proyectada por EPS (Diciembre) -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-xs">
              <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Top EPS Facturación (Dic)</h3>
              <span class="text-caption text-grey-6">Proyectado</span>
            </div>
            <q-table
              class="vi-table vi-table-fixed"
              flat
              dense
              :rows="detalleDimensiones.facturacion_por_eps || []"
              :columns="colFacturacionEps"
              row-key="asegurador"
              hide-bottom
              :pagination="{ rowsPerPage: 6 }"
            >
              <template #body-cell-asegurador="props">
                <q-td :props="props" class="td-nombre">
                  <div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div>
                </q-td>
              </template>
              <template #body-cell-promedio_historico="props">
                <q-td :props="props" class="text-right text-weight-medium text-grey-7 td-num">
                  {{ formatDinero(props.value) }}
                </q-td>
              </template>
              <template #body-cell-proyectado_dic="props">
                <q-td :props="props" class="text-right text-weight-bold text-primary td-num">
                  {{ formatDinero(props.value) }}
                </q-td>
              </template>
            </q-table>
          </article>

          <!-- Tabla 2: Canales de Recaudo Proyectados -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-xs">
              <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Canales de Recaudo (Dic)</h3>
              <span class="text-caption text-grey-6">Bancos y Caja</span>
            </div>
            <q-table
              class="vi-table vi-table-fixed"
              flat
              dense
              :rows="detalleDimensiones.recaudos_por_canal || []"
              :columns="colCanalesRecaudo"
              row-key="canal"
              hide-bottom
              :pagination="{ rowsPerPage: 6 }"
            >
              <template #body-cell-canal="props">
                <q-td :props="props" class="td-nombre">
                  <div class="col-nombre-2filas text-weight-bold text-grey-9" :title="props.value">{{ props.value }}</div>
                </q-td>
              </template>
              <template #body-cell-monto_proyectado="props">
                <q-td :props="props" class="text-right text-weight-bold text-positive td-num">
                  {{ formatDinero(props.value) }}
                </q-td>
              </template>
              <template #body-cell-pct="props">
                <q-td :props="props" class="text-center td-badge">
                  <q-badge color="positive" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge>
                </q-td>
              </template>
            </q-table>
          </article>

          <!-- Tabla 3: Citas Proyectadas por Especialidad (Diciembre) -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-xs">
              <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Demanda de Citas (Dic)</h3>
              <span class="text-caption text-grey-6">Especialidades</span>
            </div>
            <q-table
              class="vi-table vi-table-fixed"
              flat
              dense
              :rows="detalleDimensiones.citas_por_especialidad || []"
              :columns="colCitasEspecialidad"
              row-key="servicio"
              hide-bottom
              :pagination="{ rowsPerPage: 6 }"
            >
              <template #body-cell-servicio="props">
                <q-td :props="props" class="td-nombre">
                  <div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div>
                </q-td>
              </template>
              <template #body-cell-citas_proyectadas_dic="props">
                <q-td :props="props" class="text-right text-weight-bold text-primary td-num">
                  {{ Number(props.value || 0).toLocaleString('es-CO') }}
                </q-td>
              </template>
              <template #body-cell-cumplidas_proyectadas_dic="props">
                <q-td :props="props" class="text-right text-weight-medium text-positive td-num">
                  {{ Number(props.value || 0).toLocaleString('es-CO') }}
                </q-td>
              </template>
            </q-table>
          </article>
        </section>

        <!-- 6. MATRIZ COMPARATIVA DE ESCENARIOS (ANÁLISIS DE SENSIBILIDAD) -->
        <article class="vi-card q-pa-sm q-mb-sm">
          <div class="row items-center justify-between q-mb-xs">
            <div class="row items-center q-gutter-xs">
              <q-icon name="tune" size="18px" color="primary" />
              <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">
                Matriz Comparativa de Escenarios Predictivos (Diciembre 2026)
              </h3>
            </div>
            <span class="text-caption text-grey-7">Análisis de Sensibilidad de Facturación, Recaudo y Cartera</span>
          </div>

          <q-table
            class="vi-table vi-table-fixed"
            flat
            dense
            :rows="comparativoEscenarios"
            :columns="colComparativoEscenarios"
            row-key="id"
            hide-bottom
          >
            <template #body-cell-nombre="props">
              <q-td :props="props" class="td-nombre">
                <div class="row items-center q-gutter-xs">
                  <q-badge
                    :color="props.row.id === 'pesimista' ? 'negative' : props.row.id === 'conservador' ? 'grey-8' : props.row.id === 'moderado' ? 'primary' : 'positive'"
                    dense
                    class="q-mr-xs"
                  >
                    {{ props.value }}
                  </q-badge>
                  <span class="text-caption text-grey-8">{{ props.row.descripcion }}</span>
                </div>
              </q-td>
            </template>
            <template #body-cell-facturacion_dic="props">
              <q-td :props="props" class="text-right text-weight-bold text-primary td-num">
                {{ formatDinero(props.value) }}
              </q-td>
            </template>
            <template #body-cell-recaudo_dic="props">
              <q-td :props="props" class="text-right text-weight-bold text-positive td-num">
                {{ formatDinero(props.value) }}
              </q-td>
            </template>
            <template #body-cell-saldo_cartera_dic="props">
              <q-td :props="props" class="text-right text-weight-medium text-warning td-num">
                {{ formatDinero(props.value) }}
              </q-td>
            </template>
            <template #body-cell-citas_dic="props">
              <q-td :props="props" class="text-center text-weight-bold text-grey-9 td-badge">
                {{ Number(props.value || 0).toLocaleString('es-CO') }}
              </q-td>
            </template>
          </q-table>
        </article>

        <!-- 7. METODOLOGÍA Y SUPUESTOS DEL MODELO PREDICTIVO INSTITUCIONAL -->
        <article class="vi-card bg-blue-1 text-grey-9 q-pa-sm" style="border: 1px solid #bfdbfe;">
          <div class="row items-center q-gutter-sm q-mb-xs">
            <q-icon name="psychology" size="20px" color="primary" />
            <h4 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">
              Metodología y Supuestos de Proyección (Clínica Esperanza):
            </h4>
          </div>
          <div class="row q-col-gutter-xs text-caption">
            <div class="col-12 col-md-4">
              <div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;">
                <strong class="text-primary">1. Run-Rate y Estacionalidad:</strong>
                La facturación de Diciembre se modela combinando la tasa de producción media de 2026 ($445.9M/mes) con el factor estacional de Diciembre 2025 (+15.6% indexado).
              </div>
            </div>
            <div class="col-12 col-md-4">
              <div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;">
                <strong class="text-primary">2. Aceleración de Recaudos:</strong>
                Históricamente en Diciembre se presenta un incremento de giros directos ADRES y depósitos de fin de año de EPS, elevando la tasa de recaudo al ~85%-92%.
              </div>
            </div>
            <div class="col-12 col-md-4">
              <div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;">
                <strong class="text-primary">3. Dinámica de Cartera (CXC):</strong>
                La cartera final de año se calcula con la ecuación contable: <em>Saldo Actual + Facturación Proyectada Dic - Recaudos Proyectados Dic</em>.
              </div>
            </div>
          </div>
        </article>
      </template>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from 'boot/api'
import TableroEncabezado from '../components/panel/TableroEncabezado.vue'
import ChartLine from '../components/charts/ChartLine.vue'
import ChartDonut from '../components/charts/ChartDonut.vue'

const loading = ref(true)
const exportando = ref(false)

// Parámetros del modelo
const paramBase = ref('corrido_2026') // 'corrido_2026' | 'ultimos_3_meses' | 'ultimos_6_meses' | 'estacionalidad_2025'
const paramEscenario = ref('moderado') // 'pesimista' | 'conservador' | 'moderado' | 'optimista' | 'personalizado'
const paramTasaAjuste = ref(3.5)

// Datos del backend
const kpis = ref({})
const curvaTemporal = ref({
  categorias: [],
  series_2025: { facturacion: [], recaudo: [] },
  series_2026: { facturacion_real: [], recaudo_real: [], facturacion_proyectada: [], recaudo_proyectado: [] }
})
const detalleDimensiones = ref({
  facturacion_por_eps: [],
  recaudos_por_canal: [],
  citas_por_especialidad: [],
  cartera_edades_proyectada: {}
})
const comparativoEscenarios = ref([])

// Columnas de tablas
const colFacturacionEps = [
  { name: 'asegurador', label: 'Asegurador / EPS', field: 'asegurador', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'promedio_historico', label: 'Hist. Mensual', field: 'promedio_historico', align: 'right', style: 'width: 25%;', headerStyle: 'width: 25%;' },
  { name: 'proyectado_dic', label: 'Proyectado Dic', field: 'proyectado_dic', align: 'right', style: 'width: 25%;', headerStyle: 'width: 25%;' },
]

const colCanalesRecaudo = [
  { name: 'canal', label: 'Canal de Recaudo', field: 'canal', align: 'left', style: 'width: 48%;', headerStyle: 'width: 48%;' },
  { name: 'monto_proyectado', label: 'Ingreso Estimado', field: 'monto_proyectado', align: 'right', style: 'width: 32%;', headerStyle: 'width: 32%;' },
  { name: 'pct', label: '% Total', field: 'pct', align: 'center', style: 'width: 20%;', headerStyle: 'width: 20%;' },
]

const colCitasEspecialidad = [
  { name: 'servicio', label: 'Especialidad Médica', field: 'servicio', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'citas_proyectadas_dic', label: 'Citas Dic', field: 'citas_proyectadas_dic', align: 'right', style: 'width: 25%;', headerStyle: 'width: 25%;' },
  { name: 'cumplidas_proyectadas_dic', label: 'Cumplidas Est.', field: 'cumplidas_proyectadas_dic', align: 'right', style: 'width: 25%;', headerStyle: 'width: 25%;' },
]

const colComparativoEscenarios = [
  { name: 'nombre', label: 'Escenario Proyectivo', field: 'nombre', align: 'left', style: 'width: 40%;', headerStyle: 'width: 40%;' },
  { name: 'facturacion_dic', label: 'Facturación Dic', field: 'facturacion_dic', align: 'right', style: 'width: 20%;', headerStyle: 'width: 20%;' },
  { name: 'recaudo_dic', label: 'Recaudo Dic', field: 'recaudo_dic', align: 'right', style: 'width: 20%;', headerStyle: 'width: 20%;' },
  { name: 'saldo_cartera_dic', label: 'Cartera Dic 31', field: 'saldo_cartera_dic', align: 'right', style: 'width: 20%;', headerStyle: 'width: 20%;' },
]

// Computed labels
const labelBaseActiva = computed(() => {
  switch (paramBase.value) {
    case 'ultimos_3_meses': return 'Últimos 3 Meses (Ago-Oct)'
    case 'ultimos_6_meses': return 'Últimos 6 Meses (May-Oct)'
    case 'estacionalidad_2025': return 'Estacionalidad Dic 2025'
    default: return 'Corrido 2026 (Ene-Oct)'
  }
})

const labelEscenarioActivo = computed(() => {
  switch (paramEscenario.value) {
    case 'pesimista': return 'Pesimista (-5%)'
    case 'conservador': return 'Conservador (0%)'
    case 'optimista': return 'Optimista (+8%)'
    case 'personalizado': return `Manual (${paramTasaAjuste.value}%)`
    default: return 'Moderado (+3.5%)'
  }
})

// Series para los gráficos
const serieFacturacionGrafico = computed(() => {
  const c = curvaTemporal.value
  return [
    { name: '2025 Real', color: '#94A3B8', values: c.series_2025?.facturacion || [] },
    { name: '2026 Real', color: '#0072CE', values: c.series_2026?.facturacion_real || [] },
    { name: '2026 Proyectado', color: '#10B981', values: c.series_2026?.facturacion_proyectada || [] },
  ]
})

const serieRecaudosGrafico = computed(() => {
  const c = curvaTemporal.value
  return [
    { name: '2025 Real', color: '#94A3B8', values: c.series_2025?.recaudo || [] },
    { name: '2026 Real', color: '#10B981', values: c.series_2026?.recaudo_real || [] },
    { name: '2026 Proyectado', color: '#F59E0B', values: c.series_2026?.recaudo_proyectado || [] },
  ]
})

const donutCanalesRecaudo = computed(() => {
  const canales = detalleDimensiones.value?.recaudos_por_canal || []
  const colores = ['#0072CE', '#00B5E2', '#10B981', '#F59E0B']
  return canales.map((c, i) => ({
    label: c.canal.replace('Bancos - ', '').replace('Caja - ', ''),
    value: Number(c.monto_proyectado || 0),
    color: colores[i % colores.length]
  }))
})

function formatDinero(val) {
  const n = Number(val || 0)
  if (Math.abs(n) >= 1e6) {
    return '$ ' + (n / 1e6).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M'
  }
  return '$ ' + n.toLocaleString('es-CO')
}

function cambiarEscenario(val) {
  if (val === 'pesimista') paramTasaAjuste.value = -5.0
  else if (val === 'conservador') paramTasaAjuste.value = 0.0
  else if (val === 'moderado') paramTasaAjuste.value = 3.5
  else if (val === 'optimista') paramTasaAjuste.value = 8.0
  cargarDatos()
}

function buildQueryString() {
  let q = `base=${paramBase.value}&escenario=${paramEscenario.value}`
  if (paramEscenario.value === 'personalizado') {
    q += `&tasa_ajuste=${paramTasaAjuste.value}`
  }
  return q
}

async function cargarDatos() {
  loading.value = true
  const q = buildQueryString()
  try {
    const [resumenRes, curvaRes, detalleRes, compRes] = await Promise.all([
      api.get(`/proyecciones/resumen?${q}`),
      api.get(`/proyecciones/curva-temporal?${q}`),
      api.get(`/proyecciones/detalle-dimensiones?${q}`),
      api.get(`/proyecciones/comparativo-escenarios?${q}`)
    ])

    kpis.value = resumenRes.data?.kpis || {}
    curvaTemporal.value = curvaRes.data || {}
    detalleDimensiones.value = detalleRes.data || {}
    comparativoEscenarios.value = compRes.data || []
  } catch (err) {
    console.error('Error cargando proyecciones:', err)
  } finally {
    loading.value = false
  }
}

function exportarExcel() {
  exportando.value = true
  const q = buildQueryString()
  const endpoint = `/api/proyecciones/exportar-excel?${q}`
  const filename = `proyeccion_clinica_esperanza_${paramBase.value}_${paramEscenario.value}.csv`

  const link = document.createElement('a')
  link.href = endpoint
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => {
    exportando.value = false
  }, 800)
}

onMounted(() => {
  cargarDatos()
})
</script>

<style scoped>
.filtro-toggle :deep(.q-btn) {
  font-size: 11px;
  padding: 3px 8px;
  font-weight: 600;
}

/* Grillas en 3 Columnas */
.vi-kpis--3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.vi-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

@media (max-width: 1200px) {
  .vi-grid-3 {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .vi-kpis--3,
  .vi-grid-3 {
    grid-template-columns: 1fr;
  }
}

.vi-table :deep(th) {
  font-size: 10px;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
  background-color: #f8fafc;
  padding: 4px 6px;
}

.vi-table :deep(td) {
  font-size: 11px;
  padding: 4px 6px;
}

/* Tablas compactas en 3 columnas con ancho fijo y doble fila */
.vi-table-fixed :deep(.q-table__middle) {
  overflow-x: hidden !important;
}

.vi-table-fixed :deep(table) {
  table-layout: fixed !important;
  width: 100% !important;
}

.vi-table-fixed :deep(th) {
  font-size: 9.5px !important;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
  background-color: #f8fafc;
  padding: 5px 3px !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vi-table-fixed :deep(td) {
  font-size: 10.5px !important;
  padding: 4px 3px !important;
}

.td-nombre {
  white-space: normal !important;
  padding: 4px 5px !important;
  vertical-align: middle !important;
}

.col-nombre-2filas {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  line-height: 1.22;
  font-size: 10.5px;
  font-weight: 600;
  color: #0B3B60;
  word-break: break-word;
  max-height: 2.5em;
}

.td-num {
  font-size: 10.5px !important;
  padding: 4px 3px !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}

.td-badge {
  padding: 4px 2px !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}

.badge-tabla {
  font-size: 9.5px !important;
  font-weight: 700;
  padding: 2px 4px !important;
  min-width: 36px;
  justify-content: center;
  border-radius: 4px;
}
</style>
