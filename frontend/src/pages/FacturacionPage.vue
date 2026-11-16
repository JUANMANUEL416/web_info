<template>
  <q-page class="vi-page">
    <div class="vi-wrap">
      <!-- ENCABEZADO INSTITUCIONAL -->
      <div class="row items-center justify-between q-mb-xs">
        <TableroEncabezado
          kicker="Clínica Esperanza · Facturación y Ventas"
          titulo="Tablero Directivo de Facturación"
          :subtitulo="`Control, trazabilidad operativa y productividad en Producción (${anioSeleccionado}) — Clínica Esperanza.`"
        />
        <div class="row items-center q-gutter-sm">
          <q-btn-toggle
            v-model="anioSeleccionado"
            toggle-color="primary"
            dense
            outlined
            :options="[
              { label: '2026', value: 2026 },
              { label: '2025', value: 2025 }
            ]"
            @update:model-value="cargarTodo"
          />
        </div>
      </div>

      <div v-if="loading" class="text-center q-my-xl">
        <q-spinner-dots size="48px" color="primary" />
        <div class="q-mt-sm text-grey-7">Cargando métricas de facturación...</div>
      </div>

      <template v-else>
        <!-- 1. KPIS DIRECTIVOS DE FACTURACIÓN Y TRAZABILIDAD (FILA ÚNICA COMPACTA) -->
        <section class="vi-kpis--6 q-mb-sm">
          <!-- 1. Facturación Neta -->
          <article class="vi-kpi vi-kpi--neto">
            <span>Facturación Neta Total</span>
            <strong class="text-primary">{{ cop(facturacionNeta) }}</strong>
            <em>{{ resumen.total_facturas }} fac · Prom. {{ cop(ticketPromedio) }}</em>
          </article>

          <!-- 2. Con CxC (Cartera EPS) -->
          <article class="vi-kpi vi-kpi--cxc">
            <span>Facturación Con CxC</span>
            <strong class="text-positive">{{ cop(control.con_cxc.total) }}</strong>
            <em>{{ control.con_cxc.facturas.toLocaleString('es-CO') }} fac · {{ pct(control.con_cxc.porcentaje) }}</em>
          </article>

          <!-- 3. Sin CxC (Particulares / Caja) -->
          <article class="vi-kpi vi-kpi--sincxc">
            <span>Facturación Sin CxC</span>
            <strong style="color: #D97706">{{ cop(control.sin_cxc.total) }}</strong>
            <em>{{ control.sin_cxc.facturas.toLocaleString('es-CO') }} fac · {{ pct(control.sin_cxc.porcentaje) }}</em>
          </article>

          <!-- 4. Notas Crédito -->
          <article class="vi-kpi vi-kpi--nc">
            <span>Notas Crédito (Ajustes)</span>
            <strong style="color: #7C3AED">{{ cop(control.con_nota_credito.total) }}</strong>
            <em>{{ control.con_nota_credito.total_notas }} notas · {{ pct(control.con_nota_credito.porcentaje) }}</em>
          </article>

          <!-- 5. Facturas Anuladas -->
          <article class="vi-kpi vi-kpi--anuladas">
            <span>Facturas Anuladas</span>
            <strong class="text-negative">{{ cop(control.anuladas.total) }}</strong>
            <em>{{ control.anuladas.facturas.toLocaleString('es-CO') }} anuladas · {{ pct(control.anuladas.porcentaje) }}</em>
          </article>

          <!-- 6. Aprobación DIAN -->
          <article class="vi-kpi vi-kpi--dian">
            <span>Aprobación DIAN (CUFE)</span>
            <strong class="text-teal">{{ pct(pctDian) }}</strong>
            <em>{{ resumen.facturas_dian_aprobadas }} exitosas · {{ resumen.facturas_dian_pendientes }} pend.</em>
          </article>
        </section>

        <!-- 2. FACTURACIÓN RECIENTE (SEMANA ACTUAL Y MES ACTUAL) -->
        <section class="vi-grid-2 q-mb-sm">
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-xs">
              <div>
                <h2 class="q-ma-none">Facturación de la Semana Actual</h2>
                <div class="text-caption text-grey-7">Día a día (Lun - Dom) · {{ semanaFacturas }} facturas</div>
              </div>
              <q-badge color="primary" :label="cop(semanaTotal)" class="text-subtitle2 text-weight-bold" />
            </div>
            <ChartLine
              titulo="Facturación Semanal (COP)"
              :categories="semanaCategorias"
              :series="serieSemana"
              :format="cop"
            />
          </article>

          <article class="vi-card">
            <div class="row items-center justify-between q-mb-xs">
              <div>
                <h2 class="q-ma-none">Facturación del Mes Actual</h2>
                <div class="text-caption text-grey-7">{{ mesActualNombre }} · {{ mesActualFacturas }} facturas</div>
              </div>
              <q-badge color="teal" :label="cop(mesActualTotal)" class="text-subtitle2 text-weight-bold" />
            </div>
            <ChartLine
              titulo="Evolución diaria del mes actual (COP)"
              :categories="mesActualCategorias"
              :series="serieMesActual"
              :format="cop"
            />
          </article>
        </section>

        <!-- 3. GRÁFICOS DE TENDENCIA MENSUAL Y PROCEDENCIA (MOVIDOS ABAJO) -->
        <section class="vi-grid-2 q-mb-sm">
          <article class="vi-card">
            <h2>Tendencia Mensual de Facturación ({{ anioSeleccionado }})</h2>
            <ChartLine
              titulo="Facturación Mensual (COP)"
              :categories="mesesNombres"
              :series="serieMensual"
              :format="cop"
            />
          </article>
          <article class="vi-card">
            <h2>Facturación por Procedencia</h2>
            <ChartDonut
              titulo="Distribución por Origen del Servicio"
              :items="procedenciasItems"
              :centro="millones(resumen.total_facturado)"
              subtitulo="millones"
              :format="cop"
            />
          </article>
        </section>

        <!-- 4. CUADRO DE FACTURACIÓN POR USUARIO (FACTURADOR) -->
        <section class="vi-card q-mb-sm">
          <!-- CABECERA EN 2 COLUMNAS (FRENTE A FRENTE, SIN DESBORDES NI SALTOS) -->
          <div class="vi-header-2col q-mb-xs">
            <!-- COLUMNA 1 (IZQUIERDA): Título, métricas y período activo -->
            <div class="vi-header-2col__izq">
              <div class="row items-center q-gutter-xs no-wrap">
                <h2 class="q-ma-none text-weight-bold" style="font-size: 14.5px;">Facturación por Usuario</h2>
                <q-badge color="primary" :label="`${usuariosFacturacion.length} facturadores`" />
                <q-badge color="teal" :label="cop(totalPeriodoUsuario)" class="text-weight-bold" />
              </div>
              <div class="text-caption text-grey-7 ellipsis" style="font-size: 11px; margin-top: 2px;">
                {{ subtituloPeriodo }}
              </div>
            </div>

            <!-- COLUMNA 2 (DERECHA / AL FRENTE): 3 Checks de período + Buscador compacto -->
            <div class="vi-header-2col__der">
              <div class="periodo-checks row items-center no-wrap q-gutter-xs bg-grey-2 q-px-sm q-py-none border-radius-6">
                <span class="text-caption text-weight-bold text-grey-7" style="font-size: 11px;">Periodo:</span>
                <q-radio
                  v-model="periodoUsuario"
                  val="semana"
                  label="Por semana"
                  dense
                  color="primary"
                  class="periodo-radio"
                  @update:model-value="cambiarPeriodoUsuario"
                />
                <q-radio
                  v-model="periodoUsuario"
                  val="mes"
                  label="Por mes"
                  dense
                  color="teal"
                  class="periodo-radio"
                  @update:model-value="cambiarPeriodoUsuario"
                />
                <q-radio
                  v-model="periodoUsuario"
                  val="anio"
                  label="Por año"
                  dense
                  color="indigo"
                  class="periodo-radio"
                  @update:model-value="cambiarPeriodoUsuario"
                />
              </div>

              <q-input
                v-model="filtroUsuario"
                dense
                outlined
                placeholder="Buscar facturador..."
                class="bg-white filtro-input"
              >
                <template #append>
                  <q-icon name="search" size="16px" />
                </template>
              </q-input>
            </div>
          </div>

          <div v-if="loadingUsuarios" class="text-center q-py-md">
            <q-spinner-dots size="32px" color="primary" />
            <div class="text-caption text-grey-7">Actualizando facturación por usuario...</div>
          </div>

          <q-table
            v-else
            class="vi-table"
            flat
            dense
            :rows="usuariosFiltrados"
            :columns="columnasUsuarios"
            row-key="usuario_factura"
            :pagination="{ rowsPerPage: 10 }"
          >
            <!-- Columna Usuario -->
            <template #body-cell-usuario="props">
              <q-td :props="props">
                <div class="text-weight-bold text-primary">{{ props.row.usuario }}</div>
                <div class="text-caption text-grey-6">ID / Doc: {{ props.row.usuario_factura }}</div>
              </q-td>
            </template>

            <!-- Columna Total Facturado -->
            <template #body-cell-total_facturado="props">
              <q-td :props="props" class="text-weight-bold text-right" style="color: #0B3B60;">
                {{ cop(props.value) }}
              </q-td>
            </template>

            <!-- Columna Ticket Promedio -->
            <template #body-cell-ticket_promedio="props">
              <q-td :props="props" class="text-right">
                {{ cop(props.value) }}
              </q-td>
            </template>

            <!-- Columna Con CxC -->
            <template #body-cell-facturas_con_cxc="props">
              <q-td :props="props" class="text-center">
                <span class="text-weight-bold text-positive">{{ Number(props.value || 0).toLocaleString('es-CO') }}</span>
                <div class="text-caption text-grey-6">{{ cop(props.row.valor_con_cxc) }}</div>
              </q-td>
            </template>

            <!-- Columna Sin CxC -->
            <template #body-cell-facturas_sin_cxc="props">
              <q-td :props="props" class="text-center">
                <span class="text-weight-bold" style="color: #D97706;">{{ Number(props.value || 0).toLocaleString('es-CO') }}</span>
                <div class="text-caption text-grey-6">{{ cop(props.row.valor_sin_cxc) }}</div>
              </q-td>
            </template>

            <!-- Columna Anuladas -->
            <template #body-cell-facturas_anuladas="props">
              <q-td :props="props" class="text-center">
                <span
                  :class="Number(props.value) > 0 ? 'text-weight-bold text-negative' : 'text-grey-5'"
                >
                  {{ props.value }}
                </span>
                <div v-if="Number(props.value) > 0" class="text-caption text-negative">
                  {{ cop(props.row.valor_anulado) }}
                </div>
              </q-td>
            </template>

            <!-- Columna % Participación -->
            <template #body-cell-porcentaje="props">
              <q-td :props="props" style="min-width: 140px;">
                <div class="row items-center justify-between text-caption q-mb-xs">
                  <span class="text-weight-bold">{{ props.value }}%</span>
                </div>
                <q-linear-progress
                  :value="Number(props.value) / 100"
                  color="primary"
                  track-color="grey-3"
                  rounded
                  size="7px"
                />
              </q-td>
            </template>
          </q-table>
        </section>

        <!-- 5. CUADROS DE CONTROL: CON CXC VS SIN CXC & AUDITORÍA DE ANULADAS -->
        <section class="vi-grid-2 q-mb-sm">
          <!-- TRAZABILIDAD: CON CXC VS SIN CXC -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-sm">
              <div>
                <h2 class="q-ma-none">Trazabilidad CxC (Radicable vs Ventanilla)</h2>
                <div class="text-caption text-grey-7">Proporción de facturación incorporada a Cuenta de Cobro</div>
              </div>
              <q-badge color="teal" label="Cartera / Facturación" />
            </div>

            <ChartDonut
              titulo="Distribución CxC"
              :items="cxcDonutItems"
              :centro="millones(control.total_facturado)"
              subtitulo="millones emitidos"
              :format="cop"
            />

            <div class="q-mt-md q-pa-sm bg-grey-2 border-radius-8">
              <div class="row text-caption text-grey-8 justify-around text-center">
                <div>
                  <div class="text-weight-bold text-positive">{{ cop(control.con_cxc.total) }}</div>
                  <div>{{ control.con_cxc.facturas.toLocaleString('es-CO') }} fac en CxC ({{ pct(control.con_cxc.porcentaje) }})</div>
                </div>
                <q-separator vertical inset />
                <div>
                  <div class="text-weight-bold text-warning">{{ cop(control.sin_cxc.total) }}</div>
                  <div>{{ control.sin_cxc.facturas.toLocaleString('es-CO') }} fac sin CxC ({{ pct(control.sin_cxc.porcentaje) }})</div>
                </div>
              </div>
            </div>
          </article>

          <!-- AUDITORÍA DE FACTURAS ANULADAS -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-sm">
              <div>
                <h2 class="q-ma-none">Auditoría de Facturas Anuladas</h2>
                <div class="text-caption text-grey-7">Control de cancelaciones recientes ({{ control.anuladas.facturas }} en total)</div>
              </div>
              <q-badge color="negative" :label="`${cop(control.anuladas.total)} anulados`" />
            </div>

            <q-table
              class="vi-table"
              flat
              dense
              :rows="anuladasDetalle"
              :columns="columnasAnuladas"
              row-key="n_factura"
              hide-bottom
              :pagination="{ rowsPerPage: 6 }"
            >
              <template #body-cell-n_factura="props">
                <q-td :props="props" class="text-weight-bold text-negative">
                  {{ props.value }}
                </q-td>
              </template>
              <template #body-cell-valor_total="props">
                <q-td :props="props" class="text-right text-weight-bold">
                  {{ cop(props.value) }}
                </q-td>
              </template>
            </q-table>
          </article>
        </section>

        <!-- 7. TOP PAGADORES Y CALIDAD DIAN -->
        <section class="vi-grid-2">
          <!-- TOP 10 CLIENTES -->
          <article class="vi-card">
            <div class="row items-center justify-between q-mb-sm">
              <h2 class="q-ma-none">Top 10 Entidades Facturadas</h2>
              <q-badge color="primary" label="Mayor Facturación" />
            </div>
            <q-table
              class="vi-table"
              flat
              dense
              :rows="topClientes"
              :columns="columnasClientes"
              row-key="idtercero"
              hide-bottom
              :pagination="{ rowsPerPage: 10 }"
            >
              <template #body-cell-total_facturado="props">
                <q-td :props="props" class="text-weight-bold">
                  {{ cop(props.value) }}
                </q-td>
              </template>
            </q-table>
          </article>

          <!-- CALIDAD OPERATIVA & DIAN -->
          <article class="vi-card">
            <h2>Calidad de Emisión y Semáforo DIAN</h2>
            <div class="q-pa-md">
              <div class="q-mb-md">
                <div class="row justify-between text-caption text-grey-8 q-mb-xs">
                  <span>Validación Fiscal Electrónica (DIAN)</span>
                  <strong>{{ resumen.facturas_dian_aprobadas }} de {{ resumen.total_facturas }} ({{ pct(pctDian) }})</strong>
                </div>
                <q-linear-progress :value="pctDian / 100" color="positive" track-color="grey-3" rounded size="10px" />
              </div>

              <div class="q-mb-md">
                <div class="row justify-between text-caption text-grey-8 q-mb-xs">
                  <span>Índice de Retención Neta (Sin Notas Crédito)</span>
                  <strong>{{ pct(100 - (Number(resumen.total_notas_credito || 0) / Number(resumen.total_facturado || 1) * 100)) }}</strong>
                </div>
                <q-linear-progress
                  :value="(100 - (Number(resumen.total_notas_credito || 0) / Number(resumen.total_facturado || 1) * 100)) / 100"
                  color="primary"
                  track-color="grey-3"
                  rounded
                  size="10px"
                />
              </div>

              <div class="q-mt-lg q-pa-md bg-grey-2 border-radius-8">
                <div class="text-weight-bold text-subtitle2 q-mb-xs">Resumen para Junta Directiva:</div>
                <div class="text-caption text-grey-8">
                  De los <strong>{{ cop(resumen.total_facturado) }}</strong> brutos emitidos en el año {{ anioSeleccionado }}, 
                  se emitieron <strong>{{ control.con_nota_credito.total_notas }}</strong> notas de ajuste por <strong>{{ cop(control.con_nota_credito.total) }}</strong> 
                  dejando una facturación neta operativa de <strong>{{ cop(facturacionNeta) }}</strong>. 
                  El <strong>{{ pct(control.con_cxc.porcentaje) }}</strong> pasó a cartera institucional EPS, y se registra un índice de anulación controlado del <strong>{{ pct(control.anuladas.porcentaje) }}</strong>.
                </div>
              </div>
            </div>
          </article>
        </section>
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
import { tinta } from '../data/demoPresentacion.js'
import { cop, millones, pct } from '../utils/formato.js'

