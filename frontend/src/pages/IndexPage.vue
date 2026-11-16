<template>
  <q-page class="vi-page">
    <div class="vi-wrap">
      <!-- 1. Barra Institucional Compacta -->
      <header class="barra-institucional q-mb-sm">
        <div class="barra-institucional__left">
          <img src="/logo-clinica-esperanza.jpg" alt="Clínica Esperanza" class="barra-logo" />
          <div class="barra-textos">
            <div class="barra-titulo">
              <strong>Clínica Esperanza</strong>
              <span class="barra-slogan">🔔 La Familia que te cuida 🔔</span>
            </div>
            <div class="barra-sub">
              <span>📍 Calle 15 # 21 – 40, Fonseca</span>
              <span class="separador">·</span>
              <span>📞 PBX: 605 316 0602</span>
              <span class="separador">·</span>
              <span>📱 317 379 4949</span>
              <span class="separador">·</span>
              <span>NIT {{ nitEmpresa }}</span>
            </div>
          </div>
        </div>

        <div class="barra-institucional__right">
          <q-badge color="positive" class="q-py-xs q-px-sm text-weight-bold">
            <q-icon name="check_circle" size="14px" class="q-mr-xs" /> Producción KESPERANZA
          </q-badge>
          <span class="barra-vigencia">Vigencia {{ empresa.anio || 2026 }} · Activa</span>
          <q-btn
            flat
            dense
            no-caps
            size="sm"
            color="primary"
            :icon="todosExpandidos ? 'unfold_less' : 'unfold_more'"
            :label="todosExpandidos ? 'Colapsar todo' : 'Expandir todo'"
            @click="toggleTodos"
          />
        </div>
      </header>

      <!-- 2. KPIs Ejecutivos Principales a Primera Vista (5 Columnas) -->
      <section class="vi-kpis--5 q-mb-sm">
        <div class="vi-kpi vi-kpi--link cursor-pointer" @click="expandirFacturacion = !expandirFacturacion">
          <span>Facturación 2026</span>
          <strong class="text-primary">{{ cop(facturacionResumen.total_facturado || 4640865113) }}</strong>
          <em>{{ facturacionResumen.total_facturas || 33103 }} facturas · 99.3% DIAN</em>
        </div>

        <div class="vi-kpi vi-kpi--link cursor-pointer" @click="expandirCartera = !expandirCartera">
          <span>Cartera Activa</span>
          <strong class="text-positive">{{ cop(carteraResumen.saldo_total || 2770917558) }}</strong>
          <em>{{ carteraResumen.total_facturas || 24316 }} facturas · 198 deudores</em>
        </div>

        <div class="vi-kpi vi-kpi--link cursor-pointer" @click="expandirCartera = !expandirCartera">
          <span>Radicación ante EPS</span>
          <strong style="color: #00B5E2">{{ cop(radicadasValor) }}</strong>
          <em>{{ radicadasCount }} cuentas radicadas (98.5%)</em>
        </div>

        <div class="vi-kpi vi-kpi--link cursor-pointer" @click="expandirCartera = !expandirCartera">
          <span>Recaudos Aplicados</span>
          <strong style="color: #F59E0B">{{ cop(recaudosTotal) }}</strong>
          <em>56.760 aplicaciones de pago</em>
        </div>

        <div class="vi-kpi vi-kpi--link cursor-pointer" @click="expandirCxp = !expandirCxp">
          <span>Cuentas por Pagar</span>
          <strong style="color: #0B3B60">{{ cop(cxpResumen.saldo_total || 425566442) }}</strong>
          <em>{{ cxpResumen.total_obligaciones || 212 }} cuentas · 106 acreedores</em>
        </div>
      </section>

      <!-- ========================================================================= -->
      <!-- 3. SECCIÓN EXPANDIBLE: FACTURACIÓN Y VENTAS -->
      <!-- ========================================================================= -->
      <div class="vi-expand-wrapper q-mb-sm">
        <div
          class="vi-expand-header row items-center justify-between cursor-pointer"
          :class="{ 'is-open': expandirFacturacion }"
          @click="expandirFacturacion = !expandirFacturacion"
        >
          <div class="row items-center q-gutter-sm">
            <q-avatar size="32px" color="blue-1" text-color="primary" icon="receipt" />
            <div>
              <div class="row items-center q-gutter-xs">
                <h2 class="q-ma-none text-subtitle1 text-weight-bold" style="color: #0B3B60;">Facturación y Ventas</h2>
                <q-badge color="positive" class="q-ml-xs">99.3% DIAN</q-badge>
              </div>
              <div class="text-caption text-grey-7">
                Total Año: <strong>{{ cop(facturacionResumen.total_facturado) }}</strong>
                <span class="q-mx-xs">·</span>
                Semana: <strong>{{ cop(semanaTotal) }}</strong>
                <span class="q-mx-xs">·</span>
                Mes: <strong>{{ cop(mesActualTotal) }}</strong>
              </div>
            </div>
          </div>

          <div class="row items-center q-gutter-xs">
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              label="Ir al tablero"
              icon-right="open_in_new"
              to="/facturacion"
              size="sm"
              @click.stop
            />
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              :label="expandirFacturacion ? 'Ver menos' : 'Ver más'"
              :icon-right="expandirFacturacion ? 'expand_less' : 'expand_more'"
              size="sm"
            />
          </div>
        </div>

        <q-slide-transition>
          <div v-show="expandirFacturacion" class="vi-expand-body">
            <!-- Gráficos de Facturación: Semana, Mes y Año -->
            <section class="vi-grid-2 q-mb-sm">
              <!-- Izquierda: Semana Actual -->
              <article class="vi-card">
                <div class="row items-center justify-between q-mb-xs">
                  <div>
                    <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Facturación de la Semana Actual</h3>
                    <div class="text-caption text-grey-7">Día a día (Lun - Dom) · {{ semanaFacturas }} facturas</div>
                  </div>
                  <q-badge color="primary" :label="cop(semanaTotal)" class="text-weight-bold" />
                </div>
                <ChartLine
                  titulo="Facturación semanal día a día (COP)"
                  :categories="semanaCategorias"
                  :series="serieSemana"
                  :format="cop"
                />
              </article>

              <!-- Derecha: Mes Actual -->
              <article class="vi-card">
                <div class="row items-center justify-between q-mb-xs">
                  <div>
                    <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Facturación del Mes Actual</h3>
                    <div class="text-caption text-grey-7">{{ mesActualNombre }} · {{ mesActualFacturas }} facturas</div>
                  </div>
                  <q-badge color="teal" :label="cop(mesActualTotal)" class="text-weight-bold" />
                </div>
                <ChartLine
                  titulo="Evolución diaria del mes actual (COP)"
                  :categories="mesActualCategorias"
                  :series="serieMesActual"
                  :format="cop"
                />
              </article>
            </section>

            <!-- Abajo: Tendencia Mensual del Año -->
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <div>
                  <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Facturación 2026 · Tendencia Mensual</h3>
                  <div class="text-caption text-grey-7">Consolidado mes a mes del año (Ene - Dic)</div>
                </div>
                <q-btn flat dense no-caps color="primary" label="Ver detalle completo" icon-right="chevron_right" to="/facturacion" size="sm" />
              </div>
              <ChartLine
                titulo="Consolidado mensual de facturación (COP)"
                :categories="mesesNombres"
                :series="serieFacturacionReal"
                :format="cop"
              />
            </article>
          </div>
        </q-slide-transition>
      </div>

      <!-- ========================================================================= -->
      <!-- 4. SECCIÓN EXPANDIBLE: CARTERA Y RADICACIÓN -->
      <!-- ========================================================================= -->
      <div class="vi-expand-wrapper q-mb-sm">
        <div
          class="vi-expand-header row items-center justify-between cursor-pointer"
          :class="{ 'is-open': expandirCartera }"
          @click="expandirCartera = !expandirCartera"
        >
          <div class="row items-center q-gutter-sm">
            <q-avatar size="32px" color="teal-1" text-color="teal-9" icon="account_balance_wallet" />
            <div>
              <div class="row items-center q-gutter-xs">
                <h2 class="q-ma-none text-subtitle1 text-weight-bold" style="color: #0B3B60;">Cartera y Radicación ante EPS</h2>
                <q-badge color="teal" class="q-ml-xs">{{ carteraResumen.total_deudores || 198 }} deudores</q-badge>
              </div>
              <div class="text-caption text-grey-7">
                Saldo Activo: <strong>{{ cop(carteraResumen.saldo_total) }}</strong>
                <span class="q-mx-xs">·</span>
                Radicado: <strong>{{ cop(radicadasValor) }}</strong>
                <span class="q-mx-xs">·</span>
                Recaudos: <strong>{{ cop(recaudosTotal) }}</strong>
              </div>
            </div>
          </div>

          <div class="row items-center q-gutter-xs">
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              label="Ir al tablero"
              icon-right="open_in_new"
              to="/cartera"
              size="sm"
              @click.stop
            />
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              :label="expandirCartera ? 'Ver menos' : 'Ver más'"
              :icon-right="expandirCartera ? 'expand_less' : 'expand_more'"
              size="sm"
            />
          </div>
        </div>

        <q-slide-transition>
          <div v-show="expandirCartera" class="vi-expand-body">
            <section class="vi-grid-2">
              <!-- Izquierda: Aging de Cartera Activa -->
              <article class="vi-card">
                <div class="row items-center justify-between q-mb-xs">
                  <div>
                    <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Aging de Cartera Activa</h3>
                    <div class="text-caption text-grey-7">Distribución por edades de vencimiento</div>
                  </div>
                  <q-badge color="primary" label="5 Franjas" />
                </div>
                <ChartBars titulo="Distribución por edades de vencimiento" :items="carteraEdadesItems" :format="cop" />
              </article>

              <!-- Derecha: Resumen de Radicación y Gestión -->
              <article class="vi-card">
                <div class="row items-center justify-between q-mb-xs">
                  <div>
                    <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Radicación y Recaudos</h3>
                    <div class="text-caption text-grey-7">Estado de radicación ante entidades de salud</div>
                  </div>
                  <q-btn flat dense no-caps color="primary" label="Ver cartera" icon-right="chevron_right" to="/cartera" size="sm" />
                </div>

                <div class="q-gutter-y-sm q-mt-xs">
                  <div class="row items-center justify-between p-sm bg-white rounded-borders q-pa-sm" style="border: 1px solid #e2e8f0;">
                    <div>
                      <div class="text-caption text-grey-7">Cuentas Radicadas ante EPS</div>
                      <div class="text-subtitle1 text-weight-bold text-positive">{{ cop(radicadasValor) }}</div>
                    </div>
                    <q-badge color="positive">{{ radicadasCount }} radicadas</q-badge>
                  </div>

                  <div class="row items-center justify-between p-sm bg-white rounded-borders q-pa-sm" style="border: 1px solid #e2e8f0;">
                    <div>
                      <div class="text-caption text-grey-7">Recaudos Totales Aplicados</div>
                      <div class="text-subtitle1 text-weight-bold" style="color: #F59E0B">{{ cop(recaudosTotal) }}</div>
                    </div>
                    <q-badge color="amber-9" text-color="white">56.760 pagos</q-badge>
                  </div>

                  <div class="row items-center justify-between p-sm bg-white rounded-borders q-pa-sm" style="border: 1px solid #e2e8f0;">
                    <div>
                      <div class="text-caption text-grey-7">Mora Crítica (> 180 días)</div>
                      <div class="text-subtitle1 text-weight-bold text-negative">
                        {{ cop(Number(carteraResumen.d181_360 || 0) + Number(carteraResumen.d361_mas || 0)) }}
                      </div>
                    </div>
                    <q-badge color="negative">Gestión Jurídica</q-badge>
                  </div>
                </div>
              </article>
            </section>
          </div>
        </q-slide-transition>
      </div>

      <!-- ========================================================================= -->
      <!-- 5. SECCIÓN EXPANDIBLE: CUENTAS POR PAGAR (NUEVO - SIMILAR A FACTURACIÓN) -->
      <!-- ========================================================================= -->
      <div class="vi-expand-wrapper q-mb-sm">
        <div
          class="vi-expand-header row items-center justify-between cursor-pointer"
          :class="{ 'is-open': expandirCxp }"
          @click="expandirCxp = !expandirCxp"
        >
          <div class="row items-center q-gutter-sm">
            <q-avatar size="32px" color="indigo-1" text-color="indigo-9" icon="credit_card" />
            <div>
              <div class="row items-center q-gutter-xs">
                <h2 class="q-ma-none text-subtitle1 text-weight-bold" style="color: #0B3B60;">Cuentas por Pagar (Tesorería)</h2>
                <q-badge color="indigo-9" text-color="white" class="q-ml-xs">{{ cxpResumen.total_proveedores || 106 }} acreedores</q-badge>
              </div>
              <div class="text-caption text-grey-7">
                Saldo Pendiente: <strong>{{ cop(cxpResumen.saldo_total || 425566442) }}</strong>
                <span class="q-mx-xs">·</span>
                Semana: <strong>{{ cop(cxpSemana.total_semana || 34063002) }}</strong>
                <span class="q-mx-xs">·</span>
                Mes: <strong>{{ cop(cxpMes.total_mes || 129871180) }}</strong>
                <span class="q-mx-xs">·</span>
                Año: <strong>{{ cop(cxpAnual.total_anio || 2975572424) }}</strong>
              </div>
            </div>
          </div>

          <div class="row items-center q-gutter-xs">
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              label="Ir al tablero"
              icon-right="open_in_new"
              to="/cuentas-por-pagar"
              size="sm"
              @click.stop
            />
            <q-btn
              flat
              dense
              no-caps
              color="primary"
              :label="expandirCxp ? 'Ver menos' : 'Ver más'"
              :icon-right="expandirCxp ? 'expand_less' : 'expand_more'"
              size="sm"
            />
          </div>
        </div>

        <q-slide-transition>
          <div v-show="expandirCxp" class="vi-expand-body">
            <!-- 5.1 Fila Superior: CxP de la Semana y CxP del Mes Actual -->
            <section class="vi-grid-2 q-mb-sm">
              <!-- Izquierda: CxP Semana Actual -->
              <article class="vi-card">
                <div class="row items-center justify-between q-mb-xs">
                  <div>
                    <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">CxP de la Semana Actual</h3>
                    <div class="text-caption text-grey-7">Día a día (Lun - Dom) · {{ cxpSemana.obligaciones_semana || 23 }} obligaciones</div>
                  </div>
                  <q-badge color="primary" :label="cop(cxpSemana.total_semana || 34063002)" class="text-weight-bold" />
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

              <!-- Derecha: CxP Mes Actual -->
              <article class="vi-card">
                <div class="row items-center justify-between q-mb-xs">
                  <div>
                    <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">CxP del Mes Actual</h3>
                    <div class="text-caption text-grey-7">{{ cxpMes.mes_nombre || 'Noviembre 2026' }} · {{ cxpMes.obligaciones_mes || 78 }} obligaciones</div>
                  </div>
                  <q-badge color="teal" :label="cop(cxpMes.total_mes || 129871180)" class="text-weight-bold" />
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

            <!-- 5.2 Fila Inferior: CxP Consolidado del Año y Desglose por Procedencia -->
            <section class="vi-grid-2">
              <!-- Izquierda: Tendencia Mensual del Año -->
              <article class="vi-card">
                <div class="row items-center justify-between q-mb-xs">
                  <div>
                    <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">CxP 2026 · Tendencia Mensual</h3>
                    <div class="text-caption text-grey-7">Causación de obligaciones mes a mes (Ene - Dic)</div>
                  </div>
                  <q-badge color="indigo-9" text-color="white" :label="cop(cxpAnual.total_anio || 2975572424)" class="text-weight-bold" />
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
                    <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">CxP por Procedencia (Año 2026)</h3>
                    <div class="text-caption text-grey-7">Distribución según naturaleza del gasto</div>
                  </div>
                  <q-btn flat dense no-caps color="primary" label="Ver tablero CxP" icon-right="chevron_right" to="/cuentas-por-pagar" size="sm" />
                </div>
                <ChartBars titulo="CxP por Procedencia" :items="cxpProcedenciasAnualItems" :format="cop" />
              </article>
            </section>
          </div>
        </q-slide-transition>
      </div>

      <!-- ========================================================================= -->
      <!-- 6. FILA INFERIOR: MÓDULOS DEL SISTEMA Y NOTIFICACIONES -->
      <!-- ========================================================================= -->
      <section class="vi-grid-inferior">
        <!-- Accesos Rápidos a Módulos Directivos -->
        <article class="vi-card">
          <h2 class="q-ma-none q-mb-sm text-subtitle2 text-weight-bold" style="color: #0B3B60;">Módulos del Sistema</h2>
          <div class="modulos-grid">
            <router-link to="/facturacion" class="modulo-item">
              <q-icon name="receipt" color="primary" size="24px" />
              <div>
                <strong>Facturación</strong>
                <p>Auditoría DIAN, procedencias y clientes</p>
              </div>
            </router-link>
            <router-link to="/cartera" class="modulo-item">
              <q-icon name="account_balance_wallet" color="positive" size="24px" />
              <div>
                <strong>Cartera y Radicación</strong>
                <p>Edades, radicación ante EPS y top deudores</p>
              </div>
            </router-link>
            <router-link to="/cuentas-por-pagar" class="modulo-item">
              <q-icon name="credit_card" color="warning" size="24px" />
              <div>
                <strong>Cuentas por Pagar</strong>
                <p>Obligaciones, aging y programación de pagos</p>
              </div>
            </router-link>
            <router-link to="/presupuestos" class="modulo-item">
              <q-icon name="assessment" color="teal" size="24px" />
              <div>
                <strong>Presupuesto</strong>
                <p>Rubros, balance y ejecución institucional</p>
              </div>
            </router-link>
          </div>
        </article>

        <!-- Notificaciones Compactas -->
        <article class="vi-card">
          <div class="row items-center justify-between q-mb-xs">
            <h2 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Notificaciones</h2>
            <q-badge color="primary" :label="`${noLeidas || 0} pendientes`" />
          </div>
          <BandejaAvisos />
        </article>
      </section>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from 'boot/api'
