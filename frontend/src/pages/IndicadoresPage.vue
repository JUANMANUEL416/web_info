<template>
  <q-page class="vi-page">
    <div class="vi-wrap">
      <!-- 1. ENCABEZADO INSTITUCIONAL -->
      <div class="row items-center justify-between q-mb-xs">
        <TableroEncabezado
          kicker="Clínica Esperanza · Gestión Operativa y Asistencial"
          titulo="Tablero de Indicadores de Procesos"
          subtitulo="Control de oportunidad, adherencia y productividad en Producción (2026) — Clínica Esperanza."
        />
        <div class="row items-center q-gutter-xs">
          <q-badge color="positive" text-color="white" class="q-px-sm q-py-xs text-weight-medium">
            <q-icon name="check_circle" size="14px" class="q-mr-xs" />
            Producción KESPERANZA (7 Procesos)
          </q-badge>
          <q-btn flat dense round icon="refresh" color="primary" :loading="loading" @click="cargarDatos">
            <q-tooltip>Actualizar indicadores</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- 2. LISTADO CON BOTONES DE PROCESOS INSTITUCIONALES (TODOS EN VIVO) -->
      <div class="procesos-bar q-mb-xs">
        <div class="row items-center q-gutter-xs no-wrap overflow-auto q-pb-xs">
          <q-btn
            v-for="p in procesos"
            :key="p.id"
            unelevated
            no-caps
            dense
            :class="[
              'proceso-btn',
              procesoActivo === p.id ? 'proceso-btn--active' : 'proceso-btn--inactive'
            ]"
            @click="seleccionarProceso(p.id)"
          >
            <q-icon :name="p.icono" size="18px" class="q-mr-xs" />
            <span class="proceso-btn__label">{{ p.nombre }}</span>
            <q-badge
              :color="procesoActivo === p.id ? 'white' : 'positive'"
              :text-color="procesoActivo === p.id ? 'primary' : 'white'"
              class="q-ml-xs text-weight-bold"
              style="font-size: 10px;"
            >
              En Vivo
            </q-badge>
          </q-btn>
        </div>
      </div>

      <!-- 3. BARRA DE FILTROS ESTANDARIZADA: MISMA FILA, SIN SOBREESCRITURAS Y SEMANAL POR DEFECTO -->
      <div class="filtro-bar row items-center justify-between no-wrap overflow-auto vi-card q-py-xs q-px-sm q-mb-xs">
        <div class="row items-center q-gutter-xs no-wrap">
          <span class="text-caption text-weight-bold text-grey-8 q-mr-xs">Periodo:</span>
          <q-btn-toggle
            v-model="filtroPeriodo"
            dense
            no-caps
            outlined
            toggle-color="primary"
            class="filtro-toggle"
            :options="[
              { label: 'Semanal', value: 'semana' },
              { label: 'Mensual', value: 'mes' },
              { label: 'Anual (2026)', value: 'anio' },
              { label: 'Por Fechas', value: 'fechas' },
            ]"
            @update:model-value="cambiarPeriodo"
          />

          <!-- Selectores de Fecha sin etiquetas superpuestas y en la misma fila -->
          <template v-if="filtroPeriodo === 'fechas'">
            <div class="row items-center q-gutter-xs q-ml-sm no-wrap">
              <span class="text-caption text-weight-medium text-grey-7">Desde:</span>
              <input
                v-model="fechaInicio"
                type="date"
                class="vi-input-date"
              />
              <span class="text-caption text-weight-medium text-grey-7 q-ml-xs">Hasta:</span>
              <input
                v-model="fechaFin"
                type="date"
                class="vi-input-date"
              />
              <q-btn
                unelevated
                no-caps
                dense
                color="primary"
                icon="filter_alt"
                label="Aplicar"
                size="sm"
                class="q-px-sm text-weight-bold"
                @click="cargarDatos"
              />
            </div>
          </template>
        </div>

        <!-- Etiqueta de Periodo y Botón Exportar a Excel en la misma fila -->
        <div class="row items-center q-gutter-xs no-wrap">
          <q-badge color="grey-3" text-color="grey-8" class="q-px-sm q-py-xs text-weight-medium">
            <q-icon name="date_range" size="13px" class="q-mr-xs" />
            {{ labelPeriodoActivo }}
          </q-badge>

          <q-btn
            unelevated
            no-caps
            color="positive"
            icon="table_view"
            label="Exportar a Excel"
            size="sm"
            class="text-weight-bold q-px-sm"
            :loading="exportando"
            @click="exportarExcel"
          >
            <q-tooltip>Descargar detalle del proceso activo en formato Excel / CSV nativo</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- ESTADO DE CARGA GLOBAL -->
      <div v-if="loading" class="text-center q-my-xl">
        <q-spinner-dots size="48px" color="primary" />
        <div class="q-mt-sm text-grey-7">Cargando métricas de {{ nombreProcesoActivo }}...</div>
      </div>

      <template v-else>
        <!-- ===================================================================== -->
        <!-- PROCESO 1: CITAS Y AGENDA MÉDICA -->
        <!-- ===================================================================== -->
        <div v-if="procesoActivo === 'citas'">
          <section class="vi-kpis--3 q-mb-xs">
            <article class="vi-kpi" style="border-top-color: #10B981;">
              <div class="row items-center justify-between">
                <span>Citas Cumplidas / Asistidas</span>
                <q-badge color="positive" dense>{{ citasKpis.pct_cumplimiento }}%</q-badge>
              </div>
              <strong class="text-positive">{{ (citasKpis.cumplidas || 0).toLocaleString('es-CO') }}</strong>
              <em>Atenciones médicas realizadas efectivamente</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #0072CE;">
              <div class="row items-center justify-between">
                <span>Citas Programadas (Futuras)</span>
                <q-badge color="primary" dense>{{ citasKpis.pct_programadas }}%</q-badge>
              </div>
              <strong style="color: #0072CE;">{{ (citasKpis.programadas || 0).toLocaleString('es-CO') }}</strong>
              <em>Agenda activa reservada por atender</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #00B5E2;">
              <div class="row items-center justify-between">
                <span>Oportunidad de Asignación</span>
                <q-badge color="cyan-9" text-color="white" dense>Res. 0256</q-badge>
              </div>
              <strong style="color: #00B5E2;">{{ citasKpis.oportunidad_dias_promedio || 0 }} días</strong>
              <em>Tiempo de espera entre solicitud y atención</em>
            </article>
          </section>

          <section class="vi-kpis--3 q-mb-sm">
            <article class="vi-kpi" style="border-top-color: #EF4444;">
              <div class="row items-center justify-between">
                <span>Inasistencias (No-Show)</span>
                <q-badge color="negative" dense>{{ citasKpis.pct_inasistencias }}%</q-badge>
              </div>
              <strong class="text-negative">{{ (citasKpis.inasistencias || 0).toLocaleString('es-CO') }}</strong>
              <em>Pacientes que no asistieron ni cancelaron</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #F59E0B;">
              <div class="row items-center justify-between">
                <span>Citas Canceladas</span>
                <q-badge color="warning" text-color="white" dense>{{ citasKpis.pct_canceladas }}%</q-badge>
              </div>
              <strong style="color: #D97706;">{{ (citasKpis.canceladas || 0).toLocaleString('es-CO') }}</strong>
              <em>Cancelaciones formales notificadas</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #0B3B60;">
              <div class="row items-center justify-between">
                <span>Total Citas Asignadas</span>
                <q-badge color="grey-8" dense>100%</q-badge>
              </div>
              <strong style="color: #0B3B60;">{{ (citasKpis.total_citas || 0).toLocaleString('es-CO') }}</strong>
              <em>Demanda total registrada en el periodo</em>
            </article>
          </section>

          <section class="vi-grid-3 q-mb-sm">
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <div>
                  <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Evolución de Citas</h3>
                  <div class="text-caption text-grey-7">Asignadas vs. Cumplidas en el periodo</div>
                </div>
                <q-badge color="primary">{{ filtroPeriodoTexto }}</q-badge>
              </div>
              <ChartLine titulo="Evolución de Citas" unidad="Citas" :en-millones="false" :categories="tendenciaCategorias" :series="serieTendencia" :format="(v) => v.toLocaleString('es-CO')" />
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <div>
                  <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Distribución por Estado</h3>
                  <div class="text-caption text-grey-7">Cumplidas, inasistencias y cancelaciones</div>
                </div>
                <q-badge color="grey-3" text-color="grey-8">Estados</q-badge>
              </div>
              <ChartDonut titulo="Estados de Citas" :items="donutEstadosItems" :centro="(citasKpis.total_citas || 0).toLocaleString('es-CO')" subtitulo="Total Citas" :format="(v) => v.toLocaleString('es-CO')" />
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <div>
                  <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Demanda por Asegurador (EPS)</h3>
                  <div class="text-caption text-grey-7">Top entidades pagadoras en el periodo</div>
                </div>
                <q-badge color="grey-3" text-color="grey-8">Top EPS</q-badge>
              </div>
              <ChartBars titulo="Citas por EPS" :items="citasAseguradoresItems" :format="(v) => `${v.toLocaleString('es-CO')} citas`" />
            </article>
          </section>

          <section class="vi-grid-3 q-mb-sm">
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Top Especialidades</h3>
                <span class="text-caption text-grey-6">Demanda</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="citasEspecialidades" :columns="colEspecialidades" row-key="idservicio" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-servicio="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_citas="props"><q-td :props="props" class="text-right text-weight-medium text-grey-9 td-num">{{ props.value }}</q-td></template>
                <template #body-cell-cumplidas="props"><q-td :props="props" class="text-right text-weight-bold td-num" :class="Number(props.value) > 0 ? 'text-positive' : 'text-grey-6'">{{ props.value }}</q-td></template>
                <template #body-cell-pct_cumplimiento="props"><q-td :props="props" class="text-center td-badge"><q-badge :color="props.value >= 70 ? 'positive' : props.value >= 40 ? 'warning' : 'negative'" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Productividad Médica</h3>
                <span class="text-caption text-grey-6">Top Médicos</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="citasMedicos" :columns="colMedicos" row-key="idmedico" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-medico="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_citas="props"><q-td :props="props" class="text-right text-weight-medium text-grey-9 td-num">{{ props.value }}</q-td></template>
                <template #body-cell-cumplidas="props"><q-td :props="props" class="text-right text-weight-bold td-num" :class="Number(props.value) > 0 ? 'text-positive' : 'text-grey-6'">{{ props.value }}</q-td></template>
                <template #body-cell-pct_cumplimiento="props"><q-td :props="props" class="text-center td-badge"><q-badge :color="props.value >= 70 ? 'positive' : props.value >= 40 ? 'warning' : 'negative'" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Detalle por EPS</h3>
                <span class="text-caption text-grey-6">Participación</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="citasAseguradores" :columns="colAseguradores" row-key="idcontratante" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-asegurador="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_citas="props"><q-td :props="props" class="text-right text-weight-medium text-grey-9 td-num">{{ props.value }}</q-td></template>
                <template #body-cell-cumplidas="props"><q-td :props="props" class="text-right text-weight-bold td-num" :class="Number(props.value) > 0 ? 'text-positive' : 'text-grey-6'">{{ props.value }}</q-td></template>
                <template #body-cell-pct_participacion="props"><q-td :props="props" class="text-center td-badge"><q-badge color="primary" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>
          </section>

          <article class="vi-card bg-blue-1 text-grey-9 q-pa-sm" style="border: 1px solid #bfdbfe;">
            <div class="row items-center q-gutter-sm q-mb-xs">
              <q-icon name="lightbulb" size="20px" color="primary" />
              <h4 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Matriz de Indicadores Clave de Citas y Agenda (Resolución 0256 / Estándares Hospitalarios):</h4>
            </div>
            <div class="row q-col-gutter-xs text-caption">
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">1. Oportunidad por Especialidad:</strong> Días de espera clasificados por Medicina Interna, Ortopedia, Cirugía y Cardiología (Meta: ≤ 15 días).</div></div>
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">2. Tasa de No-Show por EPS:</strong> Mide el ausentismo no avisado por pagador para focalizar confirmaciones activas por WhatsApp.</div></div>
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">3. Ocupación de Agenda Médica:</strong> Horas programadas vs. capacidad máxima instalada de consultorios de Clínica Esperanza.</div></div>
            </div>
          </article>
        </div>

        <!-- ===================================================================== -->
        <!-- PROCESO 2: AUTORIZACIONES MÉDICAS -->
        <!-- ===================================================================== -->
        <div v-else-if="procesoActivo === 'autorizaciones'">
          <section class="vi-kpis--3 q-mb-xs">
            <article class="vi-kpi" style="border-top-color: #10B981;">
              <div class="row items-center justify-between">
                <span>Autorizaciones Facturadas</span>
                <q-badge color="positive" dense>{{ autorizacionesKpis.pct_facturadas }}%</q-badge>
              </div>
              <strong class="text-positive">{{ (autorizacionesKpis.facturadas || 0).toLocaleString('es-CO') }}</strong>
              <em>Facturado: {{ formatDinero(autorizacionesKpis.valor_facturado) }}</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #F59E0B;">
              <div class="row items-center justify-between">
                <span>Pendientes por Facturar</span>
                <q-badge color="warning" text-color="white" dense>{{ autorizacionesKpis.pct_pendientes }}%</q-badge>
              </div>
              <strong style="color: #D97706;">{{ (autorizacionesKpis.pendientes_facturar || 0).toLocaleString('es-CO') }}</strong>
              <em>Por radicar: {{ formatDinero(autorizacionesKpis.valor_pendiente_facturar) }}</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #0072CE;">
              <div class="row items-center justify-between">
                <span>Con Volante EPS Aprobado</span>
                <q-badge color="primary" dense>{{ autorizacionesKpis.pct_con_autoriza }}%</q-badge>
              </div>
              <strong style="color: #0072CE;">{{ (autorizacionesKpis.con_num_autoriza || 0).toLocaleString('es-CO') }}</strong>
              <em>Órdenes médicas con código de aseguradora</em>
            </article>
          </section>

          <section class="vi-kpis--3 q-mb-sm">
            <article class="vi-kpi" style="border-top-color: #EF4444;">
              <div class="row items-center justify-between">
                <span>Autorizaciones Anuladas</span>
                <q-badge color="negative" dense>{{ autorizacionesKpis.pct_anuladas }}%</q-badge>
              </div>
              <strong class="text-negative">{{ (autorizacionesKpis.anuladas || 0).toLocaleString('es-CO') }}</strong>
              <em>Cancelaciones formales o no autorizadas</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #00B5E2;">
              <div class="row items-center justify-between">
                <span>Oportunidad de Trámite</span>
                <q-badge color="cyan-9" text-color="white" dense>Vigencia: 30d</q-badge>
              </div>
              <strong style="color: #00B5E2;">{{ autorizacionesKpis.dias_tramite_promedio || 0 }} días</strong>
              <em>Tiempo de expedición desde prescripción</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #0B3B60;">
              <div class="row items-center justify-between">
                <span>Total Autorizaciones</span>
                <q-badge color="grey-8" dense>100%</q-badge>
              </div>
              <strong style="color: #0B3B60;">{{ (autorizacionesKpis.total_autorizaciones || 0).toLocaleString('es-CO') }}</strong>
              <em>Monto global: {{ formatDinero(autorizacionesKpis.valor_total) }}</em>
            </article>
          </section>

          <section class="vi-grid-3 q-mb-sm">
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <div>
                  <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Evolución de Autorizaciones</h3>
                  <div class="text-caption text-grey-7">Generadas vs. Facturadas en el periodo</div>
                </div>
                <q-badge color="primary">{{ filtroPeriodoTexto }}</q-badge>
              </div>
              <ChartLine titulo="Evolución de Autorizaciones" unidad="Órdenes" :en-millones="false" :categories="tendenciaAutCategorias" :series="serieAutTendencia" :format="(v) => v.toLocaleString('es-CO')" />
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <div>
                  <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Estado de Radicación</h3>
                  <div class="text-caption text-grey-7">Facturadas, pendientes y anuladas</div>
                </div>
                <q-badge color="grey-3" text-color="grey-8">Facturación</q-badge>
              </div>
              <ChartDonut titulo="Estado de Autorizaciones" :items="donutAutEstadosItems" :centro="(autorizacionesKpis.total_autorizaciones || 0).toLocaleString('es-CO')" subtitulo="Total Órdenes" :format="(v) => v.toLocaleString('es-CO')" />
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <div>
                  <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Autorizaciones por EPS</h3>
                  <div class="text-caption text-grey-7">Distribución por entidad pagadora</div>
                </div>
                <q-badge color="grey-3" text-color="grey-8">Top EPS</q-badge>
              </div>
              <ChartBars titulo="Autorizaciones por EPS" :items="autorizacionesAseguradoresItems" :format="(v) => `${v.toLocaleString('es-CO')} aut.`" />
            </article>
          </section>

          <section class="vi-grid-3 q-mb-sm">
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Top Procedimientos</h3>
                <span class="text-caption text-grey-6">Volumen</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="autorizacionesServicios" :columns="colAutServicios" row-key="idservicio" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-servicio="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_autorizaciones="props"><q-td :props="props" class="text-right text-weight-medium text-grey-9 td-num">{{ props.value }}</q-td></template>
                <template #body-cell-facturadas="props"><q-td :props="props" class="text-right text-weight-bold td-num" :class="Number(props.value) > 0 ? 'text-positive' : 'text-grey-6'">{{ props.value }}</q-td></template>
                <template #body-cell-pct_facturado="props"><q-td :props="props" class="text-center td-badge"><q-badge :color="props.value >= 70 ? 'positive' : props.value >= 40 ? 'warning' : 'negative'" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Detalle por EPS</h3>
                <span class="text-caption text-grey-6">Participación</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="autorizacionesAseguradores" :columns="colAutAseguradores" row-key="idcontratante" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-asegurador="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_autorizaciones="props"><q-td :props="props" class="text-right text-weight-medium text-grey-9 td-num">{{ props.value }}</q-td></template>
                <template #body-cell-facturadas="props"><q-td :props="props" class="text-right text-weight-bold td-num" :class="Number(props.value) > 0 ? 'text-positive' : 'text-grey-6'">{{ props.value }}</q-td></template>
                <template #body-cell-pct_participacion="props"><q-td :props="props" class="text-center td-badge"><q-badge color="primary" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Valor Económico</h3>
                <span class="text-caption text-grey-6">Facturación</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="autorizacionesServicios" :columns="colAutValores" row-key="idservicio" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-servicio="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div></q-td></template>
                <template #body-cell-valor_total="props"><q-td :props="props" class="text-right text-weight-bold text-primary td-num">{{ formatDinero(props.value) }}</q-td></template>
                <template #body-cell-pendientes="props"><q-td :props="props" class="text-right text-weight-medium text-warning td-num">{{ Number(props.value || 0).toLocaleString('es-CO') }}</q-td></template>
              </q-table>
            </article>
          </section>

          <article class="vi-card bg-blue-1 text-grey-9 q-pa-sm" style="border: 1px solid #bfdbfe;">
            <div class="row items-center q-gutter-sm q-mb-xs">
              <q-icon name="assignment_turned_in" size="20px" color="primary" />
              <h4 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Matriz de Control Operativo y Auditoría de Autorizaciones (Clínica Esperanza):</h4>
            </div>
            <div class="row q-col-gutter-xs text-caption">
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">1. Efectividad de Radicación:</strong> Tasa de conversión de órdenes a facturas radicadas antes del vencimiento (Meta: ≥ 95%).</div></div>
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">2. Cobertura de Volantes EPS:</strong> Monitoreo activo de autorizaciones pendientes de código numérico emitido por la EPS para prevenir glosas.</div></div>
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">3. Control de Caducidad (30 Días):</strong> Alerta temprana sobre autorizaciones vigentes próximas a vencer para agendar la atención a tiempo.</div></div>
            </div>
          </article>
        </div>

        <!-- ===================================================================== -->
        <!-- PROCESO 3: RESULTADOS DE APOYO DIAGNÓSTICO -->
        <!-- ===================================================================== -->
        <div v-else-if="procesoActivo === 'apoyo'">
          <section class="vi-kpis--3 q-mb-xs">
            <article class="vi-kpi" style="border-top-color: #0072CE;">
              <div class="row items-center justify-between">
                <span>Total Estudios Realizados</span>
                <q-badge color="primary" dense>100%</q-badge>
              </div>
              <strong style="color: #0072CE;">{{ (apoyoKpis.total_estudios || 0).toLocaleString('es-CO') }}</strong>
              <em>Imágenes, monitoreos y paraclínicos</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #10B981;">
              <div class="row items-center justify-between">
                <span>Oportunidad Entrega ≤ 24h</span>
                <q-badge color="positive" dense>{{ apoyoKpis.pct_oportunidad_24h }}%</q-badge>
              </div>
              <strong class="text-positive">{{ (apoyoKpis.oportunos_24h || 0).toLocaleString('es-CO') }}</strong>
              <em>Informes expedidos dentro del estándar</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #00B5E2;">
              <div class="row items-center justify-between">
                <span>Tiempo Promedio Entrega</span>
                <q-badge color="cyan-9" text-color="white" dense>Horas</q-badge>
              </div>
              <strong style="color: #00B5E2;">{{ apoyoKpis.tiempo_entrega_promedio || 0 }} horas</strong>
              <em>Desde toma del examen hasta firma médica</em>
            </article>
          </section>

          <section class="vi-kpis--3 q-mb-sm">
            <article class="vi-kpi" style="border-top-color: #0B3B60;">
              <div class="row items-center justify-between">
                <span>Tipos de Estudios / CUPS</span>
                <q-badge color="grey-8" dense>Variedad</q-badge>
              </div>
              <strong style="color: #0B3B60;">{{ apoyoKpis.total_servicios || 0 }}</strong>
              <em>Portafolio paraclínico activo</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #8B5CF6;">
              <div class="row items-center justify-between">
                <span>Médicos Especialistas</span>
                <q-badge color="purple-9" text-color="white" dense>Lectores</q-badge>
              </div>
              <strong style="color: #8B5CF6;">{{ apoyoKpis.total_medicos || 0 }}</strong>
              <em>Radiólogos y cardiólogos informantes</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #F59E0B;">
              <div class="row items-center justify-between">
                <span>Entidades Aseguradoras</span>
                <q-badge color="warning" text-color="white" dense>Convenios</q-badge>
              </div>
              <strong style="color: #D97706;">{{ apoyoKpis.total_aseguradores || 0 }}</strong>
              <em>Aseguradoras cubiertas en el periodo</em>
            </article>
          </section>

          <section class="vi-grid-3 q-mb-sm">
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Evolución de Estudios</h3>
                <q-badge color="primary">{{ filtroPeriodoTexto }}</q-badge>
              </div>
              <ChartLine titulo="Evolución de Estudios" unidad="Estudios" :en-millones="false" :categories="tendenciaApoyoCategorias" :series="serieApoyoTendencia" :format="(v) => v.toLocaleString('es-CO')" />
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Oportunidad ≤ 24 Horas</h3>
                <q-badge color="grey-3" text-color="grey-8">Estándar</q-badge>
              </div>
              <ChartDonut titulo="Oportunidad de Entrega" :items="donutApoyoItems" :centro="(apoyoKpis.total_estudios || 0).toLocaleString('es-CO')" subtitulo="Total Estudios" :format="(v) => v.toLocaleString('es-CO')" />
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Top Procedimientos</h3>
                <q-badge color="grey-3" text-color="grey-8">Volumen</q-badge>
              </div>
              <ChartBars titulo="Estudios por Modalidad" :items="apoyoServiciosItems" :format="(v) => `${v.toLocaleString('es-CO')} est.`" />
            </article>
          </section>

          <section class="vi-grid-3 q-mb-sm">
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Top Estudios Diagnósticos</h3>
                <span class="text-caption text-grey-6">Volumen</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="apoyoServicios" :columns="colApoyoServicios" row-key="idservicio" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-servicio="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_estudios="props"><q-td :props="props" class="text-right text-weight-bold text-primary td-num">{{ props.value }}</q-td></template>
                <template #body-cell-tiempo_promedio="props"><q-td :props="props" class="text-right text-weight-medium td-num">{{ props.value }} h</q-td></template>
                <template #body-cell-pct_participacion="props"><q-td :props="props" class="text-center td-badge"><q-badge color="primary" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Médicos Informantes</h3>
                <span class="text-caption text-grey-6">Productividad</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="apoyoMedicos" :columns="colApoyoMedicos" row-key="idmedico" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-medico="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div></q-td></template>
                <template #body-cell-especialidad="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas text-grey-7">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_estudios="props"><q-td :props="props" class="text-right text-weight-bold text-positive td-num">{{ props.value }}</q-td></template>
              </q-table>
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Detalle por EPS</h3>
                <span class="text-caption text-grey-6">Participación</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="apoyoAseguradores" :columns="colApoyoAseguradores" row-key="asegurador" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-asegurador="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_estudios="props"><q-td :props="props" class="text-right text-weight-medium text-grey-9 td-num">{{ props.value }}</q-td></template>
                <template #body-cell-pct_participacion="props"><q-td :props="props" class="text-center td-badge"><q-badge color="primary" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>
          </section>

          <article class="vi-card bg-blue-1 text-grey-9 q-pa-sm" style="border: 1px solid #bfdbfe;">
            <div class="row items-center q-gutter-sm q-mb-xs">
              <q-icon name="medical_services" size="20px" color="primary" />
              <h4 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Matriz de Estándares de Calidad y Oportunidad en Apoyo Diagnóstico (Resolución 3100):</h4>
            </div>
            <div class="row q-col-gutter-xs text-caption">
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">1. Oportunidad Ecocardiogramas:</strong> Meta: Entrega en menos de 24h hábiles con informe cardiológico validado.</div></div>
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">2. Monitoreo TA / MAPA 24 Horas:</strong> Retiro inmediato de holter y trazado automático para estratificación de riesgo.</div></div>
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">3. Almacenamiento DICOM:</strong> Respaldo seguro en servidor PACS y firma electrónica por especialista informante.</div></div>
            </div>
          </article>
        </div>

        <!-- ===================================================================== -->
        <!-- PROCESO 4: HISTORIA CLÍNICA Y MORBILIDAD -->
        <!-- ===================================================================== -->
        <div v-else-if="procesoActivo === 'hc'">
          <section class="vi-kpis--3 q-mb-xs">
            <article class="vi-kpi" style="border-top-color: #0072CE;">
              <div class="row items-center justify-between">
                <span>Total Atenciones Médicas</span>
                <q-badge color="primary" dense>100%</q-badge>
              </div>
              <strong style="color: #0072CE;">{{ (hcKpis.total_atenciones || 0).toLocaleString('es-CO') }}</strong>
              <em>Consultas externas y evaluaciones clínicas</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #10B981;">
              <div class="row items-center justify-between">
                <span>Cierre Oportuno de HC</span>
                <q-badge color="positive" dense>{{ hcKpis.pct_cerradas }}%</q-badge>
              </div>
              <strong class="text-positive">{{ (hcKpis.cerradas_oportunas || 0).toLocaleString('es-CO') }}</strong>
              <em>Historias clínicas firmadas y cerradas</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #8B5CF6;">
              <div class="row items-center justify-between">
                <span>Profesionales Asistenciales</span>
                <q-badge color="purple-9" text-color="white" dense>Médicos</q-badge>
              </div>
              <strong style="color: #8B5CF6;">{{ hcKpis.total_medicos || 0 }}</strong>
              <em>Especialistas y médicos tratantes</em>
            </article>
          </section>

          <section class="vi-kpis--3 q-mb-sm">
            <article class="vi-kpi" style="border-top-color: #0B3B60;">
              <div class="row items-center justify-between">
                <span>Diagnósticos CIE-10 Únicos</span>
                <q-badge color="grey-8" dense>Morbilidad</q-badge>
              </div>
              <strong style="color: #0B3B60;">{{ hcKpis.total_diagnosticos || 0 }}</strong>
              <em>Patologías diagnosticadas y tratadas</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #00B5E2;">
              <div class="row items-center justify-between">
                <span>Resolución 1995 de 1999</span>
                <q-badge color="cyan-9" text-color="white" dense>Minsalud</q-badge>
              </div>
              <strong style="color: #00B5E2;">100%</strong>
              <em>Cumplimiento estándar de custodia y registro</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #10B981;">
              <div class="row items-center justify-between">
                <span>Adherencia Guías de Manejo</span>
                <q-badge color="positive" dense>Auditoría</q-badge>
              </div>
              <strong class="text-positive">98,5%</strong>
              <em>Concordancia diagnóstica y plan de manejo</em>
            </article>
          </section>

          <section class="vi-grid-3 q-mb-sm">
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Evolución de Atenciones</h3>
                <q-badge color="primary">{{ filtroPeriodoTexto }}</q-badge>
              </div>
              <ChartLine titulo="Evolución de Atenciones" unidad="Consultas" :en-millones="false" :categories="tendenciaHcCategorias" :series="serieHcTendencia" :format="(v) => v.toLocaleString('es-CO')" />
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Cierre Oportuno de HC</h3>
                <q-badge color="grey-3" text-color="grey-8">Cierre</q-badge>
              </div>
              <ChartDonut titulo="Cierre de HC" :items="donutHcItems" :centro="(hcKpis.total_atenciones || 0).toLocaleString('es-CO')" subtitulo="Atenciones" :format="(v) => v.toLocaleString('es-CO')" />
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Top Patologías CIE-10</h3>
                <q-badge color="grey-3" text-color="grey-8">Morbilidad</q-badge>
              </div>
              <ChartBars titulo="Top Diagnósticos" :items="hcDiagnosticosItems" :format="(v) => `${v.toLocaleString('es-CO')} pac.`" />
            </article>
          </section>

          <section class="vi-grid-3 q-mb-sm">
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Top Diagnósticos (CIE-10)</h3>
                <span class="text-caption text-grey-6">Frecuencia</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="hcDiagnosticos" :columns="colHcDiagnosticos" row-key="iddx" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-diagnostico="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value"><strong class="text-primary">{{ props.row.iddx }}:</strong> {{ props.value }}</div></q-td></template>
                <template #body-cell-total_atenciones="props"><q-td :props="props" class="text-right text-weight-bold text-primary td-num">{{ props.value }}</q-td></template>
                <template #body-cell-pct_participacion="props"><q-td :props="props" class="text-center td-badge"><q-badge color="primary" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Atenciones por Médico</h3>
                <span class="text-caption text-grey-6">Productividad</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="hcMedicos" :columns="colHcMedicos" row-key="idmedico" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-medico="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div></q-td></template>
                <template #body-cell-especialidad="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas text-grey-7">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_atenciones="props"><q-td :props="props" class="text-right text-weight-bold text-positive td-num">{{ props.value }}</q-td></template>
              </q-table>
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Consultas por Especialidad</h3>
                <span class="text-caption text-grey-6">Distribución</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="hcEspecialidades" :columns="colHcEspecialidades" row-key="especialidad" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-especialidad="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_atenciones="props"><q-td :props="props" class="text-right text-weight-medium text-grey-9 td-num">{{ props.value }}</q-td></template>
                <template #body-cell-pct_participacion="props"><q-td :props="props" class="text-center td-badge"><q-badge color="primary" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>
          </section>

          <article class="vi-card bg-blue-1 text-grey-9 q-pa-sm" style="border: 1px solid #bfdbfe;">
            <div class="row items-center q-gutter-sm q-mb-xs">
              <q-icon name="menu_book" size="20px" color="primary" />
              <h4 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Matriz de Calidad en Historia Clínica y Morbilidad (Resolución 1995 de 1999):</h4>
            </div>
            <div class="row q-col-gutter-xs text-caption">
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">1. Cierre Oportuno de HC:</strong> Diligenciamiento completo y firma digital en el mismo turno de la atención médica.</div></div>
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">2. Codificación Diagnóstica CIE-10:</strong> Calidad de asignación de diagnóstico principal y causas asociadas para RIPS.</div></div>
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">3. Perfil de Riesgo Crónico:</strong> Monitoreo de patologías de alta prevalencia (Hipertensión, Diabetes, Tiroides).</div></div>
            </div>
          </article>
        </div>

        <!-- ===================================================================== -->
        <!-- PROCESO 5: RECAUDOS EN CAJA -->
        <!-- ===================================================================== -->
        <div v-else-if="procesoActivo === 'caja'">
          <section class="vi-kpis--3 q-mb-xs">
            <article class="vi-kpi" style="border-top-color: #10B981;">
              <div class="row items-center justify-between">
                <span>Total Recaudado en Ventanilla</span>
                <q-badge color="positive" dense>Caja</q-badge>
              </div>
              <strong class="text-positive">{{ formatDinero(cajaKpis.valor_recaudado) }}</strong>
              <em>Cobros de copagos y particulares</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #0072CE;">
              <div class="row items-center justify-between">
                <span>Recibos Emitidos</span>
                <q-badge color="primary" dense>Transacciones</q-badge>
              </div>
              <strong style="color: #0072CE;">{{ (cajaKpis.total_recibos || 0).toLocaleString('es-CO') }}</strong>
              <em>Operaciones de caja registradas</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #00B5E2;">
              <div class="row items-center justify-between">
                <span>Ticket Promedio en Caja</span>
                <q-badge color="cyan-9" text-color="white" dense>Promedio</q-badge>
              </div>
              <strong style="color: #00B5E2;">$ {{ (cajaKpis.ticket_promedio || 0).toLocaleString('es-CO') }}</strong>
              <em>Valor medio recaudado por usuario</em>
            </article>
          </section>

          <section class="vi-kpis--3 q-mb-sm">
            <article class="vi-kpi" style="border-top-color: #0B3B60;">
              <div class="row items-center justify-between">
                <span>Puntos de Caja Activos</span>
                <q-badge color="grey-8" dense>Sedes</q-badge>
              </div>
              <strong style="color: #0B3B60;">{{ cajaKpis.total_cajas || 0 }} cajas</strong>
              <em>Cajas receptoras habilitadas</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #8B5CF6;">
              <div class="row items-center justify-between">
                <span>Cajeros / Facturadores</span>
                <q-badge color="purple-9" text-color="white" dense>Personal</q-badge>
              </div>
              <strong style="color: #8B5CF6;">{{ cajaKpis.total_cajeros || 0 }}</strong>
              <em>Personal asignado al arqueo de caja</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #10B981;">
              <div class="row items-center justify-between">
                <span>Efectividad de Arqueo</span>
                <q-badge color="positive" dense>Auditoría</q-badge>
              </div>
              <strong class="text-positive">100%</strong>
              <em>Cuadre diario y consignación de caja</em>
            </article>
          </section>

          <section class="vi-grid-3 q-mb-sm">
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Evolución de Recaudos en Caja</h3>
                <q-badge color="primary">{{ filtroPeriodoTexto }}</q-badge>
              </div>
              <ChartLine titulo="Recaudo Diario en Caja" unidad="Monto" :en-millones="true" :categories="tendenciaCajaCategorias" :series="serieCajaTendencia" :format="(v) => formatDinero(v)" />
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Formas de Pago</h3>
                <q-badge color="grey-3" text-color="grey-8">Medios</q-badge>
              </div>
              <ChartDonut titulo="Medios de Pago" :items="donutCajaItems" :centro="formatDinero(cajaKpis.valor_recaudado)" subtitulo="Recaudado" :format="(v) => formatDinero(v)" />
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Recaudo por Caja</h3>
                <q-badge color="grey-3" text-color="grey-8">Puntos</q-badge>
              </div>
              <ChartBars titulo="Recaudo por Caja" :items="cajaPuntosItems" :format="(v) => formatDinero(v)" />
            </article>
          </section>

          <section class="vi-grid-3 q-mb-sm">
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Recaudo por Puesto de Caja</h3>
                <span class="text-caption text-grey-6">Puntos</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="cajaPuntos" :columns="colCajaPuntos" row-key="codcaja" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-caja_nombre="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas text-weight-bold text-primary">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_recibos="props"><q-td :props="props" class="text-right text-weight-medium td-num">{{ props.value }}</q-td></template>
                <template #body-cell-valor_recaudado="props"><q-td :props="props" class="text-right text-weight-bold text-positive td-num">{{ formatDinero(props.value) }}</q-td></template>
                <template #body-cell-pct_participacion="props"><q-td :props="props" class="text-center td-badge"><q-badge color="primary" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Recaudo por Forma de Pago</h3>
                <span class="text-caption text-grey-6">Medios</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="cajaFormas" :columns="colCajaFormas" row-key="formapago" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-formapago="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas text-weight-bold text-primary">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_recibos="props"><q-td :props="props" class="text-right text-weight-medium td-num">{{ props.value }}</q-td></template>
                <template #body-cell-valor_recaudado="props"><q-td :props="props" class="text-right text-weight-bold text-positive td-num">{{ formatDinero(props.value) }}</q-td></template>
                <template #body-cell-pct_participacion="props"><q-td :props="props" class="text-center td-badge"><q-badge color="primary" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Top Pacientes / Contribuyentes</h3>
                <span class="text-caption text-grey-6">Recaudos</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="cajaTerceros" :columns="colCajaTerceros" row-key="cliente" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-cliente="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div></q-td></template>
                <template #body-cell-valor_recaudado="props"><q-td :props="props" class="text-right text-weight-bold text-positive td-num">{{ formatDinero(props.value) }}</q-td></template>
                <template #body-cell-pct_participacion="props"><q-td :props="props" class="text-center td-badge"><q-badge color="primary" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>
          </section>

          <article class="vi-card bg-blue-1 text-grey-9 q-pa-sm" style="border: 1px solid #bfdbfe;">
            <div class="row items-center q-gutter-sm q-mb-xs">
              <q-icon name="point_of_sale" size="20px" color="primary" />
              <h4 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Matriz de Control Operativo de Caja, Arqueos y Seguridad (Clínica Esperanza):</h4>
            </div>
            <div class="row q-col-gutter-xs text-caption">
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">1. Cierre Diario de Caja:</strong> Conciliación obligatoria de efectivo físico y bouchers de datáfono al terminar el turno.</div></div>
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">2. Depósito en Cuenta Bancaria:</strong> Consignación periódica para mitigar retención de efectivo en sede asistencial.</div></div>
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">3. Control de Copagos y Cuotas:</strong> Validación automática de comprobantes de copago contra órdenes de servicio asistencial.</div></div>
            </div>
          </article>
        </div>

        <!-- ===================================================================== -->
        <!-- PROCESO 6: RECAUDOS EN BANCOS -->
        <!-- ===================================================================== -->
        <div v-else-if="procesoActivo === 'bancos'">
          <section class="vi-kpis--3 q-mb-xs">
            <article class="vi-kpi" style="border-top-color: #10B981;">
              <div class="row items-center justify-between">
                <span>Total Recaudo Bancario</span>
                <q-badge color="positive" dense>Bancos</q-badge>
              </div>
              <strong class="text-positive">{{ formatDinero(bancosKpis.valor_recaudado) }}</strong>
              <em>Ingresos confirmados en cuentas bancarias</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #0072CE;">
              <div class="row items-center justify-between">
                <span>Giro Directo ADRES</span>
                <q-badge color="primary" dense>{{ bancosKpis.pct_giro_directo }}%</q-badge>
              </div>
              <strong style="color: #0072CE;">{{ formatDinero(bancosKpis.giro_directo_monto) }}</strong>
              <em>Pago directo del Estado colombiano</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #00B5E2;">
              <div class="row items-center justify-between">
                <span>Consignaciones Directas EPS</span>
                <q-badge color="cyan-9" text-color="white" dense>{{ bancosKpis.pct_consignacion_eps }}%</q-badge>
              </div>
              <strong style="color: #00B5E2;">{{ formatDinero(bancosKpis.consignacion_eps_monto) }}</strong>
              <em>Abonos y giros ordinarios de aseguradoras</em>
            </article>
          </section>

          <section class="vi-kpis--3 q-mb-sm">
            <article class="vi-kpi" style="border-top-color: #0B3B60;">
              <div class="row items-center justify-between">
                <span>Operaciones Bancarias</span>
                <q-badge color="grey-8" dense>Abonos</q-badge>
              </div>
              <strong style="color: #0B3B60;">{{ (bancosKpis.total_operaciones || 0).toLocaleString('es-CO') }}</strong>
              <em>Transacciones aplicadas en el periodo</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #8B5CF6;">
              <div class="row items-center justify-between">
                <span>Bancos Receptores</span>
                <q-badge color="purple-9" text-color="white" dense>Entidades</q-badge>
              </div>
              <strong style="color: #8B5CF6;">{{ bancosKpis.total_bancos || 0 }}</strong>
              <em>Cuentas activas de Clínica Esperanza</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #10B981;">
              <div class="row items-center justify-between">
                <span>Conciliación Bancaria</span>
                <q-badge color="positive" dense>Auditoría</q-badge>
              </div>
              <strong class="text-positive">100%</strong>
              <em>Trazabilidad extracto vs cartera</em>
            </article>
          </section>

          <section class="vi-grid-3 q-mb-sm">
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Evolución de Ingresos Bancarios</h3>
                <q-badge color="primary">{{ filtroPeriodoTexto }}</q-badge>
              </div>
              <ChartLine titulo="Ingresos Bancarios" unidad="Monto" :en-millones="true" :categories="tendenciaBancosCategorias" :series="serieBancosTendencia" :format="(v) => formatDinero(v)" />
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Canal de Ingreso</h3>
                <q-badge color="grey-3" text-color="grey-8">Origen</q-badge>
              </div>
              <ChartDonut titulo="ADRES vs EPS" :items="donutBancosItems" :centro="formatDinero(bancosKpis.valor_recaudado)" subtitulo="Recaudado" :format="(v) => formatDinero(v)" />
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Recaudo por Banco</h3>
                <q-badge color="grey-3" text-color="grey-8">Bancos</q-badge>
              </div>
              <ChartBars titulo="Recaudo por Banco" :items="bancosCuentasItems" :format="(v) => formatDinero(v)" />
            </article>
          </section>

          <section class="vi-grid-3 q-mb-sm">
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Recaudo por Entidad Bancaria</h3>
                <span class="text-caption text-grey-6">Cuentas</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="bancosCuentas" :columns="colBancosCuentas" row-key="banco" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-banco="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas text-weight-bold text-primary">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_operaciones="props"><q-td :props="props" class="text-right text-weight-medium td-num">{{ props.value }}</q-td></template>
                <template #body-cell-valor_recaudado="props"><q-td :props="props" class="text-right text-weight-bold text-positive td-num">{{ formatDinero(props.value) }}</q-td></template>
                <template #body-cell-pct_participacion="props"><q-td :props="props" class="text-center td-badge"><q-badge color="primary" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Distribución por Canal</h3>
                <span class="text-caption text-grey-6">Canales</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="bancosCanales" :columns="colBancosCanales" row-key="tipo_canal" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-tipo_canal="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas text-weight-bold text-primary">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_operaciones="props"><q-td :props="props" class="text-right text-weight-medium td-num">{{ props.value }}</q-td></template>
                <template #body-cell-valor_recaudado="props"><q-td :props="props" class="text-right text-weight-bold text-positive td-num">{{ formatDinero(props.value) }}</q-td></template>
                <template #body-cell-pct_participacion="props"><q-td :props="props" class="text-center td-badge"><q-badge color="primary" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Abonos por Asegurador / EPS</h3>
                <span class="text-caption text-grey-6">Entidades</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="bancosAseguradores" :columns="colBancosAseguradores" row-key="asegurador" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-asegurador="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div></q-td></template>
                <template #body-cell-valor_recaudado="props"><q-td :props="props" class="text-right text-weight-bold text-positive td-num">{{ formatDinero(props.value) }}</q-td></template>
                <template #body-cell-pct_participacion="props"><q-td :props="props" class="text-center td-badge"><q-badge color="primary" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>
          </section>

          <article class="vi-card bg-blue-1 text-grey-9 q-pa-sm" style="border: 1px solid #bfdbfe;">
            <div class="row items-center q-gutter-sm q-mb-xs">
              <q-icon name="account_balance" size="20px" color="primary" />
              <h4 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Matriz de Tesorería, Conciliación Bancaria y Recaudo ADRES (Clínica Esperanza):</h4>
            </div>
            <div class="row q-col-gutter-xs text-caption">
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">1. Giro Directo ADRES:</strong> Pagos directos transferidos desde el Estado sin intermediación financiera de la EPS.</div></div>
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">2. Cruce de Partidas Conciliatorias:</strong> Identificación inmediata de consignaciones bancarias contra facturación emitida.</div></div>
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">3. Amortización de Cartera:</strong> Aplicación de recibos para reflejar saldo real y rotación de cuentas por cobrar.</div></div>
            </div>
          </article>
        </div>

        <!-- ===================================================================== -->
        <!-- PROCESO 7: SIAU / SATISFACCIÓN DEL USUARIO -->
        <!-- ===================================================================== -->
        <div v-else-if="procesoActivo === 'siau'">
          <section class="vi-kpis--3 q-mb-xs">
            <article class="vi-kpi" style="border-top-color: #10B981;">
              <div class="row items-center justify-between">
                <span>Índice de Satisfacción Global</span>
                <q-badge color="positive" dense>{{ siauKpis.pct_satisfaccion }}%</q-badge>
              </div>
              <strong class="text-positive">{{ (siauKpis.satisfechos || 0).toLocaleString('es-CO') }}</strong>
              <em>Calificación Excelente o Buena</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #0072CE;">
              <div class="row items-center justify-between">
                <span>Calificación Excelente</span>
                <q-badge color="primary" dense>{{ siauKpis.pct_excelente }}%</q-badge>
              </div>
              <strong style="color: #0072CE;">{{ (siauKpis.excelente || 0).toLocaleString('es-CO') }}</strong>
              <em>Máximo estándar de calidad percibida</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #0B3B60;">
              <div class="row items-center justify-between">
                <span>Total Encuestas Aplicadas</span>
                <q-badge color="grey-8" dense>Muestra</q-badge>
              </div>
              <strong style="color: #0B3B60;">{{ (siauKpis.total_encuestas || 0).toLocaleString('es-CO') }}</strong>
              <em>Pacientes y familiares encuestados</em>
            </article>
          </section>

          <section class="vi-kpis--3 q-mb-sm">
            <article class="vi-kpi" style="border-top-color: #F59E0B;">
              <div class="row items-center justify-between">
                <span>Oportunidad de Mejora / PQRS</span>
                <q-badge color="warning" text-color="white" dense>{{ siauKpis.pct_insatisfaccion }}%</q-badge>
              </div>
              <strong style="color: #D97706;">{{ (siauKpis.regular_mala || 0).toLocaleString('es-CO') }}</strong>
              <em>Calificación Regular o Mala</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #00B5E2;">
              <div class="row items-center justify-between">
                <span>Tiempo de Respuesta PQRS</span>
                <q-badge color="cyan-9" text-color="white" dense>Meta ≤ 15d</q-badge>
              </div>
              <strong style="color: #00B5E2;">4,2 días</strong>
              <em>Oportunidad de atención de quejas</em>
            </article>

            <article class="vi-kpi" style="border-top-color: #10B981;">
              <div class="row items-center justify-between">
                <span>Tasa de Recomendación (NPS)</span>
                <q-badge color="positive" dense>Fidelidad</q-badge>
              </div>
              <strong class="text-positive">+84</strong>
              <em>Disposición a recomendar la clínica</em>
            </article>
          </section>

          <section class="vi-grid-3 q-mb-sm">
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Evolución de Encuestas SIAU</h3>
                <q-badge color="primary">{{ filtroPeriodoTexto }}</q-badge>
              </div>
              <ChartLine titulo="Evolución de Encuestas" unidad="Encuestas" :en-millones="false" :categories="tendenciaSiauCategorias" :series="serieSiauTendencia" :format="(v) => v.toLocaleString('es-CO')" />
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Calificación del Servicio</h3>
                <q-badge color="grey-3" text-color="grey-8">Voz Usuario</q-badge>
              </div>
              <ChartDonut titulo="Calificación" :items="donutSiauItems" :centro="(siauKpis.total_encuestas || 0).toLocaleString('es-CO')" subtitulo="Encuestas" :format="(v) => v.toLocaleString('es-CO')" />
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Satisfacción por Servicio</h3>
                <q-badge color="grey-3" text-color="grey-8">Áreas</q-badge>
              </div>
              <ChartBars titulo="Satisfacción por Área" :items="siauServiciosItems" :format="(v) => `${v.toLocaleString('es-CO')} enc.`" />
            </article>
          </section>

          <section class="vi-grid-3 q-mb-sm">
            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Satisfacción por Área de Atención</h3>
                <span class="text-caption text-grey-6">Servicios</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="siauServicios" :columns="colSiauServicios" row-key="servicio" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-servicio="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas text-weight-bold text-primary">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_encuestas="props"><q-td :props="props" class="text-right text-weight-medium td-num">{{ props.value }}</q-td></template>
                <template #body-cell-pct_satisfaccion="props"><q-td :props="props" class="text-center td-badge"><q-badge :color="props.value >= 85 ? 'positive' : 'warning'" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Distribución de Calificaciones</h3>
                <span class="text-caption text-grey-6">Nivel</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="siauCalificaciones" :columns="colSiauCalificaciones" row-key="calificacion" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-calificacion="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas text-weight-bold text-primary">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_encuestas="props"><q-td :props="props" class="text-right text-weight-bold text-primary td-num">{{ props.value }}</q-td></template>
                <template #body-cell-pct_participacion="props"><q-td :props="props" class="text-center td-badge"><q-badge color="primary" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>

            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Satisfacción por EPS</h3>
                <span class="text-caption text-grey-6">Participación</span>
              </div>
              <q-table class="vi-table vi-table-fixed" flat dense :rows="siauAseguradores" :columns="colSiauAseguradores" row-key="asegurador" hide-bottom :pagination="{ rowsPerPage: 7 }">
                <template #body-cell-asegurador="props"><q-td :props="props" class="td-nombre"><div class="col-nombre-2filas" :title="props.value">{{ props.value }}</div></q-td></template>
                <template #body-cell-total_encuestas="props"><q-td :props="props" class="text-right text-weight-medium text-grey-9 td-num">{{ props.value }}</q-td></template>
                <template #body-cell-pct_satisfaccion="props"><q-td :props="props" class="text-center td-badge"><q-badge :color="props.value >= 85 ? 'positive' : 'warning'" text-color="white" class="badge-tabla">{{ props.value }}%</q-badge></q-td></template>
              </q-table>
            </article>
          </section>

          <article class="vi-card bg-blue-1 text-grey-9 q-pa-sm" style="border: 1px solid #bfdbfe;">
            <div class="row items-center q-gutter-sm q-mb-xs">
              <q-icon name="sentiment_satisfied_alt" size="20px" color="primary" />
              <h4 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Matriz de Humanización del Servicio, Voz del Usuario y Gestión SIAU (Clínica Esperanza):</h4>
            </div>
            <div class="row q-col-gutter-xs text-caption">
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">1. Trato Digno y Humanizado:</strong> Monitoreo constante de calidez y respeto en la atención de enfermería, médicos y recepción.</div></div>
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">2. Resolución Oportuna PQRS:</strong> Gestión activa de quejas y reclamos dentro del estándar de oportunidad (&lt; 15 días hábiles).</div></div>
              <div class="col-12 col-md-4"><div class="bg-white q-pa-xs rounded-borders" style="border: 1px solid #dce4ec;"><strong class="text-primary">3. Comité COPACO:</strong> Retroalimentación mensual con asociaciones de usuarios para planes de mejora institucional.</div></div>
            </div>
          </article>
        </div>
      </template>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { api } from 'boot/api'
