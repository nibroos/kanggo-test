import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTaskStore } from '@/stores/tasks.js';
import { taskApi } from '@/services/task.api.js';

vi.mock('@/services/task.api.js', () => ({
  taskApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    remove: vi.fn(),
  },
}));

const page = (items = [], overrides = {}) => ({
  items,
  pagination: { page: 1, limit: 10, total: items.length, total_pages: 1, ...overrides },
  statusCounts: { all: items.length, pending: items.length, 'in-progress': 0, done: 0 },
});

describe('task store', () => {
  beforeEach(() => {
    // Filters persist to localStorage, so each test starts from a clean slate.
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    taskApi.list.mockResolvedValue(page([{ id: 1, title: 'A', status: 'pending', version: 1 }]));
  });

  it('defaults to the soonest deadline first', () => {
    const store = useTaskStore();
    expect(store.filters.sortBy).toBe('deadline');
    expect(store.filters.sortDir).toBe('asc');
  });

  it('loads tasks and exposes pagination and status counts', async () => {
    const store = useTaskStore();
    await store.fetchTasks();

    expect(store.items).toHaveLength(1);
    expect(store.pagination.total).toBe(1);
    expect(store.statusCounts.all).toBe(1);
    expect(store.isLoading).toBe(false);
  });

  it('sends the status filter to the API and resets to page 1', async () => {
    const store = useTaskStore();
    store.filters.page = 3;
    await store.setStatus('done');

    expect(store.filters.page).toBe(1);
    expect(taskApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'done', page: 1 }));
  });

  it('resets to page 1 when the search term changes', async () => {
    const store = useTaskStore();
    store.filters.page = 2;
    await store.setSearch('deploy');

    expect(taskApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'deploy', page: 1 }));
  });

  it('surfaces a load failure instead of throwing', async () => {
    taskApi.list.mockRejectedValueOnce({ status: 500, message: 'Server exploded' });
    const store = useTaskStore();
    await store.fetchTasks();

    expect(store.loadError).toBe('Server exploded');
    expect(store.items).toEqual([]);
  });

  it('leaves 401 to the http layer rather than showing an inline error', async () => {
    taskApi.list.mockRejectedValueOnce({ status: 401, message: 'Session expired' });
    const store = useTaskStore();
    await store.fetchTasks();

    expect(store.loadError).toBeNull();
  });

  it('returns to the first page after creating a task', async () => {
    taskApi.create.mockResolvedValue({ id: 2 });
    const store = useTaskStore();
    store.filters.page = 4;

    const result = await store.createTask({ title: 'New' });

    expect(result.ok).toBe(true);
    expect(store.filters.page).toBe(1);
  });

  it('reports a version conflict back to the caller and reloads the list', async () => {
    taskApi.update.mockRejectedValueOnce({ status: 409, message: 'Modified elsewhere' });
    const store = useTaskStore();

    const result = await store.updateTask(1, { title: 'X', version: 1 });

    expect(result.ok).toBe(false);
    expect(result.error.status).toBe(409);
    expect(taskApi.list).toHaveBeenCalled();
  });

  it('steps back a page when the last item on it is deleted', async () => {
    const store = useTaskStore();
    store.filters.page = 2;
    taskApi.remove.mockResolvedValue({ id: 1 });
    // First reload comes back empty on page 2, second returns page 1.
    taskApi.list
      .mockResolvedValueOnce(page([], { page: 2, total: 10, total_pages: 1 }))
      .mockResolvedValueOnce(page([{ id: 9, title: 'B', status: 'pending', version: 1 }]));

    await store.deleteTask(1);

    expect(store.filters.page).toBe(1);
    expect(store.items).toHaveLength(1);
  });

  it('skips the request when the status is already the requested one', async () => {
    const store = useTaskStore();
    await store.changeStatus({ id: 1, status: 'done', version: 1 }, 'done');
    expect(taskApi.updateStatus).not.toHaveBeenCalled();
  });

  it('clears every trace of the previous session on reset', async () => {
    const store = useTaskStore();
    await store.fetchTasks();
    store.filters.status = 'done';

    store.reset();

    expect(store.items).toEqual([]);
    expect(store.filters.status).toBe('all');
    expect(store.pagination.total).toBe(0);
  });
});

describe('filter persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    taskApi.list.mockResolvedValue(page([{ id: 1, title: 'A', status: 'pending', version: 1 }]));
  });

  /** Simulates a page reload: a brand new Pinia, hydrating from what was stored. */
  function reload() {
    setActivePinia(createPinia());
    return useTaskStore();
  }

  it('restores the status filter after a reload', async () => {
    await useTaskStore().setStatus('in-progress');
    expect(reload().filters.status).toBe('in-progress');
  });

  it('restores the search term, sort order and page', async () => {
    const store = useTaskStore();
    await store.setSearch('deploy');
    await store.setSort({ sortBy: 'title', sortDir: 'desc' });
    await store.setPage(3);

    const restored = reload().filters;
    expect(restored.search).toBe('deploy');
    expect(restored.sortBy).toBe('title');
    expect(restored.sortDir).toBe('desc');
    expect(restored.page).toBe(3);
  });

  it('queries the API with the restored filters, not the defaults', async () => {
    await useTaskStore().setStatus('done');

    await reload().fetchTasks();

    expect(taskApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'done' }));
  });

  it('falls back to defaults when nothing has been stored', () => {
    expect(reload().filters).toMatchObject({ status: 'all', search: '', page: 1, sortBy: 'deadline' });
  });

  it('ignores a hand-edited value that the API would reject', () => {
    localStorage.setItem(
      'tm.taskFilters',
      JSON.stringify({ status: 'archived', sortBy: 'password_hash', sortDir: 'sideways', page: -5 }),
    );

    expect(reload().filters).toMatchObject({
      status: 'all',
      sortBy: 'deadline',
      sortDir: 'asc',
      page: 1,
    });
  });

  it('survives corrupt storage without throwing', () => {
    localStorage.setItem('tm.taskFilters', 'not json at all');
    expect(() => reload()).not.toThrow();
    expect(reload().filters.status).toBe('all');
  });

  it('forgets the filters on sign-out so the next user starts clean', async () => {
    await useTaskStore().setStatus('done');
    useTaskStore().reset();

    expect(localStorage.getItem('tm.taskFilters')).toBeNull();
    expect(reload().filters.status).toBe('all');
  });
});
