import { http } from './http.js';

export const taskApi = {
  /**
   * @param {object} params
   * @param {'all'|'pending'|'in-progress'|'done'} [params.status]
   * @returns {Promise<{ items: object[], pagination: object, statusCounts: object }>}
   */
  async list({ status = 'all', search = '', page = 1, limit = 10, sortBy = 'created_at', sortDir = 'desc' } = {}) {
    const { data } = await http.get('/tasks', {
      params: {
        // Blank values are dropped so the URL stays readable and the backend
        // applies its own defaults.
        status: status && status !== 'all' ? status : undefined,
        search: search || undefined,
        page,
        limit,
        sort_by: sortBy,
        sort_dir: sortDir,
      },
    });

    return {
      items: data.data,
      pagination: data.meta.pagination,
      statusCounts: data.meta.status_counts,
    };
  },

  async create(payload) {
    const { data } = await http.post('/tasks', payload);
    return data.data;
  },

  /** Sends `version` so the backend can reject a concurrent edit instead of losing it. */
  async update(id, payload) {
    const { data } = await http.put(`/tasks/${id}`, payload);
    return data.data;
  },

  async updateStatus(id, { status, version }) {
    const { data } = await http.patch(`/tasks/${id}`, { status, version });
    return data.data;
  },

  async remove(id) {
    const { data } = await http.delete(`/tasks/${id}`);
    return data.data;
  },
};
