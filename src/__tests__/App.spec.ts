import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import App from '../App.vue'
import { installGuards, routes } from '../router'

function makeRouter(): Router {
  const router = createRouter({ history: createMemoryHistory(), routes })
  installGuards(router)
  return router
}

describe('App', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows the sign-in screen when signed out', async () => {
    const router = makeRouter()
    router.push('/login')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [router] } })
    expect(wrapper.text()).toContain('Sign in')
  })

  it('redirects protected routes to login when signed out', async () => {
    const router = makeRouter()
    await router.push('/files')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('login')
  })
})
