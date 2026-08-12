/**
 * Single response envelope for the whole API (policy §4).
 *
 * Success: { success, message, data, meta }
 * Error:   { success, message, errors }
 */

export function sendSuccess(res, { status = 200, message = '', data = null, meta = {} } = {}) {
  return res.status(status).json({ success: true, message, data, meta });
}

export function sendCreated(res, { message = 'Created', data = null, meta = {} } = {}) {
  return sendSuccess(res, { status: 201, message, data, meta });
}

export function sendError(res, { status = 500, message = 'Internal Server Error', errors = [] } = {}) {
  return res.status(status).json({ success: false, message, errors });
}

/**
 * Builds the pagination block returned in `meta` for every list endpoint.
 */
export function paginationMeta({ page, limit, total }) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next_page: page < totalPages,
      has_prev_page: page > 1,
    },
  };
}
