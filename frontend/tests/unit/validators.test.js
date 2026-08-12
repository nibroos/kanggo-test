import { describe, it, expect } from 'vitest';
import { rules, email, isDate, required, maxLength } from '@/utils/validators.js';
import { statusMeta, deadlineState, formatDate, today } from '@/utils/task.js';

describe('form validation rules', () => {
  it('flags an empty or whitespace-only required field', () => {
    expect(required('Title')('')).toBe('Title is required');
    expect(required('Title')('   ')).toBe('Title is required');
    expect(required('Title')('Ship it')).toBe(true);
  });

  it('enforces a maximum length', () => {
    expect(maxLength(5, 'Title')('123456')).toBe('Title must be at most 5 characters');
    expect(maxLength(5, 'Title')('12345')).toBe(true);
  });

  it('accepts well-formed emails and rejects malformed ones', () => {
    expect(email('ada@example.com')).toBe(true);
    expect(email('ada+tag@sub.example.co.uk')).toBe(true);
    expect(email('not-an-email')).toBe('Enter a valid email address');
    expect(email('missing@domain')).toBe('Enter a valid email address');
    expect(email('two@@example.com')).toBe('Enter a valid email address');
  });

  it('rejects impossible dates and wrong formats', () => {
    expect(isDate('2026-09-01')).toBe(true);
    expect(isDate('2026-02-30')).toBe('That date does not exist');
    expect(isDate('01/09/2026')).toBe('Use the date format YYYY-MM-DD');
    expect(isDate(null)).toBe(true); // deadline is optional
  });

  it('mirrors the backend password minimum', () => {
    const check = (value) => rules.password.map((rule) => rule(value)).find((result) => result !== true);
    expect(check('short')).toBe('Password must be at least 8 characters');
    expect(check('Password123!')).toBeUndefined();
  });

  it('only requires presence for the login password', () => {
    const check = (value) => rules.loginPassword.map((rule) => rule(value)).find((result) => result !== true);
    expect(check('x')).toBeUndefined();
    expect(check('')).toBe('Password is required');
  });
});

describe('task presentation helpers', () => {
  it('maps each status to a label and colour', () => {
    expect(statusMeta('pending').label).toBe('Pending');
    expect(statusMeta('in-progress').label).toBe('In Progress');
    expect(statusMeta('done').color).toBe('success');
  });

  it('falls back gracefully for an unknown status', () => {
    expect(statusMeta('archived').label).toBe('archived');
  });

  it('formats a date for display', () => {
    // The month abbreviation is locale data ("Sep" / "Sept"), so assert the shape
    // rather than one runtime's exact string.
    expect(formatDate('2026-09-01')).toMatch(/^1 Sept? 2026$/);
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026');
    expect(formatDate(null)).toBeNull();
  });

  it('marks a past deadline as overdue, but not once the task is done', () => {
    expect(deadlineState({ deadline: '2000-01-01', status: 'pending' })).toBe('overdue');
    expect(deadlineState({ deadline: '2000-01-01', status: 'done' })).toBe('done');
    expect(deadlineState({ deadline: null, status: 'pending' })).toBeNull();
  });

  it('recognises a deadline of today', () => {
    expect(deadlineState({ deadline: today(), status: 'pending' })).toBe('today');
  });
});
