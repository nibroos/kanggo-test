import { withTransaction } from '../config/database.js';
import * as taskRepository from '../repositories/task.repository.js';
import * as auditLogRepository from '../repositories/auditLog.repository.js';
import { conflict, notFound } from '../utils/errors.js';

/**
 * Task business logic.
 *
 * Ownership rule (spec §9): every operation resolves the task by `id AND user_id`.
 * A task that belongs to somebody else is reported as 404 rather than 403, so the
 * API never confirms that an id exists in another account.
 */

const EDITABLE_FIELDS = ['title', 'description', 'status', 'deadline'];

function toDto(row) {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    title: row.title,
    description: row.description,
    status: row.status,
    deadline: row.deadline, // DATE columns come back as 'YYYY-MM-DD' strings
    version: Number(row.version),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function list({ userId, status, search, page, limit, sortBy, sortDir }) {
  const [{ rows, total }, counts] = await Promise.all([
    taskRepository.paginate({ userId, status, search, page, limit, sortBy, sortDir }),
    taskRepository.countByStatus({ userId, search }),
  ]);

  return { items: rows.map(toDto), total, counts };
}

export async function getById({ userId, id }) {
  const task = await taskRepository.findByIdForUser(id, userId);
  if (!task) throw notFound('Task not found');
  return toDto(task);
}

export async function create({ userId, payload }, context) {
  return withTransaction(async (conn) => {
    const task = await taskRepository.insert(
      {
        userId,
        title: payload.title,
        description: payload.description,
        status: payload.status,
        deadline: payload.deadline,
      },
      conn,
    );

    await auditLogRepository.record(
      {
        userId,
        module: 'task',
        table: 'tasks',
        recordId: task.id,
        action: 'create',
        newValue: toDto(task),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      conn,
    );

    return toDto(task);
  });
}

/**
 * @param {object} args
 * @param {boolean} args.partial PATCH keeps untouched fields, PUT replaces them
 */
export async function update({ userId, id, payload, partial }, context) {
  return withTransaction(async (conn) => {
    // FOR UPDATE: holds the row until commit so a concurrent edit or delete of the
    // same task queues behind this one instead of interleaving (policy §11).
    const current = await taskRepository.findByIdForUserLocked(id, userId, conn);
    if (!current) throw notFound('Task not found');

    // Optimistic locking (policy §1.8): when the client tells us which version it
    // edited, a newer version in the database means someone else got there first.
    const expectedVersion = payload.version ?? Number(current.version);
    if (Number(current.version) !== expectedVersion) {
      throw conflict('This task was modified by another session. Reload it and try again.');
    }

    const fields = {};
    for (const key of EDITABLE_FIELDS) {
      const next = partial ? payload[key] : (payload[key] ?? null);
      if (next === undefined) continue;
      if (next !== current[key]) fields[key] = next;
    }

    if (Object.keys(fields).length === 0) {
      return toDto(current);
    }

    const affected = await taskRepository.updateOwned(
      { id, userId, version: expectedVersion, fields },
      conn,
    );
    if (affected === 0) {
      throw conflict('This task was modified by another session. Reload it and try again.');
    }

    const updated = await taskRepository.findByIdForUser(id, userId, conn);

    await auditLogRepository.record(
      {
        userId,
        module: 'task',
        table: 'tasks',
        recordId: id,
        action: 'update',
        oldValue: toDto(current),
        newValue: toDto(updated),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      conn,
    );

    return toDto(updated);
  });
}

export async function remove({ userId, id }, context) {
  return withTransaction(async (conn) => {
    const current = await taskRepository.findByIdForUserLocked(id, userId, conn);
    if (!current) throw notFound('Task not found');

    await taskRepository.deleteOwned({ id, userId }, conn);

    await auditLogRepository.record(
      {
        userId,
        module: 'task',
        table: 'tasks',
        recordId: id,
        action: 'delete',
        oldValue: toDto(current),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      conn,
    );

    return { id: Number(id) };
  });
}
