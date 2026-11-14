import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { authApi, keysApi } from '@/api/cipherSafe'
import { setCredentialsProvider, setTokenRefresher } from '@/api/client'
import type { Credentials, Role, User } from '@/types/api'

/**
 * Authentication + cipher state.
 *
 * The access token, refresh token and password all live in memory only; nothing
 * is persisted to storage, so a page reload always requires signing in again.
 * That keeps the password (which derives every encryption key) out of disk.
 *
 * After signing in it makes sure the user has an **encryption key pair**, once
 * per session and in the background. Someone can only approve a request from
 * this user once that key exists, and the server can't create it without the
 * user's password.
 */
export const useAuthStore = defineStore('auth', () => {
  const access = ref<string | null>(null)
  const refresh = ref<string | null>(null)
  const user = ref<User | null>(null)
  const password = ref<string | null>(null)

  const isAuthenticated = computed(() => Boolean(access.value && password.value))
  const isDoctor = computed(() => user.value?.role === 'DOCTOR')
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

  /** The once-per-session key check; `null` until the user signs in. */
  let encryptionKeyCheck: Promise<void> | null = null

  /** Make sure the user has an encryption key. Best effort: a failure only
   * means approvals wait until the next sign-in, so it never blocks the UI. */
  function ensureEncryptionKey(): Promise<void> {
    encryptionKeyCheck ??= keysApi.ensure('ENCRYPTION').then(
      () => undefined,
      () => {
        encryptionKeyCheck = null // try again next time
      },
    )
    return encryptionKeyCheck
  }

  function setSession(
    response: { user: User; access: string; refresh: string },
    plainPassword: string,
  ) {
    access.value = response.access
    refresh.value = response.refresh
    user.value = response.user
    password.value = plainPassword
    void ensureEncryptionKey()
  }

  async function login(username: string, plainPassword: string) {
    const response = await authApi.login(username, plainPassword)
    setSession(response, plainPassword)
  }

  async function register(username: string, plainPassword: string, role: Role = 'PATIENT') {
    const response = await authApi.register(username, plainPassword, role)
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
    encryptionKeyCheck = null
  }

  return {
    access,
    refresh,
    user,
    password,
    isAuthenticated,
    isDoctor,
    credentials,
    login,
    register,
    logout,
    clear,
    ensureEncryptionKey,
  }
})