const anioSeleccionado = ref(2026)
const loading = ref(true)
const filtroUsuario = ref('')

const periodoUsuario = ref('semana') // Por defecto por semana
const totalPeriodoUsuario = ref(0)
const loadingUsuarios = ref(false)

const resumen = ref({
  total_facturas: 0,
  total_facturado: 0,
  facturas_anuladas: 0,
  valor_anulado: 0,
  facturas_dian_aprobadas: 0,
  facturas_dian_pendientes: 0,
  total_clientes: 0,
  total_notas: 0,
  total_notas_credito: 0,
})

const control = ref({
  total_facturas: 0,
  total_facturado: 0,
  con_cxc: { facturas: 0, total: 0, porcentaje: 0 },
  sin_cxc: { facturas: 0, total: 0, porcentaje: 0 },
  anuladas: { facturas: 0, total: 0, porcentaje: 0 },
  con_nota_credito: { facturas: 0, total_notas: 0, total: 0, porcentaje: 0 },
  facturacion_neta: 0,
})

const usuariosFacturacion = ref([])
const anuladasDetalle = ref([])
const mesesTendencia = ref([])
const procedencias = ref([])
const topClientes = ref([])

const semanaRaw = ref([])
const semanaTotal = ref(0)
const semanaFacturas = ref(0)

