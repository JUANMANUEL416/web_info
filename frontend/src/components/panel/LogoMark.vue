<template>
  <div class="logo-mark-wrap">
    <img
      v-if="!imgFailed"
      src="/logo-clinica-esperanza.jpg"
      alt="Clínica Esperanza"
      class="logo-mark-img"
      @error="imgFailed = true"
    />
    <!-- Vector SVG exact representation of the Clínica Esperanza C + E+ icon -->
    <svg v-else class="logo-mark" viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="20" fill="#f8fafc" />
      <!-- Outer C -->
      <path
        d="M75 22 H36 C24 22 16 30 16 42 V58 C16 70 24 78 36 78 H75 V66 H38 C32 66 28 62 28 56 V44 C28 38 32 34 38 34 H75 Z"
        fill="#0072CE"
      />
      <!-- Inner E middle bar and + -->
      <rect x="28" y="44" width="28" height="12" fill="#0072CE" />
      <!-- Cyan Plus -->
      <rect x="62" y="38" width="10" height="24" rx="2" fill="#00B5E2" />
      <rect x="55" y="45" width="24" height="10" rx="2" fill="#00B5E2" />
    </svg>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const imgFailed = ref(false)
</script>

<style scoped>
.logo-mark-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo-mark-img {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  background: #ffffff;
}
.logo-mark {
  display: block;
  width: 38px;
  height: 38px;
}
</style>
