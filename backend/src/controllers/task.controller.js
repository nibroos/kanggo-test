import * as taskService from '../services/task.service.js';
import { sendSuccess, sendCreated, paginationMeta } from '../utils/response.js';
import { contextOf, asyncHandler } from '../utils/requestContext.js';

/**
 * `req.user.id` is the only source of the owner id — it comes from the verified
 * JWT and is never read from the body or the query, so a client cannot ask for
 * somebody else's tasks (spec §9).
 */

export const index = asyncHandler(async (req, res) => {
  const { status, search, page, limit, sort_by: sortBy, sort_dir: sortDir } = req.validatedQuery;

  const { items, total, counts } = await taskService.list({
    userId: req.user.id,
    status,
    search: search || null,
    page,
    limit,
    sortBy,
    sortDir,
  });

  return sendSuccess(res, {
    message: 'Tasks retrieved',
    data: items,
    meta: {
      ...paginationMeta({ page, limit, total }),
      filters: { status: status || 'all', search: search || null, sort_by: sortBy, sort_dir: sortDir },
      status_counts: counts,
    },
  });
});

export const show = asyncHandler(async (req, res) => {
  const task = await taskService.getById({ userId: req.user.id, id: req.params.id });
  return sendSuccess(res, { message: 'Task retrieved', data: task });
});

export const store = asyncHandler(async (req, res) => {
  const task = await taskService.create(
    { userId: req.user.id, payload: req.body },
    contextOf(req),
  );
  return sendCreated(res, { message: 'Task created', data: task });
});

export const replace = asyncHandler(async (req, res) => {
  const task = await taskService.update(
    { userId: req.user.id, id: req.params.id, payload: req.body, partial: false },
    contextOf(req),
  );
  return sendSuccess(res, { message: 'Task updated', data: task });
});

export const patch = asyncHandler(async (req, res) => {
  const task = await taskService.update(
    { userId: req.user.id, id: req.params.id, payload: req.body, partial: true },
    contextOf(req),
  );
  return sendSuccess(res, { message: 'Task updated', data: task });
});

export const destroy = asyncHandler(async (req, res) => {
  await taskService.remove({ userId: req.user.id, id: req.params.id }, contextOf(req));
  return sendSuccess(res, { message: 'Task deleted', data: { id: Number(req.params.id) } });
});
