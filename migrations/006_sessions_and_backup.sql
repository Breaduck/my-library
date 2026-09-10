-- 자체 세션 토큰 + 서버 백업.
--
-- 배경: 지금까지 모든 API를 구글 액세스 토큰으로 인증했는데, 이 토큰은 구글이 1시간으로
-- 강제하고 배경 재발급(refresh token)은 현재 로그인 방식(GIS initTokenClient)에서 아예
-- 발급되지 않는다. 그래서 한 시간만 지나면 친구 기능이 조용히 죽고 백업도 밀렸다.
-- → 구글 로그인은 '신원 확인' 한 번만 쓰고, 그 뒤 우리 API는 우리가 발급한 세션 토큰으로
--   인증한다. 만료는 우리가 정한다(90일, 사용할 때마다 연장).

CREATE TABLE IF NOT EXISTS sessions (
  -- ★ 토큰 원문은 저장하지 않는다. SHA-256 해시만 보관 — DB가 유출돼도 그대로는 못 쓴다.
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ── 서버 백업 ────────────────────────────────────────────────────────────
-- ★ 책 한 권 = 한 행. D1은 행/문자열 하나가 2 MB를 넘을 수 없는데, 직접 올린 표지가
--   data URL(600px JPEG ≈ 40~80 KB)이라 서재 전체를 JSON 한 덩어리로 넣으면 그 한계에 닿는다.
--   권당 한 행이면 표지가 있어도 100 KB 수준이라 여유가 크다.
CREATE TABLE IF NOT EXISTS backup_books (
  email TEXT NOT NULL,
  book_id TEXT NOT NULL,
  json TEXT NOT NULL,      -- Book 객체 원본(앱이 쓰는 형태 그대로 — 복원이 무손실)
  updated_at TEXT NOT NULL,
  PRIMARY KEY (email, book_id)
);
CREATE INDEX IF NOT EXISTS idx_backup_books_email ON backup_books(email);

-- 책 외 개인 데이터(삭제 툼스톤·일별 기록·연속 독서 날짜·목표·리셋 에포크)
CREATE TABLE IF NOT EXISTS backup_meta (
  email TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
