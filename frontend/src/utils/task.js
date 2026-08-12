/**
 * Task presentation helpers shared by the card, the filter bar and the dialog, so
 * a status is labelled and coloured identically everywhere (policy §22).
 */

export const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'warning', icon: 'mdi-clock-outline' },
  { value: 'in-progress', label: 'In Progress', color: 'info', icon: 'mdi-progress-clock' },
  { value: 'done', label: 'Done', color: 'success', icon: 'mdi-check-circle-outline' },
];

export const FILTER_OPTIONS = [
  { value: 'all', label: 'All', icon: 'mdi-format-list-bulleted' },
  ...STATUS_OPTIONS,
];

const STATUS_BY_VALUE = Object.fromEntries(STATUS_OPTIONS.map((option) => [option.value, option]));

export function statusMeta(status) {
  return STATUS_BY_VALUE[status] || { value: status, label: status, color: 'grey', icon: 'mdi-help-circle-outline' };
}

/** `2026-09-01` -> `1 Sep 2026`. Returns the raw value if it cannot be parsed. */
export function formatDate(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Today in `YYYY-MM-DD`, in the viewer's own timezone. */
export function today() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

/**
 * Deadline state for the badge on a task card: overdue and due-soon only matter
 * while the task is still open.
 */
export function deadlineState(task) {
  if (!task.deadline) return null;
  if (task.status === 'done') return 'done';

  const deadline = String(task.deadline).slice(0, 10);
  const now = today();
  if (deadline < now) return 'overdue';
  if (deadline === now) return 'today';

  const daysAway = (Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${now}T00:00:00Z`)) / 86_400_000;
  return daysAway <= 3 ? 'soon' : 'upcoming';
}

export function deadlineLabel(task) {
  const state = deadlineState(task);
  const formatted = formatDate(task.deadline);
  if (state === 'overdue') return { text: `Overdue · ${formatted}`, color: 'error' };
  if (state === 'today') return { text: `Due today`, color: 'warning' };
  if (state === 'soon') return { text: `Due ${formatted}`, color: 'warning' };
  return { text: formatted, color: 'default' };
}
