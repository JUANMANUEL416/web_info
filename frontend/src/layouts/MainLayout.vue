<template>
  <q-layout view="lHh Lpr lFf">
    <q-header class="cabecera">
      <q-toolbar class="q-px-md" style="min-height: 48px;">
        <q-btn flat dense round icon="menu" aria-label="Menú" color="white" @click="toggleLeftDrawer" />
        <div class="marca">
          <LogoMark />
          <div>
            <div class="marca__nombre">View Info</div>
            <div class="marca__empresa">{{ empresa.razon_social }}</div>
          </div>
        </div>
        <q-space />
        <q-select
          v-if="muestraPresupuesto"
          :model-value="versionId"
          :options="opcionesPresupuesto"
          option-value="id"
          option-label="label"
          emit-value
          map-options
          dense
          dark
          outlined
          class="presupuesto-select q-mr-sm gt-sm"
          label="Presupuesto activo"
          style="min-width: 260px"
          @update:model-value="seleccionar"
        />
        <q-btn flat round icon="notifications_none" aria-label="Notificaciones" color="white" size="sm">
          <q-badge v-if="noLeidas" floating class="badge-aviso" :label="noLeidas" />
          <q-menu anchor="bottom right" self="top right" :offset="[0, 8]">
            <div class="menu-avisos">
              <div class="menu-avisos__titulo">Notificaciones</div>
              <BandejaAvisos compacto />
            </div>
          </q-menu>
        </q-btn>
        <q-btn flat no-caps class="usuario-btn" aria-label="Usuario" size="sm">
          <q-avatar size="26px" class="avatar">{{ siglaUsuario }}</q-avatar>
          <span class="gt-sm usuario-nombre">{{ empresa.usuario_nombre }}</span>
          <q-menu anchor="bottom right" self="top right" :offset="[0, 8]">
            <div class="menu-usuario">
              <q-avatar size="38px" class="avatar">{{ siglaUsuario }}</q-avatar>
              <div>
                <strong>{{ empresa.usuario_nombre }}</strong>
                <span>{{ empresa.usuario_email }}</span>
                <span>Clínica Esperanza · Producción</span>
              </div>
            </div>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered :width="235" class="cajon">
      <q-scroll-area class="fit">
        <div class="cajon-marca">
          <span class="monograma">{{ siglaEmpresa }}</span>
          <div>
            <strong>{{ empresa.razon_social }}</strong>
            <span>NIT {{ nitEmpresa }}</span>
          </div>
        </div>
        <q-list dense padding>
          <q-item clickable v-ripple to="/" exact active-class="nav-activo">
            <q-item-section avatar><q-icon name="dashboard" /></q-item-section>
            <q-item-section><q-item-label>Panel</q-item-label></q-item-section>
          </q-item>

          <q-item-label header class="grupo">Tableros</q-item-label>
          <q-item
            v-for="item in tableros"
            :key="item.to"
            clickable
            v-ripple
            :to="item.to"
            exact
            active-class="nav-activo"
          >
            <q-item-section avatar><q-icon :name="item.icon" /></q-item-section>
            <q-item-section>
              <q-item-label>{{ item.label }}</q-item-label>
            </q-item-section>
          </q-item>

          <q-item-label header class="grupo">Presupuesto</q-item-label>
          <q-item
            v-for="item in presupuesto"
            :key="item.to"
            clickable
            v-ripple
            :to="item.to"
            exact
            active-class="nav-activo"
          >
            <q-item-section avatar><q-icon :name="item.icon" /></q-item-section>
            <q-item-section><q-item-label>{{ item.label }}</q-item-label></q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import LogoMark from '../components/panel/LogoMark.vue'
import BandejaAvisos from '../components/panel/BandejaAvisos.vue'
import { usePresupuestoActivo } from '../composables/usePresupuestoActivo.js'
import { useFichaEmpresa } from '../composables/useFichaEmpresa.js'
import { useNotificaciones } from '../composables/useNotificaciones.js'
import { corteTexto } from '../data/demoPresentacion.js'
import { iniciales, nit } from '../utils/formato.js'

const route = useRoute()
const leftDrawerOpen = ref(false)
const { lista, versionId, cargarLista, seleccionar } = usePresupuestoActivo()
const { empresa, cargar } = useFichaEmpresa()
const { noLeidas } = useNotificaciones()

