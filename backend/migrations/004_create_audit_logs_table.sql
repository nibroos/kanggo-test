-- 004_create_audit_logs_table
-- Audit trail (policy §5): login, logout, create, update and delete are recorded
-- with the previous and the new value. Passwords, hashes and tokens are stripped
-- before anything is written here.

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
        REFERENCES users (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
