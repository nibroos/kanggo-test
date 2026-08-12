import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/services/auth.api.js';
import { tokenStorage } from '@/services/tokenStorage.js';
import { setSessionExpiredHandler } from '@/services/http.js';
import { router } from '@/router/index.js';
import { useUiStore } from './ui.js';

/**
 * Authentication state (spec §3.1). The store is the single source of truth for
 * "is somebody signed in"; the router guard and the layout both read it from here.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref(tokenStorage.getUser());
  const accessToken = ref(tokenStorage.getAccessToken());
  const isSubmitting = ref(false);

  const isAuthenticated = computed(() => Boolean(accessToken.value && user.value));
  const initials = computed(() =>
    (user.value?.name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join(''),
  );

  function applySession(session) {
    user.value = session.user;
    accessToken.value = session.accessToken;
    tokenStorage.setSession({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
    });
  }

  /** Drops all client-side auth state (spec §3.1: logout removes the token). */
  function clearSession() {
    user.value = null;
    accessToken.value = null;
    tokenStorage.clear();
  }

  async function register(payload) {
    isSubmitting.value = true;
    try {
      applySession(await authApi.register(payload));
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    } finally {
      isSubmitting.value = false;
    }
  }

  async function login(payload) {
    isSubmitting.value = true;
    try {
      applySession(await authApi.login(payload));
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    } finally {
      isSubmitting.value = false;
    }
  }

  async function logout({ silent = false } = {}) {
    const refreshToken = tokenStorage.getRefreshToken();
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // A failed server-side revoke must not trap the user in a signed-in UI:
      // the local state is cleared either way.
    } finally {
      clearSession();
      if (!silent) useUiStore().notify('You have been signed out.', 'info');
      if (router.currentRoute.value.name !== 'login') {
        router.push({ name: 'login' });
      }
    }
  }

  /**
   * Called by the http layer when a request comes back 401 and the refresh token
   * could not save it (spec §13: clear the auth state and block protected areas).
   */
  function handleSessionExpired() {
    if (!isAuthenticated.value) return;
    clearSession();
    useUiStore().notify('Your session has expired. Please sign in again.', 'warning');
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } });
  }

  setSessionExpiredHandler(handleSessionExpired);

  return {
    user,
    accessToken,
    isSubmitting,
    isAuthenticated,
    initials,
    register,
    login,
    logout,
    clearSession,
    handleSessionExpired,
  };
});
