<template>
  <q-page padding>
    <PresupuestoRequerido />
    <template v-if="tienePresupuesto">
      <div class="row items-center q-mb-md q-gutter-sm">
        <div class="text-h6 col">Rubros — {{ presupuestoLabel }}</div>
        <q-btn outline color="primary" icon="table_chart" label="Ver tabla homologación" @click="dialogTabla = true" />
      </div>

      <q-table
        flat
        bordered
        :rows="rubros"
        :columns="columnas"
        row-key="id"
        :loading="loading"
      >
        <template #body-cell-acciones="props">
          <q-td :props="props">
            <q-btn flat dense color="primary" icon="edit" @click="abrirEdicion(props.row)" />
          </q-td>
        </template>
      </q-table>

      <q-dialog v-model="dialogEdit" persistent>
        <q-card style="min-width: 420px">
          <q-card-section>
            <div class="text-h6">Rubro — homologación contable</div>
            <div class="text-caption text-grey-7">{{ edit.codigo }} · {{ edit.nombre }}</div>
          </q-card-section>
          <q-card-section class="q-gutter-md">
            <q-select
              v-model="edit.cuenta_contable_id"
              :options="cuentas"
              option-value="id"
              option-label="label"
              emit-value
              map-options
              label="Cuenta contable"
              outlined
              dense
            />
            <q-input v-model.number="edit.porcentaje" type="number" label="Porcentaje (%)" outlined dense min="0" max="100" />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Cancelar" v-close-popup />
            <q-btn color="primary" label="Guardar" :loading="guardando" @click="guardar" />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <HomologacionTablaDialog v-model="dialogTabla" :version-id="versionId" />
    </template>
  </q-page>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { api } from 'boot/api'
import PresupuestoRequerido from 'components/PresupuestoRequerido.vue'
import HomologacionTablaDialog from 'components/HomologacionTablaDialog.vue'
import { usePresupuestoActivo } from '../composables/usePresupuestoActivo.js'

const { versionId, tienePresupuesto, presupuestoLabel } = usePresupuestoActivo()

const loading = ref(false)
const guardando = ref(false)
const rubros = ref([])
const cuentas = ref([])
const dialogEdit = ref(false)
const dialogTabla = ref(false)
const edit = ref({ id: null, codigo: '', nombre: '', cuenta_contable_id: null, porcentaje: 100 })

const columnas = [
  { name: 'codigo', label: 'Código', field: 'codigo', align: 'left' },
  { name: 'nombre', label: 'Nombre', field: 'nombre', align: 'left' },
  { name: 'tipo', label: 'Tipo', field: 'tipo', align: 'left' },
  { name: 'cuenta_codigo', label: 'Cuenta', field: 'cuenta_codigo', align: 'left' },
  { name: 'cuenta_nombre', label: 'Nombre cuenta', field: 'cuenta_nombre', align: 'left' },
  { name: 'porcentaje', label: '%', field: 'porcentaje', align: 'right' },
  { name: 'acciones', label: '', field: 'acciones', align: 'right' },
]

async function cargar() {
  if (!versionId.value) return
  loading.value = true
  try {
    const { data } = await api.get('/rubros', { params: { version_id: versionId.value } })
    rubros.value = data.rubros
    const { data: cta } = await api.get('/rubros/cuentas', { params: { version_id: versionId.value } })
    cuentas.value = cta.map((c) => ({ id: c.id, label: `${c.codigo} — ${c.nombre}` }))
  } finally {
    loading.value = false
  }
}

function abrirEdicion(row) {
  edit.value = {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    cuenta_contable_id: row.cuenta_contable_id,
    porcentaje: row.porcentaje ?? 100,
  }
  dialogEdit.value = true
}

async function guardar() {
  guardando.value = true
  try {
    await api.put(`/rubros/${edit.value.id}/homologacion`, {
      cuenta_contable_id: edit.value.cuenta_contable_id,
      porcentaje: edit.value.porcentaje,
    })
    dialogEdit.value = false
    await cargar()
  } finally {
    guardando.value = false
  }
}

onMounted(cargar)
watch(versionId, cargar)
</script>
