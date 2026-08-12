import { defineStore } from 'pinia';
import { ref, reactive, computed, watch } from 'vue';
import { taskApi } from '@/services/task.api.js';
import { filterStorage, DEFAULT_FILTERS } from '@/services/filterStorage.js';
import { useUiStore } from './ui.js';

const EMPTY_COUNTS = { all: 0, pending: 0, 'in-progress': 0, done: 0 };

/**
 * Task list state: filters, pagination and CRUD.
 *
 * Filtering and paging happen on the server (the API is the only thing that knows
 * the full set), so every filter change re-queries rather than slicing a local array.
 *
 * The filter block is hydrated from localStorage when the store is created and
 * written back whenever it changes, so a reload lands the user back on the same
 * status tab, search term, sort order and page.
 */
export const useTaskStore = defineStore('tasks', () => {
  const ui = useUiStore();

  const items = ref([]);
  const statusCounts = ref({ ...EMPTY_COUNTS });
  const pagination = ref({ page: 1, limit: 10, total: 0, total_pages: 0 });

  const filters = reactive(filterStorage.load());

  // `deep` because every field lives on one reactive object. `flush: 'sync'` keeps
  // the write ordered against `reset()`, which clears the key after restoring the
  // defaults — a deferred watcher would run last and write the defaults back.
  // The cost is a localStorage write of six scalars per change, which is nothing.
  watch(filters, (value) => filterStorage.save(value), { deep: true, flush: 'sync' });

  const isLoading = ref(false);
  const isSaving = ref(false);
  const deletingId = ref(null);
  const updatingStatusId = ref(null);
  const loadError = ref(null);

  const isEmpty = computed(() => !isLoading.value && items.value.length === 0);
  const hasActiveFilters = computed(() => filters.status !== 'all' || filters.search.trim() !== '');

  async function fetchTasks() {
    isLoading.value = true;
    loadError.value = null;
    try {
      const result = await taskApi.list({ ...filters });
      items.value = result.items;
      pagination.value = result.pagination;
      statusCounts.value = result.statusCounts || { ...EMPTY_COUNTS };

      // A delete can empty the last page; step back so the user is not left
      // staring at "no tasks" when there are still some.
      if (items.value.length === 0 && filters.page > 1 && result.pagination.total > 0) {
        filters.page = Math.min(filters.page - 1, result.pagination.total_pages || 1);
        await fetchTasks();
      }
    } catch (error) {
      // 401 is handled globally by the http layer; anything else is shown inline.
      if (error.status !== 401) loadError.value = error.message;
      items.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  function setStatus(status) {
    filters.status = status;
    filters.page = 1;
    return fetchTasks();
  }

  function setSearch(term) {
    filters.search = term;
    filters.page = 1;
    return fetchTasks();
  }

  function setPage(page) {
    filters.page = page;
    return fetchTasks();
  }

  function setSort({ sortBy, sortDir }) {
    filters.sortBy = sortBy;
    filters.sortDir = sortDir;
    filters.page = 1;
    return fetchTasks();
  }

  function setLimit(limit) {
    filters.limit = limit;
    filters.page = 1;
    return fetchTasks();
  }

  function resetFilters() {
    filters.status = DEFAULT_FILTERS.status;
    filters.search = DEFAULT_FILTERS.search;
    filters.page = 1;
    return fetchTasks();
  }

  async function createTask(payload) {
    isSaving.value = true;
    try {
      await taskApi.create(payload);
      ui.notify('Task created.');
      // Jump to the first page: with the default newest-first sort, that is where
      // the new task is.
      filters.page = 1;
      await fetchTasks();
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    } finally {
      isSaving.value = false;
    }
  }

  async function updateTask(id, payload) {
    isSaving.value = true;
    try {
      await taskApi.update(id, payload);
      ui.notify('Task updated.');
      await fetchTasks();
      return { ok: true };
    } catch (error) {
      if (error.status === 409 || error.status === 404) {
        // Somebody else changed or removed it: reload so the UI stops showing
        // stale data.
        await fetchTasks();
      }
      return { ok: false, error };
    } finally {
      isSaving.value = false;
    }
  }

  /** Inline status change from the task card. */
  async function changeStatus(task, status) {
    if (task.status === status) return;
    updatingStatusId.value = task.id;
    try {
      await taskApi.updateStatus(task.id, { status, version: task.version });
      ui.notify('Status updated.');
      await fetchTasks();
    } catch (error) {
      ui.notifyError(error.message);
      if (error.status === 409 || error.status === 404) await fetchTasks();
    } finally {
      updatingStatusId.value = null;
    }
  }

  async function deleteTask(id) {
    deletingId.value = id;
    try {
      await taskApi.remove(id);
      ui.notify('Task deleted.');
      await fetchTasks();
      return { ok: true };
    } catch (error) {
      ui.notifyError(error.message);
      if (error.status === 404) await fetchTasks();
      return { ok: false, error };
    } finally {
      deletingId.value = null;
    }
  }

  /**
   * Clears everything on sign-out so the next user never sees the previous list —
   * including the persisted filters, which belong to the account that set them.
   */
  function reset() {
    items.value = [];
    statusCounts.value = { ...EMPTY_COUNTS };
    pagination.value = { page: 1, limit: 10, total: 0, total_pages: 0 };
    Object.assign(filters, DEFAULT_FILTERS);
    loadError.value = null;
    filterStorage.clear();
  }

  return {
    items,
    statusCounts,
    pagination,
    filters,
    isLoading,
    isSaving,
    deletingId,
    updatingStatusId,
    loadError,
    isEmpty,
    hasActiveFilters,
    fetchTasks,
    setStatus,
    setSearch,
    setPage,
    setSort,
    setLimit,
    resetFilters,
    createTask,
    updateTask,
    changeStatus,
    deleteTask,
    reset,
  };
});
