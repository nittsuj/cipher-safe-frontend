<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import AsyncButton from '@/components/AsyncButton.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const confirm = ref('')

const register = useAsyncAction(async () => {
  if (password.value !== confirm.value) throw new Error('Passwords do not match.')
  await auth.register(username.value, password.value)
  router.push('/files')
}, 'Registration failed.')
</script>

<template>
  <div class="container narrow">
    <div class="card">
      <h2>Create account</h2>
      <form @submit.prevent="register.run()">
        <div class="field">
          <label for="username">Username</label>
          <input id="username" v-model="username" autocomplete="username" required />
        </div>
        <div class="field">
          <label for="password">Password (min 8 characters)</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            minlength="8"
            required
          />
        </div>
        <div class="field">
          <label for="confirm">Confirm password</label>
          <input id="confirm" v-model="confirm" type="password" autocomplete="new-password" required />
        </div>
        <p v-if="register.error.value" class="error">{{ register.error.value }}</p>
        <AsyncButton
          type="submit"
          :loading="register.loading.value"
          label="Create account"
          loading-label="Creating..."
        />
      </form>
      <p class="muted">Already registered? <RouterLink to="/login">Sign in</RouterLink></p>
    </div>
  </div>
</template>

<style scoped>
button {
  width: 100%;
}
</style>
