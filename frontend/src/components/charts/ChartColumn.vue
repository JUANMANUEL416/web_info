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
        {{ millones(tick) }}
      </text>
      <g v-for="(serie, si) in series" :key="serie.name">
        <rect
          v-for="(valor, i) in serie.values"
          :key="i"
          :x="barraX(i, si)"
          :y="y(valor)"
          :width="ancho"
          :height="Math.max(y(0) - y(valor), 0)"
          :fill="serie.colores?.[i] || serie.color"
          rx="2"
          @mouseenter="activo = { nombre: serie.name, i, valor }"
          @mouseleave="activo = null"
        />
      </g>
      <text
        v-for="(categoria, i) in categories"
        :key="`c-${i}`"
        class="eje"
        :x="centro(i)"
        :y="H - 8"
        text-anchor="middle"
      >
        {{ categoria }}
      </text>
    </svg>
    <div class="pie">
      <template v-for="serie in series" :key="serie.name">
        <span v-if="!serie.colores" class="leyenda">
          <i :style="{ background: serie.color }" />{{ serie.name }}
        </span>
      </template>
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
  titulo: { type: String, default: 'Barras' },
  categories: { type: Array, required: true },
  series: { type: Array, required: true },
  unidad: { type: String, default: 'Millones' },
  format: { type: Function, default: (valor) => String(valor) },
})

const W = 720
const H = 250
const pad = { l: 48, r: 12, t: 28, b: 32 }
const activo = ref(null)

const maximo = computed(() => {
  const mayor = Math.max(...props.series.flatMap((serie) => serie.values), 0)
  return mayor === 0 ? 1 : mayor * 1.15
})

const yTicks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((parte) => maximo.value * parte))

const ancho = computed(() => {
  const slot = (W - pad.l - pad.r) / Math.max(props.categories.length, 1)
  const grupo = slot * 0.62
  return Math.min(22, grupo / Math.max(props.series.length, 1) - 3)
})

function y(valor) {
  const alto = H - pad.t - pad.b
  return pad.t + alto - (valor / maximo.value) * alto
}

function barraX(indice, serie) {
  const slot = (W - pad.l - pad.r) / Math.max(props.categories.length, 1)
  const n = props.series.length
  const grupo = ancho.value * n + 4 * (n - 1)
  const inicio = pad.l + indice * slot + (slot - grupo) / 2
  return inicio + serie * (ancho.value + 4)
}

function centro(indice) {
  const slot = (W - pad.l - pad.r) / Math.max(props.categories.length, 1)
  return pad.l + indice * slot + slot / 2
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

rect {
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
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.lectura {
  margin-left: auto;
  color: #1a2332;
  font-size: 12px;
  font-weight: 600;
}
</style>