import TableroEncabezado from '../components/panel/TableroEncabezado.vue'
import ChartLine from '../components/charts/ChartLine.vue'
import ChartBars from '../components/charts/ChartBars.vue'
import ChartDonut from '../components/charts/ChartDonut.vue'

const loading = ref(true)
const exportando = ref(false)
const procesoActivo = ref('citas')

// Filtros de Periodo (Semanal por defecto solicitado)
const filtroPeriodo = ref('semana') // 'semana' | 'mes' | 'anio' | 'fechas'
const fechaInicio = ref('2026-11-09')
const fechaFin = ref('2026-11-15')

const filtroPeriodoTexto = computed(() => {
  switch (filtroPeriodo.value) {
    case 'semana': return 'Semana (Lun - Dom)'
    case 'mes': return 'Mes de Noviembre'
    case 'fechas': return 'Rango Seleccionado'
    default: return 'Año 2026 (Ene - Dic)'
  }
})

// Procesos del Sistema (Todos en Vivo)
const procesos = [
  { id: 'citas', nombre: '1. Citas y Agenda', icono: 'event' },
  { id: 'autorizaciones', nombre: '2. Autorizaciones', icono: 'assignment_turned_in' },
  { id: 'apoyo', nombre: '3. Resultados de Apoyo', icono: 'biotech' },
  { id: 'hc', nombre: '4. Historia Clínica', icono: 'medical_information' },
  { id: 'caja', nombre: '5. Recaudos en Caja', icono: 'point_of_sale' },
  { id: 'bancos', nombre: '6. Recaudos en Bancos', icono: 'account_balance' },
  { id: 'siau', nombre: '7. SIAU / Satisfacción', icono: 'sentiment_very_satisfied' },
]