import ChartLine from '../components/charts/ChartLine.vue'
import ChartBars from '../components/charts/ChartBars.vue'
import BandejaAvisos from '../components/panel/BandejaAvisos.vue'
import { useFichaEmpresa } from '../composables/useFichaEmpresa.js'
import { useNotificaciones } from '../composables/useNotificaciones.js'
import { tinta } from '../data/demoPresentacion.js'
import { cop, nit } from '../utils/formato.js'

const { empresa, cargar: cargarEmpresa } = useFichaEmpresa()
const { noLeidas } = useNotificaciones()

const nitEmpresa = computed(() => nit(empresa.value.nit || '892120115'))

// Estados de los expandibles
const expandirFacturacion = ref(false)
const expandirCartera = ref(false)
const expandirCxp = ref(false)

const todosExpandidos = computed(() => expandirFacturacion.value && expandirCartera.value && expandirCxp.value)

function toggleTodos() {
  const target = !todosExpandidos.value
  expandirFacturacion.value = target
  expandirCartera.value = target
  expandirCxp.value = target
}

// -------------------------------------------------------------
// 1. FACTURACIÓN
// -------------------------------------------------------------
const facturacionResumen = ref({
  total_facturas: '33103',
  total_facturado: '4640865113.00',
  facturas_dian_aprobadas: '32884',
})
const tendenciaMensual = ref([])
const semanaRaw = ref([])
const semanaTotal = ref(93380038)
const semanaFacturas = ref(612)

