<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import AsyncButton from '@/components/AsyncButton.vue'
import AuthShell from '@/components/AuthShell.vue'
import { FormError } from '@/api/client'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useAuthStore } from '@/stores/auth'
import type { Role } from '@/types/api'

const auth = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const confirm = ref('')
const role = ref<Role>('PATIENT')

const register = useAsyncAction(async () => {
  if (password.value !== confirm.value) throw new FormError('The two passwords are different.')
  await auth.register(username.value, password.value, role.value)
  router.push(role.value === 'DOCTOR' ? '/requests' : '/files')
}, 'Could not create the account. Check your connection and try again.')
</script>

<template>
  <AuthShell title="Create an account">
    <form @submit.prevent="register.run()">
      <fieldset class="roles">
        <legend class="label">I am a</legend>
        <label class="role" :class="{ on: role === 'PATIENT' }">
          <input v-model="role" type="radio" name="role" value="PATIENT" />
          <span>
            Patient
            <span class="hint">Keep and share my own records</span>
          </span>
        </label>
        <label class="role" :class="{ on: role === 'DOCTOR' }">
          <input v-model="role" type="radio" name="role" value="DOCTOR" />
          <span>
            Doctor
            <span class="hint">Ask patients for their records</span>
          </span>
        </label>
      </fieldset>

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
.roles {
  border: 0;
  padding: 0;
  margin: 0 0 1.1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.roles legend {
  grid-column: 1 / -1;
}

.role {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin: 0;
  padding: 0.7rem 0.8rem;
  border: 1.5px solid var(--line-strong);
  border-radius: var(--radius-control);
  cursor: pointer;
}

.role.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.role input {
  width: auto;
  min-height: 0;
  margin-top: 0.3rem;
  accent-color: var(--accent);
}

.full {
  width: 100%;
}

.switch {
  margin: 1.25rem 0 0;
}
</style>