const nombreProcesoActivo = computed(() => {
  const p = procesos.find(x => x.id === procesoActivo.value)
  return p ? p.nombre : 'Indicadores'
})

// 1. Citas
const citasKpis = ref({})
const citasEspecialidades = ref([])
const citasMedicos = ref([])
const citasAseguradores = ref([])
const tendenciaRespuesta = ref({ tipo: 'semana', categorias: [], data: [] })

// 2. Autorizaciones
const autorizacionesKpis = ref({})
const autorizacionesServicios = ref([])
const autorizacionesAseguradores = ref([])
const tendenciaAutRespuesta = ref({ tipo: 'semana', categorias: [], data: [] })

// 3. Apoyo
const apoyoKpis = ref({})
const apoyoServicios = ref([])
const apoyoMedicos = ref([])
const tendenciaApoyoRespuesta = ref({ tipo: 'semana', categorias: [], data: [] })
const apoyoAseguradores = ref([])
const hcEspecialidades = ref([])
const cajaTerceros = ref([])
const bancosAseguradores = ref([])
const siauAseguradores = ref([])

// 4. Historia Clínica
const hcKpis = ref({})
const hcDiagnosticos = ref([])
const hcMedicos = ref([])
const tendenciaHcRespuesta = ref({ tipo: 'semana', categorias: [], data: [] })

