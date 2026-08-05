ALTER TABLE users ADD COLUMN created_at TEXT;
ALTER TABLE users ADD COLUMN last_seen_at TEXT;
ALTER TABLE users ADD COLUMN total_active_seconds INTEGER NOT NULL DEFAULT 0;

-- 기존 유저는 정확한 가입일을 모르니 updated_at(마지막 동기화 시각)으로 대체
UPDATE users SET created_at = updated_at WHERE created_at IS NULL;
UPDATE users SET last_seen_at = updated_at WHERE last_seen_at IS NULL;
