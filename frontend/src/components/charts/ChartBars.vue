<template>
  <div class="barras" role="img" :aria-label="titulo">
    <div v-for="item in items" :key="item.label" class="fila">
      <div class="meta">
        <span :title="item.label">{{ item.label }}</span>
        <strong>{{ format(item.value) }}</strong>
      </div>
      <div class="pista">
        <div class="relleno" :style="{ width: `${ancho(item.value)}%`, background: item.color || '#163040' }" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  titulo: { type: String, default: 'Barras' },
  items: { type: Array, required: true },
  format: { type: Function, default: (valor) => String(valor) },
})

const mayor = computed(() => Math.max(...props.items.map((item) => item.value), 1))

function ancho(valor) {
  return Math.max((valor / mayor.value) * 100, valor > 0 ? 2 : 0)
}
</script>

<style scoped>
.fila + .fila {
  margin-top: 8px;
}

.meta {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 3px;
  color: #64748b;
  font-size: 11px;
}

.meta span {
  flex: 1;
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.25;
  word-break: break-word;
}

.meta strong {
  color: #0b3b60;
  font-weight: 700;
  flex-shrink: 0;
  font-size: 11px;
}

.pista {
  height: 7px;
  background: #e2e8f0;
  border-radius: 99px;
  overflow: hidden;
}

.relleno {
  height: 100%;
  border-radius: inherit;
}
</style>
