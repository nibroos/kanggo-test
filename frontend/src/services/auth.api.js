import { http } from './http.js';

/**
 * Thin wrappers around the auth endpoints. Views and stores never build URLs
 * themselves, so an API change lands in exactly one file.
 */
export const authApi = {
  async register({ name, email, password }) {
    const { data } = await http.post('/auth/register', { name, email, password });
    return data.data;
  },

  async login({ email, password }) {
    const { data } = await http.post('/auth/login', { email, password });
    return data.data;
  },

  async logout(refreshToken) {
    const { data } = await http.post('/auth/logout', { refreshToken });
    return data;
  },

  async me() {
    const { data } = await http.get('/auth/me');
    return data.data.user;
  },
};
