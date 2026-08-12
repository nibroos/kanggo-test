import { createRouter, createWebHistory } from 'vue-router';
import { tokenStorage } from '@/services/tokenStorage.js';

/**
 * Routes are lazy-loaded so the login screen does not ship the task page's code.
 */
const routes = [
  { path: '/', redirect: { name: 'tasks' } },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guestOnly: true, title: 'Sign in' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { guestOnly: true, title: 'Create account' },
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('@/views/TasksView.vue'),
    meta: { requiresAuth: true, title: 'My tasks' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Page not found' },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

/**
 * Route protection (spec §3.1). The guard reads the stored token directly rather
 * than the Pinia store so it also works on a hard refresh, before any component
 * has mounted. This is a UX guard only — the API enforces the real rule.
 */
router.beforeEach((to) => {
  const isAuthenticated = Boolean(tokenStorage.getAccessToken());

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login', query: to.fullPath === '/tasks' ? {} : { redirect: to.fullPath } };
  }
  if (to.meta.guestOnly && isAuthenticated) {
    return { name: 'tasks' };
  }
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Task Manager` : 'Task Manager';
});

export default router;