const mesActualRaw = ref([])
const mesActualNombre = ref('Mes Actual')
const mesActualTotal = ref(0)
const mesActualFacturas = ref(0)

const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// 1. Serie Semana Actual (Lun a Dom)
const semanaCategorias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const serieSemana = computed(() => {
  const valores = [0, 0, 0, 0, 0, 0, 0]
  if (semanaRaw.value.length) {
    semanaRaw.value.forEach(item => {
      const idx = Number(item.dia_num) - 1
      if (idx >= 0 && idx < 7) {
        valores[idx] = Number(item.total_facturado || 0)
      }
    })
  }
  return [{ name: 'Semana Actual', color: tinta.azul, values: valores }]
})

// 2. Serie Mes Actual (Día a día 1 al 30)
const mesActualCategorias = computed(() => {
  if (mesActualRaw.value.length) {
    return mesActualRaw.value.map(d => String(d.dia))
  }
  return Array.from({ length: 30 }, (_, i) => String(i + 1))
})

const serieMesActual = computed(() => {
  let valores = []
  if (mesActualRaw.value.length) {
    valores = mesActualRaw.value.map(d => Number(d.total_facturado || 0))
  }
  return [{ name: mesActualNombre.value, color: tinta.cyan, values: valores }]
})

const facturacionNeta = computed(() => {
  const bruto = Number(control.value.total_facturado || resumen.value.total_facturado || 0)
  const nc = Number(control.value.con_nota_credito.total || resumen.value.total_notas_credito || 0)
  return bruto - nc
})

