/**
 * Client-side auth state (spec §3.1: the client stores the token and logout clears it).
 *
 * Tokens live in localStorage and are sent in the Authorization header — no cookies
 * are involved, which means the API has no CSRF surface to defend (see the README
 * for the reasoning behind this trade-off).
 *
 * Every access goes through this module so there is exactly one place that knows
 * the storage keys, and one place to clear on logout.
 */

const ACCESS_TOKEN_KEY = 'tm.accessToken';
const REFRESH_TOKEN_KEY = 'tm.refreshToken';
const USER_KEY = 'tm.user';

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private browsing modes can throw on access.
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the session simply will not survive a reload */
  }
}

export const tokenStorage = {
  getAccessToken: () => read(ACCESS_TOKEN_KEY),
  getRefreshToken: () => read(REFRESH_TOKEN_KEY),

  getUser() {
    const raw = read(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setSession({ accessToken, refreshToken, user }) {
    write(ACCESS_TOKEN_KEY, accessToken);
    write(REFRESH_TOKEN_KEY, refreshToken);
    write(USER_KEY, user ? JSON.stringify(user) : null);
  },

  setTokens({ accessToken, refreshToken }) {
    write(ACCESS_TOKEN_KEY, accessToken);
    write(REFRESH_TOKEN_KEY, refreshToken);
  },

  clear() {
    write(ACCESS_TOKEN_KEY, null);
    write(REFRESH_TOKEN_KEY, null);
    write(USER_KEY, null);
  },
};
