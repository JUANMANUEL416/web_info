import { computed, ref } from 'vue'
import { api } from 'boot/api'
import { fichaRespaldo } from '../data/demoPresentacion.js'

const ficha = ref(null)
const origen = ref('respaldo')
let carga = null

export function useFichaEmpresa() {
  function cargar() {
    if (ficha.value && origen.value === 'base') return Promise.resolve(ficha.value)
    if (!carga) {
      carga = api
        .get('/presentacion/empresa')
        .then(({ data }) => {
          if (data?.razon_social) {
            ficha.value = data
            origen.value = 'base'
          } else {
            ficha.value = { ...fichaRespaldo }
            origen.value = 'respaldo'
          }
          return ficha.value
        })
        .catch(() => {
          ficha.value = { ...fichaRespaldo }
          origen.value = 'respaldo'
          return ficha.value
        })
        .finally(() => {
          carga = null
        })
    }
    return carga
  }

  const empresa = computed(() => ficha.value || fichaRespaldo)
  const desdeBase = computed(() => origen.value === 'base')

  return { empresa, desdeBase, cargar }
}