const rutasPresupuesto = ['/presupuestos', '/rubros', '/parametros', '/proyeccion', '/movimientos', '/balance', '/ejecucion']

const muestraPresupuesto = computed(() => rutasPresupuesto.includes(route.path))
const esDemo = computed(() => route.meta.demo === true)
const siglaUsuario = computed(() => iniciales(empresa.value.usuario_nombre))
const siglaEmpresa = computed(() => iniciales(empresa.value.razon_social))
const nitEmpresa = computed(() => nit(empresa.value.nit))

const opcionesPresupuesto = computed(() =>
  lista.value.map((p) => ({
    id: p.id,
    label: `${p.codigo} · ${p.nombre} (${p.anio})`,
  })),
)

const tableros = [
  { to: '/facturacion', icon: 'receipt', label: 'Facturación y ventas' },
  { to: '/cartera', icon: 'account_balance_wallet', label: 'Cartera' },
  { to: '/cuentas-por-pagar', icon: 'credit_card', label: 'Cuentas por pagar' },
  { to: '/indicadores', icon: 'insights', label: 'Indicadores' },
  { to: '/proyecciones', icon: 'trending_up', label: 'Proyecciones' },
]

const presupuesto = [
  { to: '/presupuestos', icon: 'folder', label: 'Presupuestos' },
  { to: '/rubros', icon: 'account_tree', label: 'Rubros' },
  { to: '/parametros', icon: 'tune', label: 'Parámetros' },
  { to: '/proyeccion', icon: 'trending_up', label: 'Proyección' },
  { to: '/movimientos', icon: 'swap_horiz', label: 'Movimientos' },
  { to: '/balance', icon: 'account_balance', label: 'Balance' },
  { to: '/ejecucion', icon: 'analytics', label: 'Ejecución' },
]

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

onMounted(() => {
  cargar()
  if (!lista.value.length) cargarLista()
})
</script>

<style scoped>
.cabecera {
  background: linear-gradient(90deg, #0B3B60 0%, #0066B2 100%);
  color: #ffffff;
  border-bottom: 2px solid #00B5E2;
}

.marca {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
  margin-left: 6px;
}

.marca > div {
  min-width: 0;
}

.marca :deep(.logo-mark) {
  width: 34px;
  height: 34px;
}

.marca__nombre {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.1;
  color: #ffffff;
}

.marca__empresa {
  max-width: 280px;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.usuario-btn {
  color: #ffffff;
}

.usuario-nombre {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 500;
}

.badge-aviso {
  background: #00B5E2;
  color: #fff;
}

.avatar {
  background: #0072CE;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
}

.franja {
  padding: 6px 20px 8px;
  background: #0B3B60;
  color: #00B5E2;
  font-size: 12px;
  letter-spacing: 0.04em;
}

.cajon {
  background: #f7f9fc;
}

.cajon-marca {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 18px 16px 8px;
}

.cajon-marca strong,
.cajon-marca span {
  display: block;
}

.cajon-marca strong {
  color: #0B3B60;
  font-size: 14px;
  font-weight: 700;
}

.cajon-marca span {
  color: #7b8794;
  font-size: 12px;
}

.monograma {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  background: #0072CE;
  color: #ffffff;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  flex: none;
}

.grupo {
  color: #0072CE;
  font-size: 11px;
  letter-spacing: 0.08em;
  font-weight: 700;
  text-transform: uppercase;
}

.nav-activo {
  background: #e8f4fc;
  color: #0072CE;
  box-shadow: inset 4px 0 0 #0072CE;
  font-weight: 600;
}

.presupuesto-select :deep(.q-field__control) {
  background: rgba(255, 255, 255, 0.08);
}

.menu-avisos {
  width: min(380px, 86vw);
  padding: 16px 16px 12px;
}

.menu-avisos__titulo {
  margin-bottom: 12px;
  color: #1a2332;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.menu-usuario {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 280px;
  padding: 16px;
}

.menu-usuario strong,
.menu-usuario span {
  display: block;
}

.menu-usuario strong {
  color: #1a2332;
  font-size: 14px;
}

.menu-usuario span {
  color: #5e6a78;
  font-size: 12.5px;
}
</style>
