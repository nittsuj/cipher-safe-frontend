import { createRouter, createWebHistory, type RouteRecordRaw, type Router } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/files' },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/personal-data',
    name: 'personal-data',
    component: () => import('@/views/PersonalDataView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/files',
    name: 'files',
    component: () => import('@/views/FilesView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/analysis',
    name: 'analysis',
    component: () => import('@/views/AnalysisView.vue'),
    meta: { requiresAuth: true },
  },
  { path: '/:pathMatch(.*)*', redirect: '/files' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export function installGuards(target: Router): void {
  target.beforeEach((to) => {
    const auth = useAuthStore()
    if (to.meta.requiresAuth && !auth.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    if (to.meta.guestOnly && auth.isAuthenticated) {
      return { name: 'files' }
    }
    return true
  })
}

installGuards(router)

export default router