const ticketPromedio = computed(() => {
  const tot = Number(resumen.value.total_facturas || 0)
  return tot > 0 ? Number(resumen.value.total_facturado || 0) / tot : 0
})

const pctDian = computed(() => {
  const tot = Number(resumen.value.total_facturas || 0)
  return tot > 0 ? (Number(resumen.value.facturas_dian_aprobadas || 0) / tot) * 100 : 0
})

const serieMensual = computed(() => {
  const valores = new Array(12).fill(0)
  mesesTendencia.value.forEach(item => {
    if (item.mes >= 1 && item.mes <= 12) {
      valores[item.mes - 1] = Number(item.facturado || 0)
    }
  })
  return [{ name: 'Facturado ' + anioSeleccionado.value, color: tinta.azul, values: valores }]
})

const procedenciasItems = computed(() => {
  const paleta = [tinta.azul, tinta.cyan, tinta.actual, tinta.verde, tinta.naranja]
  const labelsMap = {
    CE: 'Consulta Externa (CE)',
    CI: 'Citas / Internación (CI)',
    FINANCIERO: 'Financiero / PGP',
    CAJA: 'Caja / Copagos',
  }
  return procedencias.value.map((p, idx) => ({
    label: labelsMap[p.procedencia] || p.procedencia,
    value: Number(p.total || 0),
    color: paleta[idx % paleta.length],
  }))
})