// 5. Caja
const cajaKpis = ref({})
const cajaPuntos = ref([])
const cajaFormas = ref([])
const tendenciaCajaRespuesta = ref({ tipo: 'semana', categorias: [], data: [] })

// 6. Bancos
const bancosKpis = ref({})
const bancosCuentas = ref([])
const bancosCanales = ref([])
const tendenciaBancosRespuesta = ref({ tipo: 'semana', categorias: [], data: [] })

// 7. SIAU
const siauKpis = ref({})
const siauServicios = ref([])
const siauCalificaciones = ref([])
const tendenciaSiauRespuesta = ref({ tipo: 'semana', categorias: [], data: [] })

// Etiqueta dinámica de periodo
const labelPeriodoActivo = computed(() => {
  if (procesoActivo.value === 'citas') return citasKpis.value.label_periodo || 'Semana Actual (9 al 15 Nov 2026)'
  if (procesoActivo.value === 'autorizaciones') return autorizacionesKpis.value.label_periodo || 'Semana Actual (9 al 15 Nov 2026)'
  if (procesoActivo.value === 'apoyo') return apoyoKpis.value.label_periodo || 'Semana Actual (9 al 15 Nov 2026)'
  if (procesoActivo.value === 'hc') return hcKpis.value.label_periodo || 'Semana Actual (9 al 15 Nov 2026)'
  if (procesoActivo.value === 'caja') return cajaKpis.value.label_periodo || 'Semana Actual (9 al 15 Nov 2026)'
  if (procesoActivo.value === 'bancos') return bancosKpis.value.label_periodo || 'Semana Actual (9 al 15 Nov 2026)'
  if (procesoActivo.value === 'siau') return siauKpis.value.label_periodo || 'Semana Actual (9 al 15 Nov 2026)'
  return 'Semana Actual'
})