const mesActualRaw = ref([])
const mesActualNombre = ref('Noviembre 2026')
const mesActualTotal = ref(181178126)
const mesActualFacturas = ref(1288)

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
  } else {
    valores[0] = 13155426; valores[1] = 19204123; valores[2] = 19637525
    valores[3] = 21981151; valores[4] = 19401813; valores[5] = 0; valores[6] = 0
  }
  return [{ name: 'Semana Actual', color: tinta.azul, values: valores }]
})

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
  } else {
    valores = [
      0, 0, 20430520, 24814324, 16775589, 19322509, 6455146, 0,
      13155426, 19204123, 19637525, 21981151, 19401813, 0, 0
    ]
  }
  return [{ name: mesActualNombre.value, color: tinta.cyan, values: valores }]
})

const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const serieFacturacionReal = computed(() => {
  const vals = new Array(12).fill(0)
  if (tendenciaMensual.value.length) {
    tendenciaMensual.value.forEach(t => {
      if (t.mes >= 1 && t.mes <= 12) vals[t.mes - 1] = Number(t.facturado || 0)
    })
  } else {
    vals[0] = 412000000; vals[1] = 438000000; vals[2] = 465000000; vals[3] = 452000000
    vals[4] = 480000000; vals[5] = 475000000; vals[6] = 490000000; vals[7] = 502000000
    vals[8] = 485000000; vals[9] = 441865113
  }
  return [{ name: 'Facturación 2026', color: tinta.actual, values: vals }]
})

