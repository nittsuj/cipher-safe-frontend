import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { authApi } from '@/api/cipherSafe'
import { setCredentialsProvider, setTokenRefresher } from '@/api/client'
import type { Credentials, User } from '@/types/api'

/**
 * Authentication + cipher state.
 *
 * The access token, refresh token and password all live in memory only; nothing
 * is persisted to storage, so a page reload always requires signing in again.
 * That keeps the password (which derives every encryption key) out of disk.
 */
export const useAuthStore = defineStore('auth', () => {
  const access = ref<string | null>(null)
  const refresh = ref<string | null>(null)
  const user = ref<User | null>(null)
  const password = ref<string | null>(null)

  const isAuthenticated = computed(() => Boolean(access.value && password.value))
  const credentials = computed<Credentials>(() => ({
    access: access.value,
    refresh: refresh.value,
    password: password.value,
  }))

  setCredentialsProvider(() => credentials.value)

  // One in-flight refresh is shared so concurrent 401s do not race and the
  // rotating refresh token is only consumed once.
  let refreshInFlight: Promise<string | null> | null = null

  function refreshAccessToken(): Promise<string | null> {
    if (!refresh.value) return Promise.resolve(null)
    if (!refreshInFlight) {
      const token = refresh.value
      refreshInFlight = authApi
        .refresh(token)
        .then((tokens) => {
          access.value = tokens.access
          if (tokens.refresh) refresh.value = tokens.refresh
          return tokens.access
        })
        .catch(() => {
          clear()
          return null
        })
        .finally(() => {
          refreshInFlight = null
        })
    }
    return refreshInFlight
  }

  setTokenRefresher(refreshAccessToken)

  function setSession(
    response: { user: User; access: string; refresh: string },
    plainPassword: string,
  ) {
    access.value = response.access
    refresh.value = response.refresh
    user.value = response.user
    password.value = plainPassword
  }

  async function login(username: string, plainPassword: string) {
    const response = await authApi.login(username, plainPassword)
    setSession(response, plainPassword)
  }

  async function register(username: string, plainPassword: string) {
    const response = await authApi.register(username, plainPassword)
    setSession(response, plainPassword)
  }

  async function logout() {
    try {
      if (refresh.value) await authApi.logout(refresh.value)
    } catch {
      // Ignore network/auth errors on logout; the local session is cleared anyway.
    } finally {
      clear()
    }
  }

  function clear() {
    access.value = null
    refresh.value = null
    user.value = null
    password.value = null
  }

  return {
    access,
    refresh,
    user,
    password,
    isAuthenticated,
    credentials,
    login,
    register,
    logout,
    clear,
  }
})
