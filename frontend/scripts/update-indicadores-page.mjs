import fs from 'fs'

const filePath = 'src/pages/IndicadoresPage.vue'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Inyectar nuevas variables reactivas
const targetRefs = "const tendenciaApoyoRespuesta = ref({ tipo: 'semana', categorias: [], data: [] })"
const newRefs = `const tendenciaApoyoRespuesta = ref({ tipo: 'semana', categorias: [], data: [] })
const apoyoAseguradores = ref([])
const hcEspecialidades = ref([])
const cajaTerceros = ref([])
const bancosAseguradores = ref([])
const siauAseguradores = ref([])`

if (!content.includes('const apoyoAseguradores = ref([])')) {
  content = content.replace(targetRefs, newRefs)
}

// 2. Inyectar definiciones de columnas
const targetCols = "const colApoyoMedicos = ["
const newCols = `const colApoyoAseguradores = [
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

const colApoyoMedicos = [`

if (!content.includes('const colApoyoAseguradores = [')) {
  content = content.replace(targetCols, newCols)
}

// 3. Inyectar peticiones en cargarDatos
const oldApoyoFetch = `      const [kpisRes, serRes, medRes, tenRes] = await Promise.all([
        api.get(\`/indicadores/apoyo/kpis?\${q}\`),
        api.get(\`/indicadores/apoyo/por-servicio?limit=10&\${q}\`),
        api.get(\`/indicadores/apoyo/por-medico?limit=10&\${q}\`),
        api.get(\`/indicadores/apoyo/tendencia?\${q}\`)
      ])
      apoyoKpis.value = kpisRes.data || {}
      apoyoServicios.value = serRes.data || []
      apoyoMedicos.value = medRes.data || []
      tendenciaApoyoRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }`

const newApoyoFetch = `      const [kpisRes, serRes, medRes, aseRes, tenRes] = await Promise.all([
        api.get(\`/indicadores/apoyo/kpis?\${q}\`),
        api.get(\`/indicadores/apoyo/por-servicio?limit=10&\${q}\`),
        api.get(\`/indicadores/apoyo/por-medico?limit=10&\${q}\`),
        api.get(\`/indicadores/apoyo/por-asegurador?limit=8&\${q}\`),
        api.get(\`/indicadores/apoyo/tendencia?\${q}\`)
      ])
      apoyoKpis.value = kpisRes.data || {}
      apoyoServicios.value = serRes.data || []
      apoyoMedicos.value = medRes.data || []
      apoyoAseguradores.value = aseRes.data || []
      tendenciaApoyoRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }`

content = content.replace(oldApoyoFetch, newApoyoFetch)

const oldHcFetch = `      const [kpisRes, dxRes, medRes, tenRes] = await Promise.all([
        api.get(\`/indicadores/hc/kpis?\${q}\`),
        api.get(\`/indicadores/hc/por-diagnostico?limit=10&\${q}\`),
        api.get(\`/indicadores/hc/por-medico?limit=10&\${q}\`),
        api.get(\`/indicadores/hc/tendencia?\${q}\`)
      ])
      hcKpis.value = kpisRes.data || {}
      hcDiagnosticos.value = dxRes.data || []
      hcMedicos.value = medRes.data || []
      tendenciaHcRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }`

const newHcFetch = `      const [kpisRes, dxRes, medRes, espRes, tenRes] = await Promise.all([
        api.get(\`/indicadores/hc/kpis?\${q}\`),
        api.get(\`/indicadores/hc/por-diagnostico?limit=10&\${q}\`),
        api.get(\`/indicadores/hc/por-medico?limit=10&\${q}\`),
        api.get(\`/indicadores/hc/por-especialidad?limit=8&\${q}\`),
        api.get(\`/indicadores/hc/tendencia?\${q}\`)
      ])
      hcKpis.value = kpisRes.data || {}
      hcDiagnosticos.value = dxRes.data || []
      hcMedicos.value = medRes.data || []
      hcEspecialidades.value = espRes.data || []
      tendenciaHcRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }`

content = content.replace(oldHcFetch, newHcFetch)

const oldCajaFetch = `      const [kpisRes, cajRes, formRes, tenRes] = await Promise.all([
        api.get(\`/indicadores/caja/kpis?\${q}\`),
        api.get(\`/indicadores/caja/por-caja?\${q}\`),
        api.get(\`/indicadores/caja/por-formapago?\${q}\`),
        api.get(\`/indicadores/caja/tendencia?\${q}\`)
      ])
      cajaKpis.value = kpisRes.data || {}
      cajaPuntos.value = cajRes.data || []
      cajaFormas.value = formRes.data || []
      tendenciaCajaRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }`

