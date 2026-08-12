import { describe, it, expect } from 'vitest';
import {
  createTaskSchema,
  patchTaskSchema,
  listTasksQuerySchema,
  taskIdParamSchema,
} from '../../src/validators/task.validator.js';
import { registerSchema, loginSchema } from '../../src/validators/auth.validator.js';
import { cleanSingleLine, cleanEmail, emptyToNull } from '../../src/utils/sanitize.js';
import { paginationMeta } from '../../src/utils/response.js';
import { accessTokenTtlSeconds } from '../../src/utils/token.js';

describe('sanitisation', () => {
  it('collapses whitespace and trims single-line values', () => {
    expect(cleanSingleLine('  Write   the   README  ')).toBe('Write the README');
  });

  it('lowercases and trims emails so casing cannot fork an account', () => {
    expect(cleanEmail('  Ada@Example.COM ')).toBe('ada@example.com');
  });

  it('turns blank strings into null', () => {
    expect(emptyToNull('   ')).toBeNull();
    expect(emptyToNull('value')).toBe('value');
  });
});

describe('task creation schema', () => {
  it('requires a title', () => {
    const result = createTaskSchema.safeParse({ description: 'no title here' });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['title']);
  });

  it('rejects a title that is only whitespace', () => {
    expect(createTaskSchema.safeParse({ title: '     ' }).success).toBe(false);
  });

  it('defaults status to pending and deadline to null', () => {
    const result = createTaskSchema.parse({ title: 'Task' });
    expect(result.status).toBe('pending');
    expect(result.deadline).toBeNull();
    expect(result.description).toBeNull();
  });

  it('accepts the three documented statuses and nothing else', () => {
    for (const status of ['pending', 'in-progress', 'done']) {
      expect(createTaskSchema.safeParse({ title: 'T', status }).success).toBe(true);
    }
    expect(createTaskSchema.safeParse({ title: 'T', status: 'archived' }).success).toBe(false);
  });

  it('rejects calendar dates that do not exist', () => {
    expect(createTaskSchema.safeParse({ title: 'T', deadline: '2026-02-30' }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: 'T', deadline: '01-09-2026' }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: 'T', deadline: '2026-09-01' }).success).toBe(true);
  });

  it('narrows an ISO timestamp to its calendar date', () => {
    expect(createTaskSchema.parse({ title: 'T', deadline: '2026-09-01T17:30:00.000Z' }).deadline)
      .toBe('2026-09-01');
  });

  it('caps the title at the column width', () => {
    expect(createTaskSchema.safeParse({ title: 'x'.repeat(201) }).success).toBe(false);
  });
});

describe('task patch schema', () => {
  it('rejects an empty patch', () => {
    expect(patchTaskSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a single field', () => {
    expect(patchTaskSchema.safeParse({ status: 'done' }).success).toBe(true);
  });
});

describe('task list query schema', () => {
  it('applies pagination defaults', () => {
    const result = listTasksQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBeGreaterThan(0);
  });

  it('defaults to the soonest deadline first', () => {
    const result = listTasksQuerySchema.parse({});
    expect(result.sort_by).toBe('deadline');
    expect(result.sort_dir).toBe('asc');
  });

  it('treats "all" and "" as no status filter', () => {
    expect(listTasksQuerySchema.parse({ status: 'all' }).status).toBeUndefined();
    expect(listTasksQuerySchema.parse({ status: '' }).status).toBeUndefined();
  });

  it('rejects an unknown status, page 0 and an oversized limit', () => {
    expect(listTasksQuerySchema.safeParse({ status: 'nope' }).success).toBe(false);
    expect(listTasksQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(listTasksQuerySchema.safeParse({ limit: 1000 }).success).toBe(false);
  });

  it('rejects a sort column outside the whitelist', () => {
    expect(listTasksQuerySchema.safeParse({ sort_by: 'password_hash' }).success).toBe(false);
  });
});

describe('id param schema', () => {
  it('rejects non-numeric and negative ids', () => {
    expect(taskIdParamSchema.safeParse({ id: 'abc' }).success).toBe(false);
    expect(taskIdParamSchema.safeParse({ id: '-1' }).success).toBe(false);
    expect(taskIdParamSchema.parse({ id: '42' }).id).toBe(42);
  });
});

describe('auth schemas', () => {
  it('rejects a malformed email', () => {
    expect(registerSchema.safeParse({ name: 'Ada', email: 'nope', password: 'Password123' }).success)
      .toBe(false);
  });

  it('enforces a minimum password length on registration', () => {
    expect(registerSchema.safeParse({ name: 'Ada', email: 'a@b.com', password: 'short' }).success)
      .toBe(false);
  });

  it('normalises the email before it reaches the database', () => {
    const result = registerSchema.parse({ name: ' Ada  Lovelace ', email: ' ADA@B.COM ', password: 'Password123' });
    expect(result.email).toBe('ada@b.com');
    expect(result.name).toBe('Ada Lovelace');
  });

  it('does not impose a length rule on the login password', () => {
    // Login only checks presence: existing short passwords must still be able to fail
    // authentication rather than validation.
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
});

describe('pagination meta', () => {
  it('computes page counts and navigation flags', () => {
    expect(paginationMeta({ page: 2, limit: 10, total: 26 }).pagination).toEqual({
      page: 2,
      limit: 10,
      total: 26,
      total_pages: 3,
      has_next_page: true,
      has_prev_page: true,
    });
  });

  it('handles an empty result set', () => {
    const meta = paginationMeta({ page: 1, limit: 10, total: 0 }).pagination;
    expect(meta.total_pages).toBe(0);
    expect(meta.has_next_page).toBe(false);
  });
});

describe('access token ttl parsing', () => {
  it('converts the configured ttl to seconds', () => {
    expect(accessTokenTtlSeconds()).toBe(900);
  });
});