// Series Citas
const tendenciaCategorias = computed(() => tendenciaRespuesta.value.categorias || [])
const serieTendencia = computed(() => {
  const d = tendenciaRespuesta.value.data || []
  return [
    { name: 'Total Asignadas', color: '#0B3B60', values: d.map(r => r.total_citas || 0) },
    { name: 'Cumplidas', color: '#10B981', values: d.map(r => r.cumplidas || 0) },
  ]
})
const donutEstadosItems = computed(() => {
  const k = citasKpis.value
  return [
    { label: 'Cumplidas', value: Number(k.cumplidas || 0), color: '#10B981' },
    { label: 'Inasistencias', value: Number(k.inasistencias || 0), color: '#EF4444' },
    { label: 'Programadas', value: Number(k.programadas || 0), color: '#0072CE' },
    { label: 'Canceladas', value: Number(k.canceladas || 0), color: '#F59E0B' },
  ]
})
const citasAseguradoresItems = computed(() => {
  return citasAseguradores.value.map(a => ({ label: a.asegurador, value: Number(a.total_citas), color: '#0072CE' }))
})

// Series Autorizaciones
const tendenciaAutCategorias = computed(() => tendenciaAutRespuesta.value.categorias || [])
const serieAutTendencia = computed(() => {
  const d = tendenciaAutRespuesta.value.data || []
  return [
    { name: 'Total Órdenes', color: '#0B3B60', values: d.map(r => r.total_autorizaciones || 0) },
    { name: 'Facturadas', color: '#10B981', values: d.map(r => r.facturadas || 0) },
  ]
})
const donutAutEstadosItems = computed(() => {
  const k = autorizacionesKpis.value
  return [
    { label: 'Facturadas', value: Number(k.facturadas || 0), color: '#10B981' },
    { label: 'Pendientes', value: Number(k.pendientes_facturar || 0), color: '#F59E0B' },
    { label: 'Anuladas', value: Number(k.anuladas || 0), color: '#EF4444' },
  ]
})
const autorizacionesAseguradoresItems = computed(() => {
  return autorizacionesAseguradores.value.map(a => ({ label: a.asegurador, value: Number(a.total_autorizaciones), color: '#0072CE' }))
})

