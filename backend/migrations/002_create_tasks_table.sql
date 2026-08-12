-- 002_create_tasks_table
-- A task belongs to exactly one user (spec §4). The FK cascades on delete so a
-- removed account never leaves orphaned tasks behind.

CREATE TABLE IF NOT EXISTS tasks (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NOT NULL,
    title       VARCHAR(200)    NOT NULL,
    description TEXT            NULL,
    status      ENUM ('pending', 'in-progress', 'done') NOT NULL DEFAULT 'pending',
    deadline    DATE            NULL,
    -- Optimistic locking (policy §1.8): bumped on every update so two concurrent
    -- editors cannot silently overwrite each other.
    version     INT UNSIGNED    NOT NULL DEFAULT 1,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    -- Every task query is scoped by user_id, so it leads every index (policy §1.7).
    KEY idx_tasks_user_status_id (user_id, status, id),
    KEY idx_tasks_user_id_id (user_id, id),
    KEY idx_tasks_user_deadline (user_id, deadline),
    KEY idx_tasks_user_title (user_id, title),
    CONSTRAINT fk_tasks_user_id FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