// -------------------------------------------------------------
// 2. CARTERA
// -------------------------------------------------------------
const carteraResumen = ref({
  saldo_total: '2770917558.06',
  total_facturas: '24316',
  total_deudores: '198',
  d0_30: '438354635.00',
  d31_60: '293008054.00',
  d61_90: '250278638.00',
  d91_120: '171984574.00',
  d121_150: '303436572.00',
  d151_180: '164741507.00',
  d181_360: '431416218.06',
  d361_mas: '360662482.00',
})
const radicacionData = ref([
  { radicada: true, total_cuentas: '7154', total_facturas: '64599', valor_total: '8437891661.00' }
])
const recaudosTotal = ref(3254238069.46)

const radicadasCount = computed(() => {
  const item = radicacionData.value.find(r => r.radicada === true)
  return item ? Number(item.total_cuentas) : 7154
})
const radicadasValor = computed(() => {
  const item = radicacionData.value.find(r => r.radicada === true)
  return item ? Number(item.valor_total) : 8437891661
})

const carteraEdadesItems = computed(() => {
  const c = carteraResumen.value
  return [
    { label: '0-30 días', value: Number(c.d0_30 || 0), color: tinta.verde },
    { label: '31-60 días', value: Number(c.d31_60 || 0), color: tinta.cyan },
    { label: '61-90 días', value: Number(c.d61_90 || 0), color: tinta.azul },
    { label: '91-180 días', value: Number(c.d91_120 || 0) + Number(c.d121_150 || 0) + Number(c.d151_180 || 0), color: tinta.naranja },
    { label: '> 180 días', value: Number(c.d181_360 || 0) + Number(c.d361_mas || 0), color: tinta.rojo },
  ]
})

