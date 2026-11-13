import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

async function enableMocking(): Promise<void> {
  // Dev-only mock API (`pnpm dev:mock`); the import is dropped from builds.
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK === 'true') {
    const { startMockApi } = await import('./mocks/browser')
    await startMockApi()
  }
}

enableMocking().then(() => app.mount('#app'))
