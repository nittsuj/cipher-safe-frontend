<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import AsyncButton from '@/components/AsyncButton.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')

const login = useAsyncAction(async () => {
  await auth.login(username.value, password.value)
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/files'
  router.push(redirect)
}, 'Login failed.')
</script>

<template>
  <div class="container narrow">
    <div class="card">
      <h2>Sign in</h2>
      <p class="muted">
        Your password both authenticates you and derives the encryption keys, so it is kept in
        memory for this session only.
      </p>
      <form @submit.prevent="login.run()">
        <div class="field">
          <label for="username">Username</label>
          <input id="username" v-model="username" autocomplete="username" required />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </div>
        <p v-if="login.error.value" class="error">{{ login.error.value }}</p>
        <AsyncButton
          type="submit"
          :loading="login.loading.value"
          label="Sign in"
          loading-label="Signing in..."
        />
      </form>
      <p class="muted">No account? <RouterLink to="/register">Create one</RouterLink></p>
    </div>
  </div>
</template>

<style scoped>
button {
  width: 100%;
}
</style>
