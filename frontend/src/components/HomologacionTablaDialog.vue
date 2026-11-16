<template>
  <q-dialog v-model="model" maximized transition-show="slide-up" transition-hide="slide-down">
    <q-card>
      <q-bar class="bg-primary text-white">
        <div>Tabla de homologación (solo consulta)</div>
        <q-space />
        <q-btn dense flat icon="close" v-close-popup />
      </q-bar>
      <q-card-section>
        <p class="text-body2 text-grey-7 q-mb-md">
          Para cambiar una homologación, edítela en el formulario del rubro correspondiente.
        </p>
        <q-table
          flat
          bordered
          :rows="filas"
          :columns="columnas"
          row-key="rubro"
          :loading="loading"
          :pagination="{ rowsPerPage: 20 }"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { api } from 'boot/api'

const model = defineModel({ type: Boolean, default: false })
const props = defineProps({ versionId: { type: Number, default: null } })

const loading = ref(false)
const filas = ref([])

const columnas = [
  { name: 'rubro', label: 'Rubro', field: 'rubro', align: 'left' },
  { name: 'rubro_nombre', label: 'Nombre', field: 'rubro_nombre', align: 'left' },
  { name: 'tipo', label: 'Tipo', field: 'tipo', align: 'left' },
  { name: 'cuenta', label: 'Cuenta', field: 'cuenta', align: 'left' },
  { name: 'cuenta_nombre', label: 'Descripción cuenta', field: 'cuenta_nombre', align: 'left' },
  { name: 'porcentaje', label: '%', field: 'porcentaje', align: 'right' },
]

async function cargar() {
  if (!props.versionId || !model.value) return
  loading.value = true
  try {
    const { data } = await api.get(`/presupuestos/${props.versionId}/homologacion`)
    filas.value = data
  } finally {
    loading.value = false
  }
}

watch([model, () => props.versionId], cargar)
</script>
