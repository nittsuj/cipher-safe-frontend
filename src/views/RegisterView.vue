<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import AsyncButton from '@/components/AsyncButton.vue'
import AuthShell from '@/components/AuthShell.vue'
import { FormError } from '@/api/client'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const confirm = ref('')

const register = useAsyncAction(async () => {
  if (password.value !== confirm.value) throw new FormError('The two passwords are different.')
  await auth.register(username.value, password.value)
  router.push('/files')
}, 'Could not create the account. Check your connection and try again.')
</script>

<template>
  <AuthShell title="Create an account">
    <form @submit.prevent="register.run()">
      <div class="field">
        <label for="username">Username</label>
        <input id="username" v-model="username" autocomplete="username" required />
      </div>
      <div class="field">
        <label for="password">
          Password
          <span class="hint">At least 8 characters. It also locks your records, so it can't be reset.</span>
        </label>
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
        <label for="confirm">Type it again</label>
        <input id="confirm" v-model="confirm" type="password" autocomplete="new-password" required />
      </div>
      <p v-if="register.error.value" class="notice error" role="alert">{{ register.error.value }}</p>
      <AsyncButton
        type="submit"
        class="full"
        :loading="register.loading.value"
        label="Create account"
        loading-label="Creating…"
      />
    </form>
    <p class="switch">Already have one? <RouterLink to="/login">Sign in</RouterLink></p>
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
