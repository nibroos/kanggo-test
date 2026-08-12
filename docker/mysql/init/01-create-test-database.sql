-- Runs once, when the MySQL data directory is first initialised.
--
-- The application user gets a second schema for the automated tests, so the suite
-- can truncate freely without ever touching development data.

CREATE DATABASE IF NOT EXISTS task_management_test
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON task_management_test.* TO 'task_user'@'%';
FLUSH PRIVILEGES;
