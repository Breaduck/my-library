CREATE TABLE IF NOT EXISTS widget_data (
  email TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  streak INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  level_title TEXT,
  today_pages INTEGER NOT NULL DEFAULT 0,
  daily_goal INTEGER NOT NULL DEFAULT 30,
  freezes INTEGER NOT NULL DEFAULT 0,
  read_today INTEGER NOT NULL DEFAULT 0,
  display_name TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_widget_token ON widget_data(token);
