<template>
  <q-banner v-if="!tienePresupuesto" class="bg-amber-1 text-dark q-mb-md" rounded>
    Seleccione un <strong>presupuesto</strong> en la barra superior. Todos los módulos se filtran por esa versión.
  </q-banner>
</template>

<script setup>
import { usePresupuestoActivo } from '../composables/usePresupuestoActivo.js'

const { tienePresupuesto } = usePresupuestoActivo()
</script>
