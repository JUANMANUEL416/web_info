<template>
  <div class="donut">
    <svg viewBox="0 0 180 180" role="img" :aria-label="titulo">
      <g transform="rotate(-90 90 90)">
        <circle
          v-for="(seg, i) in segmentos"
          :key="i"
          cx="90"
          cy="90"
          r="62"
          fill="none"
          stroke-width="16"
          :stroke="seg.color"
          :stroke-dasharray="`${seg.largo} ${circunferencia - seg.largo}`"
          :stroke-dashoffset="-seg.inicio"
        />
      </g>
      <text x="90" y="86" text-anchor="middle" class="centro">{{ centro }}</text>
      <text x="90" y="106" text-anchor="middle" class="sub">{{ subtitulo }}</text>
    </svg>
    <ul>
      <li v-for="item in items" :key="item.label">
        <i :style="{ background: item.color }" />
        <span>{{ item.label }}</span>
        <strong>{{ format(item.value) }}</strong>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  titulo: { type: String, default: 'Composición' },
  items: { type: Array, required: true },
  centro: { type: String, default: '' },
  subtitulo: { type: String, default: '' },
  format: { type: Function, default: (valor) => String(valor) },
})

const radio = 62
const circunferencia = 2 * Math.PI * radio

const segmentos = computed(() => {
  const total = props.items.reduce((suma, item) => suma + item.value, 0) || 1
  const hueco = props.items.length > 1 ? 2.5 : 0
  let recorrido = 0
  return props.items.map((item) => {
    const largo = Math.max((item.value / total) * circunferencia - hueco, 0)
    const seg = { ...item, largo, inicio: recorrido }
    recorrido += (item.value / total) * circunferencia
    return seg
  })
})
</script>

<style scoped>
.donut {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 8px 16px;
  align-items: center;
}

.donut svg {
  width: 140px;
  height: 140px;
  font-family: Roboto, sans-serif;
}

.centro {
  fill: #1a2332;
  font-size: 18px;
  font-weight: 600;
}

.sub {
  fill: #7b8794;
  font-size: 11px;
  letter-spacing: 0.04em;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

li {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid #eef1f4;
  color: #5e6a78;
  font-size: 12px;
}

li:last-child {
  border-bottom: 0;
}

li i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

li strong {
  color: #1a2332;
  font-weight: 600;
}

@media (max-width: 700px) {
  .donut {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  ul {
    width: 100%;
  }
}
</style>