// Donut Con CxC vs Sin CxC
const cxcDonutItems = computed(() => {
  return [
    {
      label: `Con CxC (${control.value.con_cxc.facturas.toLocaleString('es-CO')} fac)`,
      value: Number(control.value.con_cxc.total || 0),
      color: '#10B981',
    },
    {
      label: `Sin CxC (${control.value.sin_cxc.facturas.toLocaleString('es-CO')} fac)`,
      value: Number(control.value.sin_cxc.total || 0),
      color: '#F59E0B',
    },
  ]
})

// Subtítulo dinámico según periodo seleccionado
const subtituloPeriodo = computed(() => {
  if (periodoUsuario.value === 'semana') {
    return `Semana en curso (Lun - Dom) · Facturado: ${cop(totalPeriodoUsuario.value)}`
  }
  if (periodoUsuario.value === 'mes') {
    return `Mes actual (${mesActualNombre.value}) · Facturado: ${cop(totalPeriodoUsuario.value)}`
  }
  return `Vigencia institucional (${anioSeleccionado.value}) · Facturado: ${cop(totalPeriodoUsuario.value)}`
})

// Cambio interactivo entre los 3 checks de periodo
async function cambiarPeriodoUsuario() {
  loadingUsuarios.value = true
  try {
    const res = await api.get(`/facturacion-tablero/por-usuario?anio=${anioSeleccionado.value}&periodo=${periodoUsuario.value}`)
    if (res.data) {
      if (Array.isArray(res.data)) {
        usuariosFacturacion.value = res.data
        totalPeriodoUsuario.value = res.data.reduce((acc, r) => acc + Number(r.total_facturado || 0), 0)
      } else {
        usuariosFacturacion.value = res.data.usuarios || []
        totalPeriodoUsuario.value = res.data.total_periodo || 0
      }
    }
  } catch (err) {
    console.error('Error cargando usuarios por periodo:', err)
  } finally {
    loadingUsuarios.value = false
  }
}

