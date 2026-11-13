<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const links = computed(() =>
  auth.isDoctor
    ? [{ to: '/shared', label: 'Shared with me' }]
    : [
        { to: '/files', label: 'Records' },
        { to: '/personal-data', label: 'Profile' },
        { to: '/analysis', label: 'Cipher analysis' },
      ],
)

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <a class="skip" href="#main">Skip to content</a>
  <header class="topbar">
    <div class="topbar-inner">
      <RouterLink :to="auth.isDoctor ? '/shared' : '/files'" class="brand">
        <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M4 9a3 3 0 0 1 3-3h6l3 3h9a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z" />
          <rect x="13" y="15" width="6" height="6" rx="1.2" class="lock" />
          <path d="M14.3 15v-1.6a1.7 1.7 0 0 1 3.4 0V15" class="shackle" />
        </svg>
        <span>Cipher Safe</span>
      </RouterLink>

      <nav v-if="auth.isAuthenticated" class="nav" aria-label="Main">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to">{{ link.label }}</RouterLink>
      </nav>

      <div v-if="auth.isAuthenticated" class="session">
        <span class="who">
          {{ auth.user?.username }}
          <span class="role">{{ auth.isDoctor ? 'Doctor' : 'Patient' }}</span>
        </span>
        <button class="secondary" @click="handleLogout">Sign out</button>
      </div>
    </div>
  </header>

  <main id="main">
    <RouterView />
  </main>
</template>

<style scoped>
.skip {
  position: absolute;
  left: -999px;
  top: 0.5rem;
  background: var(--sheet);
  padding: 0.5rem 1rem;
  z-index: 10;
}

.skip:focus {
  left: 0.5rem;
}

.topbar {
  background: var(--sheet);
  border-bottom: 1px solid var(--line);
}

.topbar-inner {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0.6rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 800;
  font-size: 1.15rem;
  color: var(--ink);
  text-decoration: none;
}

.brand-mark {
  width: 30px;
  height: 30px;
}

.brand-mark path:first-child {
  fill: var(--accent);
}

.brand-mark .lock {
  fill: var(--sheet);
}

.brand-mark .shackle {
  fill: none;
  stroke: var(--sheet);
  stroke-width: 1.6;
}

.nav {
  display: flex;
  gap: 0.25rem;
  flex: 1;
}

.nav a {
  color: var(--ink-2);
  text-decoration: none;
  font-weight: 600;
  padding: 0.5rem 0.8rem;
  border-radius: var(--radius-control);
}

.nav a:hover {
  color: var(--ink);
  background: var(--sheet-2);
}

.nav a.router-link-active {
  color: var(--accent);
  background: var(--accent-soft);
}

.session {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-left: auto;
}

.who {
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.role {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-2);
  border: 1px solid var(--line-strong);
  border-radius: 99px;
  padding: 0 0.5rem;
}

@media (max-width: 720px) {
  .topbar-inner {
    gap: 0.5rem 1rem;
    padding: 0.6rem 1rem;
  }

  .nav {
    order: 3;
    flex-basis: 100%;
    overflow-x: auto;
  }

  .who {
    display: none;
  }
}
</style>
