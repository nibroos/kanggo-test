/**
 * Vuetify validation rules (spec §12: friendly, immediate feedback in the form).
 *
 * These mirror the backend rules, but they are a convenience only — the server
 * validates every request independently (policy §2).
 *
 * A rule returns `true` when valid, or the message to display.
 */

export const required = (label = 'This field') => (value) =>
  (value !== null && value !== undefined && String(value).trim() !== '') || `${label} is required`;

export const maxLength = (limit, label = 'This field') => (value) =>
  !value || String(value).length <= limit || `${label} must be at most ${limit} characters`;

export const minLength = (limit, label = 'This field') => (value) =>
  !value || String(value).length >= limit || `${label} must be at least ${limit} characters`;

// Deliberately permissive: the authoritative check is the backend's, and an
// over-strict client pattern rejects valid, unusual addresses.
export const email = (value) =>
  !value || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim()) || 'Enter a valid email address';

export const isDate = (value) => {
  if (!value) return true;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return 'Use the date format YYYY-MM-DD';
  const [year, month, day] = text.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  return isReal || 'That date does not exist';
};

export const rules = {
  name: [required('Name'), minLength(2, 'Name'), maxLength(100, 'Name')],
  email: [required('Email'), email, maxLength(191, 'Email')],
  password: [required('Password'), minLength(8, 'Password'), maxLength(72, 'Password')],
  loginPassword: [required('Password')],
  title: [required('Title'), maxLength(200, 'Title')],
  description: [maxLength(5000, 'Description')],
  deadline: [isDate],
};
