<template>
  <header class="encabezado">
    <div>
      <router-link to="/" class="volver">Panel</router-link>
      <p class="kicker">{{ kicker || 'Clínica Esperanza · Tablero Directivo' }}</p>
      <h1>{{ titulo }}</h1>
      <p class="sub">{{ subtitulo }}</p>
    </div>
  </header>
</template>

<script setup>
defineProps({
  titulo: { type: String, required: true },
  subtitulo: { type: String, default: '' },
  kicker: { type: String, default: '' },
})
</script>

<style scoped>
.encabezado {
  margin-bottom: 6px;
}

.volver {
  color: #0072CE;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
}

.volver:hover {
  color: #0B3B60;
}

.kicker {
  margin: 1px 0 0;
  color: #0072CE;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

h1 {
  margin: 1px 0 0;
  color: #0B3B60;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.sub {
  max-width: 850px;
  margin: 1px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.25;
}
</style>
