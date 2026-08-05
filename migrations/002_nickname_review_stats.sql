ALTER TABLE users ADD COLUMN custom_name TEXT;

ALTER TABLE shared_books ADD COLUMN current_page INTEGER;
ALTER TABLE shared_books ADD COLUMN pages INTEGER;
ALTER TABLE shared_books ADD COLUMN review TEXT;

CREATE TABLE IF NOT EXISTS reading_stats (
  email TEXT PRIMARY KEY,
  total_books INTEGER NOT NULL DEFAULT 0,
  done_books INTEGER NOT NULL DEFAULT 0,
  avg_rating REAL NOT NULL DEFAULT 0,
  total_pages INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