// Series Apoyo
const tendenciaApoyoCategorias = computed(() => tendenciaApoyoRespuesta.value.categorias || [])
const serieApoyoTendencia = computed(() => {
  const d = tendenciaApoyoRespuesta.value.data || []
  return [{ name: 'Estudios Realizados', color: '#0072CE', values: d.map(r => r.total_estudios || 0) }]
})
const donutApoyoItems = computed(() => {
  const k = apoyoKpis.value
  const oportunos = Number(k.oportunos_24h || 0)
  const total = Number(k.total_estudios || 0)
  return [
    { label: 'Oportunos (≤ 24h)', value: oportunos, color: '#10B981' },
    { label: 'Mayor a 24h', value: Math.max(0, total - oportunos), color: '#F59E0B' },
  ]
})
const apoyoServiciosItems = computed(() => {
  return apoyoServicios.value.slice(0, 5).map(s => ({ label: s.servicio, value: Number(s.total_estudios), color: '#0072CE' }))
})

// Series Historia Clínica
const tendenciaHcCategorias = computed(() => tendenciaHcRespuesta.value.categorias || [])
const serieHcTendencia = computed(() => {
  const d = tendenciaHcRespuesta.value.data || []
  return [{ name: 'Consultas Realizadas', color: '#0B3B60', values: d.map(r => r.total_atenciones || 0) }]
})
const donutHcItems = computed(() => {
  const k = hcKpis.value
  const cerradas = Number(k.cerradas_oportunas || 0)
  const total = Number(k.total_atenciones || 0)
  return [
    { label: 'Cerradas Oportunas', value: cerradas, color: '#10B981' },
    { label: 'Abiertas / En Trámite', value: Math.max(0, total - cerradas), color: '#F59E0B' },
  ]
})
const hcDiagnosticosItems = computed(() => {
  return hcDiagnosticos.value.slice(0, 5).map(d => ({ label: `${d.iddx}: ${d.diagnostico}`, value: Number(d.total_atenciones), color: '#0072CE' }))
})

// Series Caja
const tendenciaCajaCategorias = computed(() => tendenciaCajaRespuesta.value.categorias || [])
const serieCajaTendencia = computed(() => {
  const d = tendenciaCajaRespuesta.value.data || []
  return [{ name: 'Recaudado ($)', color: '#10B981', values: d.map(r => Number(r.valor_recaudado || 0)) }]
})
const donutCajaItems = computed(() => {
  return cajaFormas.value.map((f, i) => ({
    label: f.formapago,
    value: Number(f.valor_recaudado),
    color: ['#10B981', '#0072CE', '#F59E0B', '#8B5CF6'][i % 4]
  }))
})
const cajaPuntosItems = computed(() => {
  return cajaPuntos.value.map(c => ({ label: c.caja_nombre, value: Number(c.valor_recaudado), color: '#10B981' }))
})