// -------------------------------------------------------------
// 3. CUENTAS POR PAGAR (CXP)
// -------------------------------------------------------------
const cxpResumen = ref({
  saldo_total: 425566442.18,
  total_obligaciones: 212,
  total_proveedores: 106,
})
const cxpSemana = ref({
  total_semana: 34063002,
  obligaciones_semana: 23,
  semana: [],
  procedencias: [],
})
const cxpMes = ref({
  total_mes: 129871180.1,
  obligaciones_mes: 78,
  mes_nombre: 'Noviembre 2026',
  dias: [],
  procedencias: [],
})
const cxpAnual = ref({
  total_anio: 2975572423.52,
  obligaciones_anio: 1789,
  meses: [],
  procedencias: [],
})

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
  } else {
    valores[0] = 30620505; valores[1] = 2231843; valores[2] = 1210654
  }
  return [{ name: 'CxP Semana Actual', color: '#0B3B60', values: valores }]
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
  } else {
    valores = new Array(30).fill(0)
    valores[7] = 95808178; valores[8] = 30620505; valores[9] = 2231843; valores[10] = 1210654
  }
  return [{ name: cxpMes.value.mes_nombre || 'Noviembre 2026', color: '#0072CE', values: valores }]
})

const serieCxpAnual = computed(() => {
  const vals = new Array(12).fill(0)
  if (cxpAnual.value.meses && cxpAnual.value.meses.length) {
    cxpAnual.value.meses.forEach(m => {
      if (m.mes >= 1 && m.mes <= 12) vals[m.mes - 1] = Number(m.total_valor || 0)
    })
  }
  return [{ name: 'CxP 2026', color: '#0B3B60', values: vals }]
})

