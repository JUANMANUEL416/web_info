<template>
  <q-page padding>
    <div class="text-h6 q-mb-md">Presupuestos</div>
    <p class="text-body2 text-grey-7 q-mb-lg">
      Elija la versión con la que trabajará; el selector del encabezado aplica el filtro en todo el sistema.
    </p>

    <q-banner v-if="listaError" class="bg-red-1 text-negative q-mb-md" rounded>
      {{ listaError }}
      <template #action>
        <q-btn flat color="primary" label="Reintentar" @click="cargarLista" />
      </template>
    </q-banner>

    <q-table
      flat
      bordered
      :rows="lista"
      :columns="columnas"
      row-key="id"
      :loading="listaLoading"
      no-data-label="No hay presupuestos cargados"
    >
      <template #body-cell-accion="props">
        <q-td :props="props">
          <q-btn
            size="sm"
            :color="Number(versionId) === Number(props.row.id) ? 'positive' : 'primary'"
            :label="Number(versionId) === Number(props.row.id) ? 'Activo' : 'Usar'"
            flat
            @click="seleccionar(props.row.id)"
          />
        </q-td>
      </template>
    </q-table>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { usePresupuestoActivo } from '../composables/usePresupuestoActivo.js'

const { lista, versionId, listaLoading, listaError, cargarLista, seleccionar } = usePresupuestoActivo()

const columnas = [
  { name: 'codigo', label: 'Código', field: 'codigo', align: 'left' },
  { name: 'nombre', label: 'Nombre', field: 'nombre', align: 'left' },
  { name: 'anio', label: 'Año', field: 'anio', align: 'left' },
  { name: 'estado', label: 'Estado', field: 'estado', align: 'left' },
  { name: 'es_vigente', label: 'Vigente', field: (r) => (r.es_vigente ? 'Sí' : 'No'), align: 'left' },
  { name: 'accion', label: '', field: 'accion', align: 'right' },
]

onMounted(() => {
  if (!lista.value.length) cargarLista()
})
</script>
