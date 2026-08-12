import { z } from 'zod';
import { cleanSingleLine, cleanText, emptyToNull } from '../utils/sanitize.js';
import { config } from '../config/env.js';

export const TASK_STATUSES = ['pending', 'in-progress', 'done'];

/**
 * Accepts `YYYY-MM-DD` or a full ISO timestamp (what a date picker hands over) and
 * normalises to a calendar date. Rejects impossible dates such as 2025-02-30,
 * which a plain regex would let through.
 */
const deadline = z.preprocess(
  (value) => {
    const cleaned = emptyToNull(typeof value === 'string' ? value.trim() : value);
    if (cleaned === null) return null;
    if (cleaned instanceof Date) return Number.isNaN(cleaned.getTime()) ? 'invalid' : cleaned.toISOString().slice(0, 10);
    if (typeof cleaned !== 'string') return 'invalid';
    const datePart = cleaned.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return 'invalid';
    const [year, month, day] = datePart.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    const isRealDate =
      parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
    return isRealDate ? datePart : 'invalid';
  },
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Deadline must be a valid date in YYYY-MM-DD format')
    .nullable(),
);

const title = z.preprocess(
  cleanSingleLine,
  z
    .string({ required_error: 'Title is required', invalid_type_error: 'Title must be a string' })
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters'),
);

const description = z.preprocess(
  (value) => emptyToNull(cleanText(value)),
  z.string().max(5000, 'Description must be at most 5000 characters').nullable(),
);

const status = z.enum(TASK_STATUSES, {
  errorMap: () => ({ message: `Status must be one of: ${TASK_STATUSES.join(', ')}` }),
});

const version = z.coerce
  .number({ invalid_type_error: 'Version must be a number' })
  .int('Version must be an integer')
  .positive('Version must be positive')
  .optional();

/** POST /api/tasks — only the title is mandatory (spec §5.1). */
export const createTaskSchema = z.object({
  title,
  description: description.optional().default(null),
  status: status.optional().default('pending'),
  deadline: deadline.optional().default(null),
});

/** PUT /api/tasks/:id — full replacement; omitted optional fields are cleared. */
export const replaceTaskSchema = z.object({
  title,
  description: description.optional().default(null),
  status: status.optional().default('pending'),
  deadline: deadline.optional().default(null),
  version,
});

/** PATCH /api/tasks/:id — partial update; at least one field must be present. */
export const patchTaskSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    status: status.optional(),
    deadline: deadline.optional(),
    version,
  })
  .refine(
    (value) => ['title', 'description', 'status', 'deadline'].some((key) => value[key] !== undefined),
    { message: 'At least one field must be provided', path: ['title'] },
  );

export const taskIdParamSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'Task id must be a number' })
    .int('Task id must be an integer')
    .positive('Task id must be positive'),
});

/** GET /api/tasks — status filter (spec §6), search and pagination (spec §18). */
export const listTasksQuerySchema = z.object({
  // "all" and "" are accepted so the frontend's All tab needs no special case.
  status: z.preprocess(
    (value) => (value === '' || value === 'all' || value === undefined ? undefined : value),
    status.optional(),
  ),
  search: z.preprocess(
    (value) => emptyToNull(cleanSingleLine(value)),
    z.string().max(200, 'Search must be at most 200 characters').nullable().optional(),
  ),
  page: z.coerce.number().int().positive('Page must be a positive integer').default(1),
  limit: z.coerce
    .number()
    .int()
    .positive('Limit must be a positive integer')
    .max(config.pagination.maxLimit, `Limit must be at most ${config.pagination.maxLimit}`)
    .default(config.pagination.defaultLimit),
  // Default: soonest deadline first — the most useful order for a task list.
  // Tasks with no deadline sort last (see the repository's ORDER BY).
  sort_by: z.enum(['created_at', 'updated_at', 'deadline', 'title', 'status']).default('deadline'),
  sort_dir: z.enum(['asc', 'desc']).default('asc'),
});