// Usuarios Filtrados y Porcentaje sobre el periodo seleccionado
const usuariosFiltrados = computed(() => {
  const totalFact = Number(totalPeriodoUsuario.value || control.value.total_facturado || 1)
  const query = filtroUsuario.value.trim().toLowerCase()
  return usuariosFacturacion.value
    .map(u => ({
      ...u,
      porcentaje: ((Number(u.total_facturado || 0) / totalFact) * 100).toFixed(1),
    }))
    .filter(u => {
      if (!query) return true
      return (
        (u.usuario || '').toLowerCase().includes(query) ||
        (u.usuario_factura || '').toLowerCase().includes(query)
      )
    })
})

// Columnas Tabla Usuarios
const columnasUsuarios = [
  { name: 'usuario', label: 'Facturador / Usuario', field: 'usuario', align: 'left', sortable: true },
  { name: 'total_facturado', label: 'Total Facturado', field: 'total_facturado', align: 'right', sortable: true },
  { name: 'total_facturas', label: 'Facturas', field: 'total_facturas', align: 'center', sortable: true },
  { name: 'ticket_promedio', label: 'Ticket Promedio', field: 'ticket_promedio', align: 'right', sortable: true },
  { name: 'facturas_con_cxc', label: 'Con CxC', field: 'facturas_con_cxc', align: 'center', sortable: true },
  { name: 'facturas_sin_cxc', label: 'Sin CxC', field: 'facturas_sin_cxc', align: 'center', sortable: true },
  { name: 'facturas_anuladas', label: 'Anuladas', field: 'facturas_anuladas', align: 'center', sortable: true },
  { name: 'porcentaje', label: '% Participación', field: 'porcentaje', align: 'left', sortable: true },
]

// Columnas Tabla Anuladas
const columnasAnuladas = [
  { name: 'n_factura', label: 'N° Factura', field: 'n_factura', align: 'left' },
  { name: 'fecha', label: 'Fecha', field: 'fecha', align: 'center' },
  { name: 'razon_social', label: 'Entidad / Pagador', field: 'razon_social', align: 'left', style: 'max-width: 220px; white-space: normal;' },
  { name: 'valor_total', label: 'Valor Anulado', field: 'valor_total', align: 'right' },
  { name: 'usuario', label: 'Facturador', field: 'usuario', align: 'left' },
  { name: 'procedencia', label: 'Proc.', field: 'procedencia', align: 'center' },
]

