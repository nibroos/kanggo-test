import { STATUS_OPTIONS } from '@/utils/task.js';

/**
 * Persists the task list's filter state so it survives a page reload.
 *
 * Mirrors the `tokenStorage` pattern: one module owns the key, the parsing and the
 * failure handling. Anything read back is validated against the same whitelists the
 * API accepts — localStorage is user-writable, so a hand-edited value must never
 * reach the request as-is.
 */

const FILTERS_KEY = 'tm.taskFilters';

const VALID_STATUSES = new Set(['all', ...STATUS_OPTIONS.map((option) => option.value)]);
const VALID_SORT_BY = new Set(['created_at', 'updated_at', 'deadline', 'title', 'status']);
const VALID_SORT_DIR = new Set(['asc', 'desc']);
const VALID_LIMITS = new Set([10, 20, 50]);

export const DEFAULT_FILTERS = Object.freeze({
  status: 'all',
  search: '',
  page: 1,
  limit: 10,
  // Soonest deadline first; tasks without a deadline are placed last by the API.
  sortBy: 'deadline',
  sortDir: 'asc',
});

/** Drops anything unrecognised and falls back to the default for that field. */
function sanitize(stored) {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_FILTERS };

  const page = Number(stored.page);
  const limit = Number(stored.limit);

  return {
    status: VALID_STATUSES.has(stored.status) ? stored.status : DEFAULT_FILTERS.status,
    search: typeof stored.search === 'string' ? stored.search.slice(0, 200) : DEFAULT_FILTERS.search,
    page: Number.isInteger(page) && page >= 1 ? page : DEFAULT_FILTERS.page,
    limit: VALID_LIMITS.has(limit) ? limit : DEFAULT_FILTERS.limit,
    sortBy: VALID_SORT_BY.has(stored.sortBy) ? stored.sortBy : DEFAULT_FILTERS.sortBy,
    sortDir: VALID_SORT_DIR.has(stored.sortDir) ? stored.sortDir : DEFAULT_FILTERS.sortDir,
  };
}

export const filterStorage = {
  load() {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      return sanitize(raw ? JSON.parse(raw) : null);
    } catch {
      // Unreadable or corrupt storage is not worth failing over: start clean.
      return { ...DEFAULT_FILTERS };
    }
  },

  save(filters) {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(sanitize(filters)));
    } catch {
      /* storage unavailable (private mode, quota): filters simply will not persist */
    }
  },

  clear() {
    try {
      localStorage.removeItem(FILTERS_KEY);
    } catch {
      /* nothing to do */
    }
  },
};
