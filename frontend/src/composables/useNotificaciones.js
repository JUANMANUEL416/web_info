import { computed, ref } from 'vue'
import { avisosIniciales } from '../data/demoPresentacion.js'

const avisos = ref(avisosIniciales.map((aviso) => ({ ...aviso })))

export function useNotificaciones() {
  const noLeidas = computed(() => avisos.value.filter((aviso) => !aviso.leida).length)

  function marcarLeida(id) {
    const aviso = avisos.value.find((item) => item.id === id)
    if (aviso) aviso.leida = true
  }

  function marcarTodas() {
    avisos.value.forEach((aviso) => {
      aviso.leida = true
    })
  }

  return { avisos, noLeidas, marcarLeida, marcarTodas }
}