// Columnas Tabla Top Clientes
const columnasClientes = [
  { name: 'razon_social', label: 'Entidad / Pagador', field: 'razon_social', align: 'left', style: 'max-width: 250px; white-space: normal;' },
  { name: 'nit', label: 'NIT', field: 'nit', align: 'left' },
  { name: 'cantidad_facturas', label: 'Facturas', field: 'cantidad_facturas', align: 'center' },
  { name: 'total_facturado', label: 'Total Facturado', field: 'total_facturado', align: 'right' },
]

async function cargarTodo() {
  loading.value = true
  try {
    const [resResumen, resMes, resProc, resTop, resSem, resMesActual, resUsers, resControl, resAnuladas] = await Promise.allSettled([
      api.get(`/facturacion-tablero/resumen?anio=${anioSeleccionado.value}`),
      api.get(`/facturacion-tablero/tendencia-mensual?anio=${anioSeleccionado.value}`),
      api.get(`/facturacion-tablero/por-procedencia?anio=${anioSeleccionado.value}`),
      api.get(`/facturacion-tablero/top-clientes?anio=${anioSeleccionado.value}&limit=10`),
      api.get('/facturacion-tablero/semana-actual'),
      api.get('/facturacion-tablero/mes-actual'),
      api.get(`/facturacion-tablero/por-usuario?anio=${anioSeleccionado.value}&periodo=${periodoUsuario.value}`),
      api.get(`/facturacion-tablero/control-estados?anio=${anioSeleccionado.value}`),
      api.get(`/facturacion-tablero/anuladas-detalle?anio=${anioSeleccionado.value}&limit=15`),
    ])
    if (resResumen.status === 'fulfilled' && resResumen.value.data) resumen.value = resResumen.value.data
    if (resMes.status === 'fulfilled' && resMes.value.data) mesesTendencia.value = resMes.value.data
    if (resProc.status === 'fulfilled' && resProc.value.data) procedencias.value = resProc.value.data
    if (resTop.status === 'fulfilled' && resTop.value.data) topClientes.value = resTop.value.data

    if (resSem.status === 'fulfilled' && resSem.value.data) {
      semanaRaw.value = resSem.value.data.semana || []
      semanaTotal.value = resSem.value.data.total_semana || 0
      semanaFacturas.value = resSem.value.data.facturas_semana || 0
    }

    if (resMesActual.status === 'fulfilled' && resMesActual.value.data) {
      mesActualRaw.value = resMesActual.value.data.dias || []
      mesActualNombre.value = resMesActual.value.data.mes_nombre || 'Mes Actual'
      mesActualTotal.value = resMesActual.value.data.total_mes || 0
      mesActualFacturas.value = resMesActual.value.data.facturas_mes || 0
    }

    if (resUsers.status === 'fulfilled' && resUsers.value.data) {
      const data = resUsers.value.data
      if (Array.isArray(data)) {
        usuariosFacturacion.value = data
        totalPeriodoUsuario.value = data.reduce((acc, r) => acc + Number(r.total_facturado || 0), 0)
      } else {
        usuariosFacturacion.value = data.usuarios || []
        totalPeriodoUsuario.value = data.total_periodo || 0
      }
    }

    if (resControl.status === 'fulfilled' && resControl.value.data) {
      control.value = resControl.value.data
    }

    if (resAnuladas.status === 'fulfilled' && resAnuladas.value.data) {
      anuladasDetalle.value = resAnuladas.value.data
    }
  } catch (err) {
    console.error('Error cargando datos de facturación:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  cargarTodo()
})
</script>

<style scoped>
.vi-kpi--neto {
  border-top-color: #0072CE !important;
}
.vi-kpi--cxc {
  border-top-color: #10B981 !important;
}
.vi-kpi--sincxc {
  border-top-color: #F59E0B !important;
}
.vi-kpi--anuladas {
  border-top-color: #EF4444 !important;
}
.vi-kpi--nc {
  border-top-color: #8B5CF6 !important;
}
.vi-kpi--dian {
  border-top-color: #00B5E2 !important;
}

/* Cabecera en 2 columnas: Título izq y Controles al frente (derecha) */
.vi-header-2col {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
}

.vi-header-2col__der {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.periodo-radio {
  font-size: 11px !important;
  margin-right: 2px;
}

.filtro-input {
  width: 160px;
}
</style>
