import { boot } from 'quasar/wrappers'
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
})

export default boot(({ app }) => {
  app.config.globalProperties.$api = api
})

export { api }
