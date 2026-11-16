<template>
  <q-page padding>
    <PresupuestoRequerido />
    <template v-if="tienePresupuesto">
      <div class="text-h6 q-mb-sm">{{ titulo }} — {{ presupuestoLabel }}</div>
      <p v-if="descripcion" class="text-body2 text-grey-7 q-mb-md">{{ descripcion }}</p>
      <TablaModulo :title="titulo" :rows="filas" :loading="loading" />
      <q-expansion-item
        v-if="extraHistorico"
        class="q-mt-lg"
        icon="info"
        label="¿De dónde sale la proyección? (referencia histórica)"
        caption="No es un menú aparte: son los valores reales del año anterior"
      >
        <q-card flat bordered class="q-ma-sm">
          <q-card-section>
            <p class="text-body2">
              La proyección usa el histórico del año <strong>{{ historico.anio_origen }}</strong>
              (mismo mes del año pasado), más tasa de crecimiento y estacionalidad definidas en Parámetros.
            </p>
            <TablaModulo title="Referencia histórica" :rows="historico.filas || []" :loading="loadingHistorico" />
          </q-card-section>
        </q-card>
      </q-expansion-item>
    </template>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from 'boot/api'
import PresupuestoRequerido from 'components/PresupuestoRequerido.vue'
import TablaModulo from 'components/TablaModulo.vue'
import { usePresupuestoActivo } from '../composables/usePresupuestoActivo.js'

const route = useRoute()
const { versionId, tienePresupuesto, presupuestoLabel } = usePresupuestoActivo()

const meta = {
  parametros: {
    titulo: 'Parámetros y estacionalidad',
    descripcion: 'Tasa de crecimiento, márgenes y índice mensual de estacionalidad para este presupuesto.',
    endpoint: (id) => `/presupuestos/${id}/parametros`,
    map: (data) => {
      const rows = []
      if (data.parametros) {
        rows.push({ concepto: 'Tasa crecimiento anual', valor: data.parametros.tasa_crecimiento_anual })
        rows.push({ concepto: '% costo / ingreso', valor: data.parametros.pct_costo_sobre_ingreso })
        rows.push({ concepto: '% comisión / ingreso', valor: data.parametros.pct_comision_sobre_ingreso })
        rows.push({ concepto: '% contingencia / fijos', valor: data.parametros.pct_contingencia_sobre_fijos })
      }
      for (const e of data.estacionalidad || []) {
        rows.push({ concepto: `Estacionalidad mes ${e.numero_mes}`, valor: e.indice })
      }
      return rows
    },
  },
  proyeccion: {
    titulo: 'Proyección',
    descripcion: 'Ingresos y egresos proyectados por mes y rubro.',
    endpoint: (id) => `/presupuestos/${id}/proyeccion`,
    map: (data) => data,
    extraHistorico: true,
  },
  movimientos: {
    titulo: 'Movimientos presupuestales',
    descripcion: 'Inicial, adiciones, reducciones y traslados aprobados de este presupuesto.',
    endpoint: (id) => `/presupuestos/${id}/movimientos`,
    map: (data) => data,
  },
  balance: {
    titulo: 'Balance contable',
    descripcion: 'Saldos cargados por periodo (cruce contable con rubros vía homologación).',
    endpoint: (id) => `/presupuestos/${id}/balance`,
    map: (data) => data,
  },
  ejecucion: {
    titulo: 'Ejecución',
    descripcion: 'Totalizador mensual: proyectado vs balance y márgenes.',
    endpoint: (id) => `/presupuestos/${id}/ejecucion`,
    map: (data) => data,
  },
}

const cfg = computed(() => meta[route.meta.modulo] || meta.parametros)
const titulo = computed(() => cfg.value.titulo)
const descripcion = computed(() => cfg.value.descripcion)
const extraHistorico = computed(() => cfg.value.extraHistorico)

const loading = ref(false)
const filas = ref([])
const loadingHistorico = ref(false)
const historico = ref({})

async function cargar() {
  if (!versionId.value) return
  loading.value = true
  try {
    const { data } = await api.get(cfg.value.endpoint(versionId.value))
    filas.value = cfg.value.map(data)
  } finally {
    loading.value = false
  }
  if (extraHistorico.value && versionId.value) {
    loadingHistorico.value = true
    try {
      const { data } = await api.get(`/presupuestos/${versionId.value}/historico-referencia`)
      historico.value = data
    } finally {
      loadingHistorico.value = false
    }
  }
}

onMounted(cargar)
watch(versionId, cargar)
</script>
