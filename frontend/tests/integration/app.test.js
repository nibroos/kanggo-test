import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from '@/App.vue';
import { tokenStorage } from '@/services/tokenStorage.js';

/**
 * Boots the real application — App shell, router, guards, Pinia stores and views —
 * against a mocked HTTP layer. This is the closest thing to a browser check that
 * runs headlessly, and it catches wiring problems (bad imports, guard mistakes,
 * views that fail to render) that unit tests on individual pieces would miss.
 */

/**
 * `src/services/http.js` calls `axios.create()` at import time, so the stub has to
 * exist before any module is loaded — hence vi.hoisted.
 */
const httpStub = vi.hoisted(() => ({
  defaults: { baseURL: 'http://localhost:4088/api' },
  interceptors: { request: { use: () => {} }, response: { use: () => {} } },
  get: undefined, // assigned per test in beforeEach
  post: undefined,
  put: undefined,
  patch: undefined,
  delete: undefined,
}));

vi.mock('axios', () => ({
  default: { create: () => httpStub, post: (...args) => httpStub.post(...args) },
}));

const routes = [
  { path: '/', redirect: { name: 'tasks' } },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true } },
  { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { guestOnly: true } },
  { path: '/tasks', name: 'tasks', component: () => import('@/views/TasksView.vue'), meta: { requiresAuth: true } },
];

function buildRouter() {
  const router = createRouter({ history: createWebHistory(), routes });
  // Same rule as the real guard in src/router/index.js.
  router.beforeEach((to) => {
    const authenticated = Boolean(tokenStorage.getAccessToken());
    if (to.meta.requiresAuth && !authenticated) return { name: 'login' };
    if (to.meta.guestOnly && authenticated) return { name: 'tasks' };
    return true;
  });
  return router;
}

const TASK_PAGE = {
  data: {
    success: true,
    data: [
      {
        id: 1,
        user_id: 1,
        title: 'Write the README',
        description: 'Setup instructions',
        status: 'pending',
        deadline: '2026-09-01',
        version: 1,
        created_at: '2026-08-01T10:00:00.000Z',
        updated_at: '2026-08-01T10:00:00.000Z',
      },
    ],
    meta: {
      pagination: { page: 1, limit: 10, total: 1, total_pages: 1, has_next_page: false, has_prev_page: false },
      filters: { status: 'all', search: null, sort_by: 'created_at', sort_dir: 'desc' },
      status_counts: { all: 1, pending: 1, 'in-progress': 0, done: 0 },
    },
  },
};

async function mountApp(path = '/') {
  const router = buildRouter();
  await router.push(path);
  await router.isReady();

  const wrapper = mount(App, {
    global: {
      plugins: [createPinia(), router],
      stubs: { transition: false },
    },
    attachTo: document.body,
  });

  await flushPromises();
  return { wrapper, router };
}

describe('application shell', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    httpStub.get = vi.fn().mockResolvedValue(TASK_PAGE);
    httpStub.post = vi.fn();
    httpStub.put = vi.fn();
    httpStub.patch = vi.fn();
    httpStub.delete = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sends an anonymous visitor to the login page', async () => {
    const { wrapper, router } = await mountApp('/tasks');

    expect(router.currentRoute.value.name).toBe('login');
    expect(wrapper.text()).toContain('Sign in');
    // The app bar (and its logout button) only exists for signed-in users.
    expect(wrapper.text()).not.toContain('Logout');
  });

  it('renders the login form with both fields and a link to registration', async () => {
    const { wrapper } = await mountApp('/login');

    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Create one');
  });

  it('shows validation feedback instead of calling the API on an empty submit', async () => {
    const { wrapper } = await mountApp('/login');

    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.text()).toContain('Email is required');
    expect(wrapper.text()).toContain('Password is required');
  });

  it('rejects a malformed email before it reaches the network', async () => {
    const { wrapper } = await mountApp('/login');

    await wrapper.find('input[type="email"]').setValue('not-an-email');
    await wrapper.find('input[type="password"]').setValue('Password123!');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.text()).toContain('Enter a valid email address');
  });

  it('renders the registration page with name, email and password', async () => {
    const { wrapper } = await mountApp('/register');

    expect(wrapper.text()).toContain('Create your account');
    expect(wrapper.findAll('input').length).toBeGreaterThanOrEqual(3);
  });

  it('renders the task page, app bar and logout button for a signed-in user', async () => {
    tokenStorage.setSession({
      accessToken: 'fake-access-token',
      refreshToken: 'fake-refresh-token',
      user: { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
    });

    const { wrapper, router } = await mountApp('/tasks');

    expect(router.currentRoute.value.name).toBe('tasks');
    const text = wrapper.text();
    expect(text).toContain('My tasks');
    expect(text).toContain('Write the README'); // the task came from the API
    expect(text).toContain('Add task');
    expect(text).toContain('Logout');
  });

  it('keeps a signed-in user away from the login page', async () => {
    tokenStorage.setSession({
      accessToken: 'fake-access-token',
      refreshToken: 'fake-refresh-token',
      user: { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
    });

    const { router } = await mountApp('/login');
    expect(router.currentRoute.value.name).toBe('tasks');
  });

  it('shows the empty state when the account has no tasks', async () => {
    tokenStorage.setSession({
      accessToken: 'fake-access-token',
      refreshToken: 'fake-refresh-token',
      user: { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
    });
    httpStub.get.mockResolvedValue({
      data: {
        success: true,
        data: [],
        meta: {
          pagination: { page: 1, limit: 10, total: 0, total_pages: 0, has_next_page: false, has_prev_page: false },
          filters: { status: 'all', search: null, sort_by: 'created_at', sort_dir: 'desc' },
          status_counts: { all: 0, pending: 0, 'in-progress': 0, done: 0 },
        },
      },
    });

    const { wrapper } = await mountApp('/tasks');
    expect(wrapper.text()).toContain('No tasks yet');
  });
});