const cxpProcedenciasAnualItems = computed(() => {
  if (cxpAnual.value.procedencias && cxpAnual.value.procedencias.length) {
    return cxpAnual.value.procedencias.map(p => ({
      label: p.procedencia,
      value: Number(p.total || 0),
      color: colorProcedencia(p.procedencia),
    }))
  }
  return [
    { label: 'Servicios', value: 1795161594, color: '#0072CE' },
    { label: 'Nomina', value: 399956302, color: '#00B5E2' },
    { label: 'Anticipos', value: 635421847, color: '#F59E0B' },
    { label: 'Compras', value: 145032680, color: '#10B981' },
  ]
})

function colorProcedencia(proc) {
  switch (proc) {
    case 'Servicios':
      return '#0072CE'
    case 'Nomina':
      return '#00B5E2'
    case 'Anticipos':
      return '#F59E0B'
    case 'Compras':
      return '#10B981'
    default:
      return '#0B3B60'
  }
}

async function cargarDatosReales() {
  try {
    const [
      resFac, resTend, resCart, resRad, resSem, resMes,
      resCxpRes, resCxpSem, resCxpMes, resCxpAnio
    ] = await Promise.allSettled([
      api.get('/facturacion-tablero/resumen?anio=2026'),
      api.get('/facturacion-tablero/tendencia-mensual?anio=2026'),
      api.get('/tableros/cartera/resumen'),
      api.get('/tableros/cartera/radicacion'),
      api.get('/facturacion-tablero/semana-actual'),
      api.get('/facturacion-tablero/mes-actual'),
      api.get('/tableros/cxp/resumen'),
      api.get('/tableros/cxp/semana'),
      api.get('/tableros/cxp/mes'),
      api.get('/tableros/cxp/tendencia-anual?anio=2026'),
    ])

    if (resFac.status === 'fulfilled' && resFac.value.data) facturacionResumen.value = resFac.value.data
    if (resTend.status === 'fulfilled' && resTend.value.data) tendenciaMensual.value = resTend.value.data
    if (resCart.status === 'fulfilled' && resCart.value.data) carteraResumen.value = resCart.value.data
    if (resRad.status === 'fulfilled' && resRad.value.data) radicacionData.value = resRad.value.data

    if (resSem.status === 'fulfilled' && resSem.value.data) {
      semanaRaw.value = resSem.value.data.semana || []
      semanaTotal.value = resSem.value.data.total_semana || 0
      semanaFacturas.value = resSem.value.data.facturas_semana || 0
    }

    if (resMes.status === 'fulfilled' && resMes.value.data) {
      mesActualRaw.value = resMes.value.data.dias || []
      mesActualNombre.value = resMes.value.data.mes_nombre || 'Mes Actual'
      mesActualTotal.value = resMes.value.data.total_mes || 0
      mesActualFacturas.value = resMes.value.data.facturas_mes || 0
    }

    if (resCxpRes.status === 'fulfilled' && resCxpRes.value.data) cxpResumen.value = resCxpRes.value.data
    if (resCxpSem.status === 'fulfilled' && resCxpSem.value.data) cxpSemana.value = resCxpSem.value.data
    if (resCxpMes.status === 'fulfilled' && resCxpMes.value.data) cxpMes.value = resCxpMes.value.data
    if (resCxpAnio.status === 'fulfilled' && resCxpAnio.value.data) cxpAnual.value = resCxpAnio.value.data

  } catch (err) {
    console.error('Error cargando indicadores reales:', err)
  }
}

