<template>
  <div class="chart">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="titulo">
      <text class="eje" :x="pad.l" y="14">{{ unidad }}</text>
      <line
        v-for="(tick, i) in yTicks"
        :key="`g-${i}`"
        class="grid"
        :x1="pad.l"
        :x2="W - pad.r"
        :y1="y(tick)"
        :y2="y(tick)"
      />
      <text
        v-for="(tick, i) in yTicks"
        :key="`t-${i}`"
        class="eje"
        :x="pad.l - 8"
        :y="y(tick) + 3"
        text-anchor="end"
      >
        {{ eje(tick) }}
      </text>
      <path v-if="series[0]" class="area" :d="area(series[0].values)" :fill="series[0].color" />
      <path
        v-for="serie in series"
        :key="serie.name"
        :d="linea(serie.values)"
        fill="none"
        :stroke="serie.color"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <g v-for="serie in series" :key="`p-${serie.name}`">
        <circle
          v-for="(valor, i) in serie.values"
          :key="i"
          :cx="x(i)"
          :cy="y(valor)"
          r="3.4"
          :fill="serie.color"
          @mouseenter="activo = { nombre: serie.name, i, valor }"
          @mouseleave="activo = null"
        />
      </g>
      <text
        v-for="(categoria, i) in categories"
        :key="`c-${i}`"
        class="eje"
        :x="x(i)"
        :y="H - 8"
        text-anchor="middle"
      >
        {{ categoria }}
      </text>
    </svg>
    <div class="pie">
      <span v-for="serie in series" :key="serie.name" class="leyenda">
        <i :style="{ background: serie.color }" />{{ serie.name }}
      </span>
      <span v-if="activo" class="lectura">
        {{ activo.nombre }} · {{ categories[activo.i] }} · {{ format(activo.valor) }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { millones } from '../../utils/formato.js'

const props = defineProps({
  titulo: { type: String, default: 'Serie' },
  categories: { type: Array, required: true },
  series: { type: Array, required: true },
  unidad: { type: String, default: 'Millones' },
  format: { type: Function, default: (valor) => String(valor) },
  enMillones: { type: Boolean, default: true },
})

const W = 720
const H = 175
const pad = { l: 44, r: 14, t: 18, b: 24 }
const activo = ref(null)

const maximo = computed(() => {
  const valores = props.series.flatMap((serie) => serie.values)
  const mayor = Math.max(...valores, 0)
  return mayor === 0 ? 1 : mayor * 1.15
})

const yTicks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((parte) => maximo.value * parte))

function x(indice) {
  const n = Math.max(props.categories.length - 1, 1)
  return pad.l + (indice / n) * (W - pad.l - pad.r)
}

function y(valor) {
  const alto = H - pad.t - pad.b
  return pad.t + alto - (valor / maximo.value) * alto
}

function linea(valores) {
  return valores
    .map((valor, indice) => `${indice === 0 ? 'M' : 'L'} ${x(indice).toFixed(1)} ${y(valor).toFixed(1)}`)
    .join(' ')
}

function area(valores) {
  const base = y(0)
  const ultimo = x(valores.length - 1)
  return `${linea(valores)} L ${ultimo.toFixed(1)} ${base.toFixed(1)} L ${x(0).toFixed(1)} ${base.toFixed(1)} Z`
}

function eje(valor) {
  if (!props.enMillones) {
    const n = Number(valor)
    return n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace('.', ',')
  }
  return millones(valor)
}
</script>

<style scoped>
.chart svg {
  width: 100%;
  height: auto;
  font-family: Roboto, sans-serif;
}

.grid {
  stroke: #e6ebef;
  stroke-width: 1;
}

.eje {
  fill: #7b8794;
  font-size: 11px;
}

.area {
  opacity: 0.12;
}

circle {
  cursor: crosshair;
}

.pie {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  min-height: 22px;
  margin-top: 4px;
}

.leyenda {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: #5e6a78;
  font-size: 12px;
}

.leyenda i {
  width: 14px;
  height: 3px;
  border-radius: 2px;
}

.lectura {
  margin-left: auto;
  color: #1a2332;
  font-size: 12px;
  font-weight: 600;
}
</style>
