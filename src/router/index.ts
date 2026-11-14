import { createRouter, createWebHistory, type RouteRecordRaw, type Router } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import type { Role } from '@/types/api'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    /** Only this account role may open the page. */
    role?: Role
  }
}

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
    meta: { requiresAuth: true, role: 'PATIENT' },
  },
  {
    path: '/files',
    name: 'files',
    component: () => import('@/views/FilesView.vue'),
    meta: { requiresAuth: true, role: 'PATIENT' },
  },
  {
    path: '/analysis',
    name: 'analysis',
    component: () => import('@/views/AnalysisView.vue'),
    meta: { requiresAuth: true, role: 'PATIENT' },
  },
  {
    path: '/requests',
    name: 'requests',
    component: () => import('@/views/RequestsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    // The old doctor share page; sharing now goes through requests.
    path: '/shared',
    redirect: '/requests',
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
    const home = auth.isDoctor ? 'requests' : 'files'
    if (to.meta.guestOnly && auth.isAuthenticated) {
      return { name: home }
    }
    if (to.meta.role && auth.user && to.meta.role !== auth.user.role) {
      return { name: home }
    }
    return true
  })
}

installGuards(router)

export default router
