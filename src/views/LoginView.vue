<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import AsyncButton from '@/components/AsyncButton.vue'
import AuthShell from '@/components/AuthShell.vue'
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
}, 'Could not sign in. Check your connection and try again.')
</script>

<template>
  <AuthShell title="Sign in">
    <p v-if="route.query.redirect" class="notice info small">
      You were signed out because the page was reloaded. Your password is only kept while this tab
      is open.
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
      <p v-if="login.error.value" class="notice error" role="alert">{{ login.error.value }}</p>
      <AsyncButton
        type="submit"
        class="full"
        :loading="login.loading.value"
        label="Sign in"
        loading-label="Signing in…"
      />
    </form>
    <p class="switch">New here? <RouterLink to="/register">Create an account</RouterLink></p>
  </AuthShell>
</template>

<style scoped>
.full {
  width: 100%;
}

.switch {
  margin: 1.25rem 0 0;
}
</style>
