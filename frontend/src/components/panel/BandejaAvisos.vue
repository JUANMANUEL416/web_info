<template>
  <div class="avisos">
    <article
      v-for="aviso in avisos"
      :key="aviso.id"
      class="aviso"
      :class="{ 'aviso--leido': aviso.leida }"
    >
      <span class="aviso__punto" :class="`aviso__punto--${aviso.tono}`" />
      <div class="aviso__cuerpo">
        <router-link :to="aviso.to" class="aviso__titulo" @click="marcarLeida(aviso.id)">
          {{ aviso.titulo }}
        </router-link>
        <p v-if="!compacto">{{ aviso.detalle }}</p>
        <span class="aviso__momento">{{ aviso.momento }}</span>
      </div>
    </article>
    <button v-if="noLeidas" type="button" class="avisos__todas" @click="marcarTodas">
      Marcar todas como leídas
    </button>
  </div>
</template>

<script setup>
import { useNotificaciones } from '../../composables/useNotificaciones.js'

defineProps({
  compacto: { type: Boolean, default: false },
})

const { avisos, noLeidas, marcarLeida, marcarTodas } = useNotificaciones()
</script>

<style scoped>
.avisos {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.aviso {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.aviso--leido {
  opacity: 0.55;
}

.aviso__punto {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  flex: none;
  background: var(--vi-azul);
}

.aviso__punto--aviso {
  background: var(--vi-naranja);
}

.aviso__punto--ok {
  background: var(--vi-verde);
}

.aviso__cuerpo {
  min-width: 0;
}

.aviso__titulo {
  color: #1a2332;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.35;
  text-decoration: none;
}

.aviso__titulo:hover {
  color: #163040;
}

.aviso__cuerpo p {
  margin: 4px 0 0;
  color: #5e6a78;
  font-size: 12.5px;
  line-height: 1.4;
}

.aviso__momento {
  display: block;
  margin-top: 4px;
  color: #8aa0ae;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.avisos__todas {
  align-self: flex-start;
  margin-top: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--vi-azul);
  font-size: 12px;
  letter-spacing: 0.03em;
  cursor: pointer;
}

.avisos__todas:hover {
  color: #163040;
}
</style>