const newCajaFetch = `      const [kpisRes, cajRes, formRes, terRes, tenRes] = await Promise.all([
        api.get(\`/indicadores/caja/kpis?\${q}\`),
        api.get(\`/indicadores/caja/por-caja?\${q}\`),
        api.get(\`/indicadores/caja/por-formapago?\${q}\`),
        api.get(\`/indicadores/caja/por-tercero?limit=8&\${q}\`),
        api.get(\`/indicadores/caja/tendencia?\${q}\`)
      ])
      cajaKpis.value = kpisRes.data || {}
      cajaPuntos.value = cajRes.data || []
      cajaFormas.value = formRes.data || []
      cajaTerceros.value = terRes.data || []
      tendenciaCajaRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }`

content = content.replace(oldCajaFetch, newCajaFetch)

const oldBancosFetch = `      const [kpisRes, banRes, canRes, tenRes] = await Promise.all([
        api.get(\`/indicadores/bancos/kpis?\${q}\`),
        api.get(\`/indicadores/bancos/por-banco?\${q}\`),
        api.get(\`/indicadores/bancos/por-canal?\${q}\`),
        api.get(\`/indicadores/bancos/tendencia?\${q}\`)
      ])
      bancosKpis.value = kpisRes.data || {}
      bancosCuentas.value = banRes.data || []
      bancosCanales.value = canRes.data || []
      tendenciaBancosRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }`

const newBancosFetch = `      const [kpisRes, banRes, canRes, aseRes, tenRes] = await Promise.all([
        api.get(\`/indicadores/bancos/kpis?\${q}\`),
        api.get(\`/indicadores/bancos/por-banco?\${q}\`),
        api.get(\`/indicadores/bancos/por-canal?\${q}\`),
        api.get(\`/indicadores/bancos/por-asegurador?limit=8&\${q}\`),
        api.get(\`/indicadores/bancos/tendencia?\${q}\`)
      ])
      bancosKpis.value = kpisRes.data || {}
      bancosCuentas.value = banRes.data || []
      bancosCanales.value = canRes.data || []
      bancosAseguradores.value = aseRes.data || []
      tendenciaBancosRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }`

content = content.replace(oldBancosFetch, newBancosFetch)

const oldSiauFetch = `      const [kpisRes, serRes, calRes, tenRes] = await Promise.all([
        api.get(\`/indicadores/siau/kpis?\${q}\`),
        api.get(\`/indicadores/siau/por-servicio?\${q}\`),
        api.get(\`/indicadores/siau/por-calificacion?\${q}\`),
        api.get(\`/indicadores/siau/tendencia?\${q}\`)
      ])
      siauKpis.value = kpisRes.data || {}
      siauServicios.value = serRes.data || []
      siauCalificaciones.value = calRes.data || []
      tendenciaSiauRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }`

const newSiauFetch = `      const [kpisRes, serRes, calRes, aseRes, tenRes] = await Promise.all([
        api.get(\`/indicadores/siau/kpis?\${q}\`),
        api.get(\`/indicadores/siau/por-servicio?\${q}\`),
        api.get(\`/indicadores/siau/por-calificacion?\${q}\`),
        api.get(\`/indicadores/siau/por-asegurador?limit=8&\${q}\`),
        api.get(\`/indicadores/siau/tendencia?\${q}\`)
      ])
      siauKpis.value = kpisRes.data || {}
      siauServicios.value = serRes.data || []
      siauCalificaciones.value = calRes.data || []
      siauAseguradores.value = aseRes.data || []
      tendenciaSiauRespuesta.value = tenRes.data || { tipo: 'semana', categorias: [], data: [] }`

content = content.replace(oldSiauFetch, newSiauFetch)

// 4. Actualizar secciones del template
// A) Apoyo
const oldApoyoGrid3 = `            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Estándares de Calidad</h3>
                <span class="text-caption text-grey-6">Resolución 3100</span>
              </div>
              <div class="q-pa-xs">
                <div class="q-mb-xs bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Oportunidad Ecocardiogramas:</strong>
                  <div class="text-caption text-grey-8">Meta: Entrega el mismo día o en menos de 24h hábiles.</div>
                </div>
                <div class="q-mb-xs bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Monitoreo TA / MAPA 24 Horas:</strong>
                  <div class="text-caption text-grey-8">Retiro de holter y generación de trazado e informe de riesgo.</div>
                </div>
                <div class="bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Radiografías y Ecografías:</strong>
                  <div class="text-caption text-grey-8">Trazabilidad de almacenamiento DICOM y firma digital.</div>
                </div>
              </div>
            </article>
          </section>
        </div>`

const newApoyoGrid3 = `            <article class="vi-card">
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
        </div>`

content = content.replace(oldApoyoGrid3, newApoyoGrid3)

