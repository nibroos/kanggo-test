import axios from 'axios';
import { tokenStorage } from './tokenStorage.js';

/**
 * The single axios instance used by the whole app.
 *
 * Responsibilities:
 *   - attach the bearer token to every request
 *   - turn any backend error into a predictable { status, message, errors } shape
 *   - transparently refresh an expired access token once, then replay the request
 *   - hand control to the app when the session is truly gone (spec §13)
 */

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4088/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Set by the auth store at startup: called when refreshing is impossible and the
// user has to sign in again.
let onSessionExpired = () => {};
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

http.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Normalised error surface. Views never inspect axios internals — they read
 * `error.status`, `error.message` and `error.errors` (field-level messages).
 */
export class ApiError extends Error {
  constructor({ status, message, errors = [], isNetworkError = false }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.isNetworkError = isNetworkError;
  }

  /** Field name -> message, ready to bind to an input's error-messages prop. */
  get fieldErrors() {
    return Object.fromEntries(this.errors.map((error) => [error.field, error.message]));
  }
}

function toApiError(error) {
  if (error.code === 'ECONNABORTED') {
    return new ApiError({ status: 0, message: 'The request timed out. Please try again.', isNetworkError: true });
  }
  if (!error.response) {
    return new ApiError({
      status: 0,
      message: 'Cannot reach the server. Check your connection and try again.',
      isNetworkError: true,
    });
  }

  const { status, data } = error.response;
  const fallback = {
    400: 'The request was rejected.',
    401: 'Your session has expired. Please sign in again.',
    403: 'You are not allowed to do that.',
    404: 'That item could not be found.',
    409: 'This conflicts with the current state. Reload and try again.',
    422: 'Please check the highlighted fields.',
    429: 'Too many attempts. Please wait a moment and try again.',
  }[status] || 'Something went wrong. Please try again.';

  return new ApiError({
    status,
    message: data?.message || fallback,
    errors: Array.isArray(data?.errors) ? data.errors : [],
  });
}

// Single-flight refresh: concurrent 401s wait on one refresh call instead of each
// firing their own and invalidating one another through token rotation.
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return null;

  refreshPromise ||= axios
    .post(`${http.defaults.baseURL}/auth/refresh`, { refreshToken })
    .then((response) => {
      const { accessToken, refreshToken: rotated, user } = response.data.data;
      tokenStorage.setSession({ accessToken, refreshToken: rotated, user });
      return accessToken;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const status = error.response?.status;

    const isRefreshCall = request?.url?.includes('/auth/refresh');
    const canRetry = status === 401 && request && !request._retried && !isRefreshCall;

    if (canRetry) {
      request._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        request.headers.Authorization = `Bearer ${token}`;
        return http(request);
      }
      // The refresh token is gone or rejected: the session is over.
      tokenStorage.clear();
      onSessionExpired();
    }

    return Promise.reject(toApiError(error));
  },
);
