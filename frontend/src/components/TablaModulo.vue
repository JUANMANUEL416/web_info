<template>
  <q-table
    flat
    bordered
    :title="title"
    :rows="rowsWithKey"
    :columns="cols"
    row-key="rowKey"
    :loading="loading"
    :pagination="{ rowsPerPage: 15 }"
    no-data-label="Sin registros para este presupuesto"
  />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const rowsWithKey = computed(() => props.rows.map((r, i) => ({ ...r, rowKey: i })))

const cols = computed(() => {
  if (!props.rows.length) return []
  return Object.keys(props.rows[0]).map((name) => ({
    name,
    label: name.replaceAll('_', ' '),
    field: name,
    align: typeof props.rows[0][name] === 'number' ? 'right' : 'left',
    format: (v) => formatVal(name, v),
  }))
})

function formatVal(name, val) {
  if (val == null) return '—'
  if (typeof val === 'number' && !name.includes('mes') && !String(name).endsWith('id')) {
    if (name.includes('margen')) return `${(val * 100).toFixed(1)} %`
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(val)
  }
  return val
}
</script>