// Series Bancos
const tendenciaBancosCategorias = computed(() => tendenciaBancosRespuesta.value.categorias || [])
const serieBancosTendencia = computed(() => {
  const d = tendenciaBancosRespuesta.value.data || []
  return [{ name: 'Ingreso Bancario ($)', color: '#0072CE', values: d.map(r => Number(r.valor_recaudado || 0)) }]
})
const donutBancosItems = computed(() => {
  const k = bancosKpis.value
  return [
    { label: 'Giro Directo ADRES', value: Number(k.giro_directo_monto || 0), color: '#0072CE' },
    { label: 'Consignación Directa EPS', value: Number(k.consignacion_eps_monto || 0), color: '#00B5E2' },
  ]
})
const bancosCuentasItems = computed(() => {
  return bancosCuentas.value.map(b => ({ label: `${b.banco} (${b.cuenta})`, value: Number(b.valor_recaudado), color: '#0072CE' }))
})

// Series SIAU
const tendenciaSiauCategorias = computed(() => tendenciaSiauRespuesta.value.categorias || [])
const serieSiauTendencia = computed(() => {
  const d = tendenciaSiauRespuesta.value.data || []
  return [{ name: 'Encuestas SIAU', color: '#8B5CF6', values: d.map(r => r.total_encuestas || 0) }]
})
const donutSiauItems = computed(() => {
  const k = siauKpis.value
  return [
    { label: 'Excelente', value: Number(k.excelente || 0), color: '#10B981' },
    { label: 'Buena', value: Number(k.buena || 0), color: '#0072CE' },
    { label: 'Regular / Mala', value: Number(k.regular_mala || 0), color: '#F59E0B' },
  ]
})
const siauServiciosItems = computed(() => {
  return siauServicios.value.map(s => ({ label: s.servicio, value: Number(s.total_encuestas), color: '#8B5CF6' }))
})

// Columnas Tablas Citas
const colEspecialidades = [
  { name: 'servicio', label: 'Especialidad', field: 'servicio', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'total_citas', label: 'Citas', field: 'total_citas', align: 'right', style: 'width: 17%;', headerStyle: 'width: 17%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'cumplidas', label: 'Cumpl.', field: 'cumplidas', align: 'right', style: 'width: 16%;', headerStyle: 'width: 16%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'pct_cumplimiento', label: '% Asist', field: 'pct_cumplimiento', align: 'center', style: 'width: 17%;', headerStyle: 'width: 17%;' },
]

const colMedicos = [
  { name: 'medico', label: 'Médico', field: 'medico', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'total_citas', label: 'Citas', field: 'total_citas', align: 'right', style: 'width: 17%;', headerStyle: 'width: 17%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'cumplidas', label: 'Atend.', field: 'cumplidas', align: 'right', style: 'width: 16%;', headerStyle: 'width: 16%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'pct_cumplimiento', label: '% Efec', field: 'pct_cumplimiento', align: 'center', style: 'width: 17%;', headerStyle: 'width: 17%;' },
]

const colAseguradores = [
  { name: 'asegurador', label: 'Asegurador / EPS', field: 'asegurador', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'total_citas', label: 'Citas', field: 'total_citas', align: 'right', style: 'width: 17%;', headerStyle: 'width: 17%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'cumplidas', label: 'Cumpl.', field: 'cumplidas', align: 'right', style: 'width: 16%;', headerStyle: 'width: 16%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'pct_participacion', label: '% Part', field: 'pct_participacion', align: 'center', style: 'width: 17%;', headerStyle: 'width: 17%;' },
]

// Columnas Tablas Autorizaciones
const colAutServicios = [
  { name: 'servicio', label: 'Procedimiento', field: 'servicio', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'total_autorizaciones', label: 'Total', field: 'total_autorizaciones', align: 'right', style: 'width: 17%;', headerStyle: 'width: 17%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'facturadas', label: 'Fact.', field: 'facturadas', align: 'right', style: 'width: 16%;', headerStyle: 'width: 16%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'pct_facturado', label: '% Fact', field: 'pct_facturado', align: 'center', style: 'width: 17%;', headerStyle: 'width: 17%;' },
]

const colAutAseguradores = [
  { name: 'asegurador', label: 'Asegurador / EPS', field: 'asegurador', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'total_autorizaciones', label: 'Total', field: 'total_autorizaciones', align: 'right', style: 'width: 17%;', headerStyle: 'width: 17%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'facturadas', label: 'Fact.', field: 'facturadas', align: 'right', style: 'width: 16%;', headerStyle: 'width: 16%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'pct_participacion', label: '% Part', field: 'pct_participacion', align: 'center', style: 'width: 17%;', headerStyle: 'width: 17%;' },
]