// B) HC
const oldHcGrid3 = `            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Perfil Epidemiológico</h3>
                <span class="text-caption text-grey-6">Enfoque</span>
              </div>
              <div class="q-pa-xs">
                <div class="q-mb-xs bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Riesgo Cardiovascular:</strong>
                  <div class="text-caption text-grey-8">Alta prevalencia de Hipertensión Arterial (I10) y Diabetes Mellitus (E11).</div>
                </div>
                <div class="q-mb-xs bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Salud Tiroidea:</strong>
                  <div class="text-caption text-grey-8">Seguimiento ambulatorio a Hipotiroidismo no especificado (E039).</div>
                </div>
                <div class="bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Exámenes Médicos Preventivos:</strong>
                  <div class="text-caption text-grey-8">Tamizaje preventivo en adultos y personas mayores (Z000).</div>
                </div>
              </div>
            </article>
          </section>
        </div>`

const newHcGrid3 = `            <article class="vi-card">
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
        </div>`

content = content.replace(oldHcGrid3, newHcGrid3)

// C) Caja
const oldCajaGrid3 = `            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Políticas de Arqueo y Seguridad</h3>
                <span class="text-caption text-grey-6">Control</span>
              </div>
              <div class="q-pa-xs">
                <div class="q-mb-xs bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Cierre Diario de Caja:</strong>
                  <div class="text-caption text-grey-8">Conciliación obligatoria de efectivo y bouchers de datáfono al terminar el turno.</div>
                </div>
                <div class="q-mb-xs bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Depósito en Cuenta Bancaria:</strong>
                  <div class="text-caption text-grey-8">Consignación periódica para mitigar retención de efectivo en sede.</div>
                </div>
                <div class="bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Control de Copagos:</strong>
                  <div class="text-caption text-grey-8">Validación automática de comprobantes de copago contra órdenes de servicio.</div>
                </div>
              </div>
            </article>
          </section>
        </div>`

const newCajaGrid3 = `            <article class="vi-card">
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
        </div>`

content = content.replace(oldCajaGrid3, newCajaGrid3)

// D) Bancos
const oldBancosGrid3 = `            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Control Financiero y Conciliación</h3>
                <span class="text-caption text-grey-6">Tesorería</span>
              </div>
              <div class="q-pa-xs">
                <div class="q-mb-xs bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Giro Directo ADRES:</strong>
                  <div class="text-caption text-grey-8">Pagos del Estado transferidos a las cuentas sin intermediación del flujo de EPS.</div>
                </div>
                <div class="q-mb-xs bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Identificación de Consignaciones:</strong>
                  <div class="text-caption text-grey-8">Cruce ágil de depósitos contra facturas radicadas para no dejar partidas conciliatorias.</div>
                </div>
                <div class="bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Descarga de Cartera:</strong>
                  <div class="text-caption text-grey-8">Aplicación contable inmediata de recibos para mantener al día el estado de cuenta por EPS.</div>
                </div>
              </div>
            </article>
          </section>
        </div>`

const newBancosGrid3 = `            <article class="vi-card">
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
        </div>`

content = content.replace(oldBancosGrid3, newBancosGrid3)

// E) SIAU
const oldSiauGrid3 = `            <article class="vi-card">
              <div class="row items-center justify-between q-mb-xs">
                <h3 class="q-ma-none text-subtitle2 text-weight-bold" style="color: #0B3B60;">Voz del Usuario y Humanización</h3>
                <span class="text-caption text-grey-6">SIAU</span>
              </div>
              <div class="q-pa-xs">
                <div class="q-mb-xs bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Trato Digno y Humanizado:</strong>
                  <div class="text-caption text-grey-8">Monitoreo constante de la calidez en la atención de enfermería, médicos y recepción.</div>
                </div>
                <div class="q-mb-xs bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Resolución Oportuna de Quejas:</strong>
                  <div class="text-caption text-grey-8">Gestión activa de PQRS dentro del plazo de 15 días hábiles con plan de mejora.</div>
                </div>
                <div class="bg-grey-1 q-pa-sm rounded-borders" style="border: 1px solid #e2e8f0;">
                  <strong class="text-primary" style="font-size: 11px;">Comité de Participación Comunitaria:</strong>
                  <div class="text-caption text-grey-8">Reuniones de COPACO para retroalimentación con líderes de la comunidad.</div>
                </div>
              </div>
            </article>
          </section>
        </div>`

const newSiauGrid3 = `            <article class="vi-card">
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
        </div>`

content = content.replace(oldSiauGrid3, newSiauGrid3)

fs.writeFileSync(filePath, content, 'utf8')
console.log('Successfully updated IndicadoresPage.vue with full 3-table layout and matrices across all processes!')