onMounted(() => {
  cargarEmpresa()
  cargarDatosReales()
})
</script>

<style scoped>
/* 1. Barra Institucional Compacta */
.barra-institucional {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  background: #ffffff;
  border: 1px solid #dce4ec;
  border-left: 4px solid #0072CE;
  border-radius: 8px;
  padding: 8px 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.barra-institucional__left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.barra-logo {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid #dce4ec;
  background: #fff;
}

.barra-titulo {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.barra-titulo strong {
  color: #0b3b60;
  font-size: 15px;
}

.barra-slogan {
  color: #d97706;
  font-size: 11.5px;
  font-weight: 600;
}

.barra-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 10.5px;
  margin-top: 1px;
}

.barra-sub .separador {
  color: #cbd5e1;
}

.barra-institucional__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.barra-vigencia {
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
}

/* 2. KPIs Ejecutivos Principales en 5 Columnas */
.vi-kpis--5 {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

@media (max-width: 1100px) {
  .vi-kpis--5 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .vi-kpis--5 {
    grid-template-columns: 1fr;
  }
}

.vi-kpi--link {
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.vi-kpi--link:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
  border-color: #0072CE;
}

/* 3. Estilos de Secciones Expandibles */
.vi-expand-wrapper {
  transition: all 0.2s ease;
}

.vi-expand-header {
  background: #ffffff;
  border: 1px solid #dce4ec;
  border-radius: 8px;
  padding: 10px 14px;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.vi-expand-header:hover {
  border-color: #0072CE;
  background: #fbfdff;
}

.vi-expand-header.is-open {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom-color: #cbd5e1;
  background: #f0f7ff;
}

.vi-expand-body {
  background: #f8fafc;
  border: 1px solid #dce4ec;
  border-top: none;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  padding: 12px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.03);
}

/* Fila Inferior */
.vi-grid-inferior {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}

@media (max-width: 900px) {
  .vi-grid-inferior {
    grid-template-columns: 1fr;
  }
}

.modulos-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.modulo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.15s ease;
}

.modulo-item:hover {
  background: #fff;
  border-color: #0072CE;
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.modulo-item strong {
  display: block;
  color: #0b3b60;
  font-size: 12.5px;
  font-weight: 700;
}

.modulo-item p {
  margin: 1px 0 0;
  color: #64748b;
  font-size: 11px;
}
</style>
