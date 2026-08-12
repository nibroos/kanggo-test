-- ---------------------------------------------------------------------------
-- Task Management System - full schema snapshot
--
-- This file is provided for reviewers who want the whole structure in one place
-- (spec §17). The runtime path is `npm run migrate`, which applies the versioned
-- files in backend/migrations/ and records them in schema_migrations.
--
--   mysql -u root -p < backend/schema.sql
--
-- Relationship: users 1 --- N tasks (tasks.user_id -> users.id)
-- ---------------------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS task_management
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE task_management;

CREATE TABLE IF NOT EXISTS users (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name           VARCHAR(100)    NOT NULL,
    email          VARCHAR(191)    NOT NULL,
    password_hash  VARCHAR(255)    NOT NULL,
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NOT NULL,
    title       VARCHAR(200)    NOT NULL,
    description TEXT            NULL,
    status      ENUM ('pending', 'in-progress', 'done') NOT NULL DEFAULT 'pending',
    deadline    DATE            NULL,
    version     INT UNSIGNED    NOT NULL DEFAULT 1,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tasks_user_status_id (user_id, status, id),
    KEY idx_tasks_user_id_id (user_id, id),
    KEY idx_tasks_user_deadline (user_id, deadline),
    KEY idx_tasks_user_title (user_id, title),
    CONSTRAINT fk_tasks_user_id FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    jti             CHAR(36)        NOT NULL,
    token_hash      CHAR(64)        NOT NULL,
    expires_at      DATETIME        NOT NULL,
    revoked_at      DATETIME        NULL,
    replaced_by_jti CHAR(36)        NULL,
    user_agent      VARCHAR(255)    NULL,
    ip_address      VARCHAR(45)     NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_refresh_tokens_jti (jti),
    KEY idx_refresh_tokens_user (user_id, revoked_at),
    KEY idx_refresh_tokens_expires (expires_at),
    CONSTRAINT fk_refresh_tokens_user_id FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id    BIGINT UNSIGNED NULL,
    module     VARCHAR(50)     NOT NULL,
    table_name VARCHAR(64)     NOT NULL,
    record_id  VARCHAR(64)     NULL,
    action     VARCHAR(32)     NOT NULL,
    old_value  JSON            NULL,
    new_value  JSON            NULL,
    ip_address VARCHAR(45)     NULL,
    user_agent VARCHAR(255)    NULL,
    request_id VARCHAR(64)     NULL,
    created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_audit_logs_user_created (user_id, created_at),
    KEY idx_audit_logs_record (table_name, record_id),
    CONSTRAINT fk_audit_logs_user_id FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(191) NOT NULL,
    checksum   CHAR(64)     NOT NULL,
    applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (version)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