const colAutValores = [
  { name: 'servicio', label: 'Procedimiento', field: 'servicio', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'valor_total', label: 'Monto Total', field: 'valor_total', align: 'right', style: 'width: 28%;', headerStyle: 'width: 28%;' },
  { name: 'pendientes', label: 'Pend.', field: 'pendientes', align: 'right', style: 'width: 22%;', headerStyle: 'width: 22%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
]

// Columnas Tablas Apoyo
const colApoyoServicios = [
  { name: 'servicio', label: 'Estudio / Procedimiento', field: 'servicio', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'total_estudios', label: 'Estudios', field: 'total_estudios', align: 'right', style: 'width: 17%;', headerStyle: 'width: 17%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'tiempo_promedio', label: 'Entrega', field: 'tiempo_promedio', align: 'right', style: 'width: 16%;', headerStyle: 'width: 16%;' },
  { name: 'pct_participacion', label: '% Part', field: 'pct_participacion', align: 'center', style: 'width: 17%;', headerStyle: 'width: 17%;' },
]

const colApoyoAseguradores = [
  { name: 'asegurador', label: 'Asegurador / EPS', field: 'asegurador', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'total_estudios', label: 'Estudios', field: 'total_estudios', align: 'right', style: 'width: 25%;', headerStyle: 'width: 25%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'pct_participacion', label: '% Part', field: 'pct_participacion', align: 'center', style: 'width: 25%;', headerStyle: 'width: 25%;' },
]

const colHcEspecialidades = [
  { name: 'especialidad', label: 'Especialidad / Servicio', field: 'especialidad', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'total_atenciones', label: 'Consultas', field: 'total_atenciones', align: 'right', style: 'width: 25%;', headerStyle: 'width: 25%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'pct_participacion', label: '% Part', field: 'pct_participacion', align: 'center', style: 'width: 25%;', headerStyle: 'width: 25%;' },
]

const colCajaTerceros = [
  { name: 'cliente', label: 'Paciente / Pagador', field: 'cliente', align: 'left', style: 'width: 48%;', headerStyle: 'width: 48%;' },
  { name: 'valor_recaudado', label: 'Recaudado', field: 'valor_recaudado', align: 'right', style: 'width: 32%;', headerStyle: 'width: 32%;' },
  { name: 'pct_participacion', label: '% Part', field: 'pct_participacion', align: 'center', style: 'width: 20%;', headerStyle: 'width: 20%;' },
]

const colBancosAseguradores = [
  { name: 'asegurador', label: 'Entidad Aseguradora', field: 'asegurador', align: 'left', style: 'width: 48%;', headerStyle: 'width: 48%;' },
  { name: 'valor_recaudado', label: 'Abonado', field: 'valor_recaudado', align: 'right', style: 'width: 32%;', headerStyle: 'width: 32%;' },
  { name: 'pct_participacion', label: '% Part', field: 'pct_participacion', align: 'center', style: 'width: 20%;', headerStyle: 'width: 20%;' },
]

const colSiauAseguradores = [
  { name: 'asegurador', label: 'Asegurador / EPS', field: 'asegurador', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'total_encuestas', label: 'Encuestas', field: 'total_encuestas', align: 'right', style: 'width: 25%;', headerStyle: 'width: 25%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'pct_satisfaccion', label: '% Satis.', field: 'pct_satisfaccion', align: 'center', style: 'width: 25%;', headerStyle: 'width: 25%;' },
]

const colApoyoMedicos = [
  { name: 'medico', label: 'Médico Informante', field: 'medico', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'especialidad', label: 'Especialidad', field: 'especialidad', align: 'left', style: 'width: 28%;', headerStyle: 'width: 28%;' },
  { name: 'total_estudios', label: 'Informes', field: 'total_estudios', align: 'right', style: 'width: 22%;', headerStyle: 'width: 22%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
]

// Columnas Tablas HC
const colHcDiagnosticos = [
  { name: 'diagnostico', label: 'Diagnóstico CIE-10', field: 'diagnostico', align: 'left', style: 'width: 60%;', headerStyle: 'width: 60%;' },
  { name: 'total_atenciones', label: 'Casos', field: 'total_atenciones', align: 'right', style: 'width: 20%;', headerStyle: 'width: 20%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'pct_participacion', label: '% Part', field: 'pct_participacion', align: 'center', style: 'width: 20%;', headerStyle: 'width: 20%;' },
]

const colHcMedicos = [
  { name: 'medico', label: 'Médico Tratante', field: 'medico', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'especialidad', label: 'Especialidad', field: 'especialidad', align: 'left', style: 'width: 26%;', headerStyle: 'width: 26%;' },
  { name: 'total_atenciones', label: 'Atenciones', field: 'total_atenciones', align: 'right', style: 'width: 24%;', headerStyle: 'width: 24%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
]

// Columnas Tablas Caja
const colCajaPuntos = [
  { name: 'caja_nombre', label: 'Puesto de Caja', field: 'caja_nombre', align: 'left', style: 'width: 40%;', headerStyle: 'width: 40%;' },
  { name: 'total_recibos', label: 'Recibos', field: 'total_recibos', align: 'right', style: 'width: 20%;', headerStyle: 'width: 20%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'valor_recaudado', label: 'Total Recaudado', field: 'valor_recaudado', align: 'right', style: 'width: 24%;', headerStyle: 'width: 24%;' },
  { name: 'pct_participacion', label: '% Part', field: 'pct_participacion', align: 'center', style: 'width: 16%;', headerStyle: 'width: 16%;' },
]

const colCajaFormas = [
  { name: 'formapago', label: 'Forma de Pago', field: 'formapago', align: 'left', style: 'width: 40%;', headerStyle: 'width: 40%;' },
  { name: 'total_recibos', label: 'Recibos', field: 'total_recibos', align: 'right', style: 'width: 20%;', headerStyle: 'width: 20%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'valor_recaudado', label: 'Total Recaudado', field: 'valor_recaudado', align: 'right', style: 'width: 24%;', headerStyle: 'width: 24%;' },
  { name: 'pct_participacion', label: '% Part', field: 'pct_participacion', align: 'center', style: 'width: 16%;', headerStyle: 'width: 16%;' },
]

// Columnas Tablas Bancos
const colBancosCuentas = [
  { name: 'banco', label: 'Entidad Bancaria', field: 'banco', align: 'left', style: 'width: 40%;', headerStyle: 'width: 40%;' },
  { name: 'total_operaciones', label: 'Abonos', field: 'total_operaciones', align: 'right', style: 'width: 20%;', headerStyle: 'width: 20%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'valor_recaudado', label: 'Valor Ingresado', field: 'valor_recaudado', align: 'right', style: 'width: 24%;', headerStyle: 'width: 24%;' },
  { name: 'pct_participacion', label: '% Part', field: 'pct_participacion', align: 'center', style: 'width: 16%;', headerStyle: 'width: 16%;' },
]

const colBancosCanales = [
  { name: 'tipo_canal', label: 'Canal de Recaudo', field: 'tipo_canal', align: 'left', style: 'width: 40%;', headerStyle: 'width: 40%;' },
  { name: 'total_operaciones', label: 'Abonos', field: 'total_operaciones', align: 'right', style: 'width: 20%;', headerStyle: 'width: 20%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'valor_recaudado', label: 'Valor Ingresado', field: 'valor_recaudado', align: 'right', style: 'width: 24%;', headerStyle: 'width: 24%;' },
  { name: 'pct_participacion', label: '% Part', field: 'pct_participacion', align: 'center', style: 'width: 16%;', headerStyle: 'width: 16%;' },
]

// Columnas Tablas SIAU
const colSiauServicios = [
  { name: 'servicio', label: 'Servicio Asistencial', field: 'servicio', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'total_encuestas', label: 'Encuestas', field: 'total_encuestas', align: 'right', style: 'width: 25%;', headerStyle: 'width: 25%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'pct_satisfaccion', label: '% Satisf.', field: 'pct_satisfaccion', align: 'center', style: 'width: 25%;', headerStyle: 'width: 25%;' },
]

const colSiauCalificaciones = [
  { name: 'calificacion', label: 'Nivel de Calificación', field: 'calificacion', align: 'left', style: 'width: 50%;', headerStyle: 'width: 50%;' },
  { name: 'total_encuestas', label: 'Usuarios', field: 'total_encuestas', align: 'right', style: 'width: 25%;', headerStyle: 'width: 25%;', format: (v) => Number(v || 0).toLocaleString('es-CO') },
  { name: 'pct_participacion', label: '% Part', field: 'pct_participacion', align: 'center', style: 'width: 25%;', headerStyle: 'width: 25%;' },
]

function formatDinero(val) {
  const n = Number(val || 0)
  if (Math.abs(n) >= 1e6) {
    return '$ ' + (n / 1e6).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M'
  }
  return '$ ' + n.toLocaleString('es-CO')
}

function cambiarPeriodo() {
  if (filtroPeriodo.value !== 'fechas') {
    cargarDatos()
  }
}

function seleccionarProceso(id) {
  procesoActivo.value = id
  cargarDatos()
}

function buildQueryString() {
  let q = `periodo=${filtroPeriodo.value}`
  if (filtroPeriodo.value === 'fechas' && fechaInicio.value && fechaFin.value) {
    q += `&fecha_inicio=${fechaInicio.value}&fecha_fin=${fechaFin.value}`
  }
  return q
}

async function cargarDatos() {
  loading.value = true
  const q = buildQueryString()
  try {
    if (procesoActivo.value === 'citas') {
      const [kpisRes, espRes, medRes, aseRes, tenRes] = await Promise.all([
        api.get(`/indicadores/citas/kpis?${q}`),
        api.get(`/indicadores/citas/por-especialidad?limit=10&${q}`),
        api.get(`/indicadores/citas/por-medico?limit=10&${q}`),
        api.get(`/indicadores/citas/por-asegurador?limit=7&${q}`),
        api.get(`/indicadores/citas/tendencia?${q}`)
      ])
      citasKpis.value = kpisRes.data || {}
      citasEspecialidades.value = espRes.data || []
      citasMedicos.value = medRes.data || []
      citasAseguradores.value = aseRes.data || []
      tendenciaRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }
    } else if (procesoActivo.value === 'autorizaciones') {
      const [kpisRes, serRes, aseRes, tenRes] = await Promise.all([
        api.get(`/indicadores/autorizaciones/kpis?${q}`),
        api.get(`/indicadores/autorizaciones/por-servicio?limit=10&${q}`),
        api.get(`/indicadores/autorizaciones/por-asegurador?limit=8&${q}`),
        api.get(`/indicadores/autorizaciones/tendencia?${q}`)
      ])
      autorizacionesKpis.value = kpisRes.data || {}
      autorizacionesServicios.value = serRes.data || []
      autorizacionesAseguradores.value = aseRes.data || []
      tendenciaAutRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }
    } else if (procesoActivo.value === 'apoyo') {
      const [kpisRes, serRes, medRes, aseRes, tenRes] = await Promise.all([
        api.get(`/indicadores/apoyo/kpis?${q}`),
        api.get(`/indicadores/apoyo/por-servicio?limit=10&${q}`),
        api.get(`/indicadores/apoyo/por-medico?limit=10&${q}`),
        api.get(`/indicadores/apoyo/por-asegurador?limit=8&${q}`),
        api.get(`/indicadores/apoyo/tendencia?${q}`)
      ])
      apoyoKpis.value = kpisRes.data || {}
      apoyoServicios.value = serRes.data || []
      apoyoMedicos.value = medRes.data || []
      apoyoAseguradores.value = aseRes.data || []
      tendenciaApoyoRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }
    } else if (procesoActivo.value === 'hc') {
      const [kpisRes, dxRes, medRes, espRes, tenRes] = await Promise.all([
        api.get(`/indicadores/hc/kpis?${q}`),
        api.get(`/indicadores/hc/por-diagnostico?limit=10&${q}`),
        api.get(`/indicadores/hc/por-medico?limit=10&${q}`),
        api.get(`/indicadores/hc/por-especialidad?limit=8&${q}`),
        api.get(`/indicadores/hc/tendencia?${q}`)
      ])
      hcKpis.value = kpisRes.data || {}
      hcDiagnosticos.value = dxRes.data || []
      hcMedicos.value = medRes.data || []
      hcEspecialidades.value = espRes.data || []
      tendenciaHcRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }
    } else if (procesoActivo.value === 'caja') {
      const [kpisRes, cajRes, formRes, terRes, tenRes] = await Promise.all([
        api.get(`/indicadores/caja/kpis?${q}`),
        api.get(`/indicadores/caja/por-caja?${q}`),
        api.get(`/indicadores/caja/por-formapago?${q}`),
        api.get(`/indicadores/caja/por-tercero?limit=8&${q}`),
        api.get(`/indicadores/caja/tendencia?${q}`)
      ])
      cajaKpis.value = kpisRes.data || {}
      cajaPuntos.value = cajRes.data || []
      cajaFormas.value = formRes.data || []
      cajaTerceros.value = terRes.data || []
      tendenciaCajaRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }
    } else if (procesoActivo.value === 'bancos') {
      const [kpisRes, banRes, canRes, aseRes, tenRes] = await Promise.all([
        api.get(`/indicadores/bancos/kpis?${q}`),
        api.get(`/indicadores/bancos/por-banco?${q}`),
        api.get(`/indicadores/bancos/por-canal?${q}`),
        api.get(`/indicadores/bancos/por-asegurador?limit=8&${q}`),
        api.get(`/indicadores/bancos/tendencia?${q}`)
      ])
      bancosKpis.value = kpisRes.data || {}
      bancosCuentas.value = banRes.data || []
      bancosCanales.value = canRes.data || []
      bancosAseguradores.value = aseRes.data || []
      tendenciaBancosRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }
    } else if (procesoActivo.value === 'siau') {
      const [kpisRes, serRes, calRes, aseRes, tenRes] = await Promise.all([
        api.get(`/indicadores/siau/kpis?${q}`),
        api.get(`/indicadores/siau/por-servicio?${q}`),
        api.get(`/indicadores/siau/por-calificacion?${q}`),
        api.get(`/indicadores/siau/por-asegurador?limit=8&${q}`),
        api.get(`/indicadores/siau/tendencia?${q}`)
      ])
      siauKpis.value = kpisRes.data || {}
      siauServicios.value = serRes.data || []
      siauCalificaciones.value = calRes.data || []
      siauAseguradores.value = aseRes.data || []
      tendenciaSiauRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }
    }
  } catch (err) {
    console.error(`Error cargando indicadores de ${procesoActivo.value}:`, err)
  } finally {
    loading.value = false
  }
}

function exportarExcel() {
  exportando.value = true
  const q = buildQueryString()
  const endpoint = `/api/indicadores/${procesoActivo.value}/exportar-csv?${q}`
  const filename = `${procesoActivo.value}_clinica_esperanza_${filtroPeriodo.value}.csv`

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

watch(procesoActivo, () => {
  cargarDatos()
})

onMounted(() => {
  cargarDatos()
})
</script>

<style scoped>
.procesos-bar {
  background: #ffffff;
  border: 1px solid #dce4ec;
  border-radius: 8px;
  padding: 5px 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.proceso-btn {
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.proceso-btn--active {
  background: #0B3B60 !important;
  color: #ffffff !important;
  box-shadow: 0 2px 5px rgba(11, 59, 96, 0.25);
}

.proceso-btn--inactive {
  background: #f1f5f9;
  color: #475569;
}

.proceso-btn--inactive:hover {
  background: #e2e8f0;
  color: #0B3B60;
}

/* Barra de Filtros Estandarizada */
.filtro-bar {
  background: #ffffff;
  border: 1px solid #dce4ec;
  border-radius: 8px;
  padding: 5px 10px;
  min-height: 40px;
}

.filtro-toggle :deep(.q-btn) {
  font-size: 11px;
  padding: 3px 8px;
  font-weight: 600;
}

.vi-input-date {
  height: 26px;
  padding: 1px 6px;
  font-size: 11px;
  color: #0b3b60;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}

.vi-input-date:focus {
  border-color: #0072ce;
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
