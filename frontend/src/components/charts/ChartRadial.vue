<template>
  <article class="radial">
    <svg viewBox="0 0 120 120" role="img" :aria-label="etiqueta">
      <circle cx="60" cy="60" r="46" fill="none" stroke="#e7edf1" stroke-width="8" />
      <circle
        cx="60"
        cy="60"
        r="46"
        fill="none"
        :stroke="color"
        stroke-width="8"
        stroke-linecap="round"
        :stroke-dasharray="`${largo} ${circunferencia}`"
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="64" text-anchor="middle" class="valor">{{ valorTexto }}</text>
    </svg>
    <div>
      <h3>{{ etiqueta }}</h3>
      <p>{{ detalle }}</p>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  valor: { type: Number, required: true },
  maximo: { type: Number, default: 100 },
  valorTexto: { type: String, required: true },
  etiqueta: { type: String, required: true },
  detalle: { type: String, default: '' },
  color: { type: String, default: '#163040' },
})

const radio = 46
const circunferencia = 2 * Math.PI * radio
const largo = computed(() => {
  const parte = Math.min(Math.max(props.valor / props.maximo, 0), 1)
  return parte * circunferencia
})
</script>

<style scoped>
.radial {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 108px;
}

svg {
  width: 96px;
  height: 96px;
  flex: none;
  font-family: Roboto, sans-serif;
}

.valor {
  fill: #1a2332;
  font-size: 15px;
  font-weight: 600;
}

h3 {
  margin: 0;
  color: #1a2332;
  font-size: 14px;
  font-weight: 600;
}

p {
  margin: 4px 0 0;
  color: #5e6a78;
  font-size: 12.5px;
  line-height: 1.4;
}
</style>
