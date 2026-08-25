-- 친구/프로필/댓글 기능용 D1 스키마

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  custom_name TEXT,
  google_picture TEXT,
  custom_picture TEXT,
  created_at TEXT,
  last_seen_at TEXT,
  total_active_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS friendships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_email TEXT NOT NULL,
  addressee_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted'
  created_at TEXT NOT NULL,
  UNIQUE(requester_email, addressee_email)
);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_email);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_email);

CREATE TABLE IF NOT EXISTS shared_books (
  email TEXT NOT NULL,
  book_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  cover_url TEXT,
  status TEXT,
  rating INTEGER,
  current_page INTEGER,
  pages INTEGER,
  review TEXT,
  updated_at TEXT,
  PRIMARY KEY (email, book_id)
);
CREATE INDEX IF NOT EXISTS idx_shared_books_email ON shared_books(email);

CREATE TABLE IF NOT EXISTS reading_stats (
  email TEXT PRIMARY KEY,
  total_books INTEGER NOT NULL DEFAULT 0,
  done_books INTEGER NOT NULL DEFAULT 0,
  avg_rating REAL NOT NULL DEFAULT 0,
  total_pages INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_email TEXT NOT NULL,
  book_id TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_name TEXT,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_owner_book ON comments(owner_email, book_id);

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
