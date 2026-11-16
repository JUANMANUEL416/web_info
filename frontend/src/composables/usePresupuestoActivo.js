import { computed, ref, watch } from 'vue'
import { api } from 'boot/api'

const STORAGE_KEY = 'view_info_presupuesto_id'

const lista = ref([])
const versionId = ref(localStorage.getItem(STORAGE_KEY) ? Number(localStorage.getItem(STORAGE_KEY)) : null)
const contexto = ref(null)
const cargando = ref(false)
const listaLoading = ref(false)
const listaError = ref('')
const apiProxy = import.meta.env.VITE_API_PROXY || 'http://localhost:3025'
const apiBase = import.meta.env.VITE_API_URL || '/api'

async function cargarContexto() {
  if (!versionId.value) {
    contexto.value = null
    return
  }
  cargando.value = true
  try {
    const { data } = await api.get(`/presupuestos/${versionId.value}/contexto`)
    contexto.value = data
  } catch {
    contexto.value = null
  } finally {
    cargando.value = false
  }
}

async function cargarLista() {
  listaLoading.value = true
  listaError.value = ''
  try {
    const { data } = await api.get('/presupuestos')
    lista.value = Array.isArray(data) ? data : []
    if (!versionId.value && lista.value.length) {
      const vigente = lista.value.find((p) => p.es_vigente) || lista.value[0]
      await seleccionar(vigente.id)
    } else if (versionId.value) {
      await cargarContexto()
    }
  } catch (err) {
    lista.value = []
    listaError.value =
      err.response?.data?.error ||
      err.message ||
      `No se pudo conectar al API (${apiBase} → ${apiProxy}). Verifique que el servicio backend esté activo.`
  } finally {
    listaLoading.value = false
  }
}

async function seleccionar(id) {
  versionId.value = id ? Number(id) : null
  if (versionId.value) {
    localStorage.setItem(STORAGE_KEY, String(versionId.value))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
  await cargarContexto()
}

let watchInicializado = false

export function usePresupuestoActivo() {
  if (!watchInicializado) {
    watch(versionId, () => {
      cargarContexto()
    })
    watchInicializado = true
  }

  const presupuestoLabel = computed(() => {
    if (!contexto.value) return 'Seleccione presupuesto'
    return `${contexto.value.codigo} — ${contexto.value.nombre} (${contexto.value.anio})`
  })

  const tienePresupuesto = computed(() => Boolean(versionId.value))

  return {
    lista,
    versionId,
    contexto,
    cargando,
    listaLoading,
    listaError,
    apiBase,
    presupuestoLabel,
    tienePresupuesto,
    cargarLista,
    seleccionar,
    cargarContexto,
  }
}
