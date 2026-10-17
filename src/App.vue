<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const links = computed(() => [
  { to: '/files', label: 'Files' },
  { to: '/personal-data', label: 'Personal data' },
  { to: '/analysis', label: 'Analysis' },
])

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-inner">
      <RouterLink to="/files" class="brand">Cipher Safe</RouterLink>
      <nav v-if="auth.isAuthenticated" class="nav">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to">
          {{ link.label }}
        </RouterLink>
      </nav>
      <div v-if="auth.isAuthenticated" class="session">
        <span class="muted">{{ auth.user?.username }}</span>
        <button class="secondary" @click="handleLogout">Log out</button>
      </div>
    </div>
  </header>

  <main>
    <RouterView />
  </main>
</template>

<style scoped>
.topbar {
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.topbar-inner {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.brand {
  font-weight: 700;
  text-decoration: none;
  color: var(--text);
  white-space: nowrap;
}

.nav {
  display: flex;
  gap: 1rem;
  flex: 1;
}

.nav a {
  text-decoration: none;
  color: var(--muted);
  padding: 0.25rem 0;
}

.nav a.router-link-active {
  color: var(--text);
  border-bottom: 2px solid var(--primary);
}

.session {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
</style>
