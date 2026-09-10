-- 이메일 표준화(canonicalEmail) 이전에 쌓인 데이터를 정리한다.
--
-- 배경: 소셜 기능은 2026-08-05에 나왔지만 이메일 정규화는 2026-08-24에 들어왔다.
-- 그 사이에 가입한 사람 중 Gmail 주소에 점(.)이나 '+별칭'을 쓰는 사용자는
--   hong.gildong@gmail.com (옛 행)  /  honggildong@gmail.com (지금 행)
-- 두 주소로 데이터가 쪼개져 있다. 그 결과
--   - 친구 요청이 옛 주소로 저장돼 상대에게 보이지 않고
--   - 친구가 됐는데도 서재·통계가 비어 보이고
--   - 닉네임 검색에서 유령(옛) 계정이 잡힌다.
-- 이 마이그레이션은 모든 테이블의 이메일 키를 표준형으로 합친다. 여러 번 실행해도 안전하다.

DROP TABLE IF EXISTS _all_emails;
DROP TABLE IF EXISTS _email_canon;

CREATE TABLE _all_emails (e TEXT PRIMARY KEY);
INSERT OR IGNORE INTO _all_emails SELECT email FROM users;
INSERT OR IGNORE INTO _all_emails SELECT requester_email FROM friendships;
INSERT OR IGNORE INTO _all_emails SELECT addressee_email FROM friendships;
INSERT OR IGNORE INTO _all_emails SELECT email FROM shared_books;
INSERT OR IGNORE INTO _all_emails SELECT owner_email FROM comments;
INSERT OR IGNORE INTO _all_emails SELECT author_email FROM comments;
INSERT OR IGNORE INTO _all_emails SELECT email FROM reading_stats;
INSERT OR IGNORE INTO _all_emails SELECT email FROM widget_data;

-- old → new 매핑. functions/_lib/auth.ts 의 canonicalEmail()과 같은 규칙:
-- 소문자화 → '+태그' 제거 → Gmail/Googlemail이면 로컬part의 '.' 제거 후 @gmail.com 으로 통일.
CREATE TABLE _email_canon (old TEXT PRIMARY KEY, new TEXT NOT NULL);
INSERT INTO _email_canon (old, new)
SELECT e, canon FROM (
  SELECT e,
    CASE
      WHEN substr(lower(e), instr(e, '@') + 1) IN ('gmail.com', 'googlemail.com')
        THEN replace(
               CASE WHEN instr(lower(e), '+') > 0
                    THEN substr(lower(e), 1, instr(lower(e), '+') - 1)
                    ELSE substr(lower(e), 1, instr(e, '@') - 1) END,
               '.', '') || '@gmail.com'
      ELSE lower(e)
    END AS canon
  FROM _all_emails
  WHERE instr(e, '@') > 1
)
WHERE e <> canon;

-- ── users ────────────────────────────────────────────────────────────────
-- 표준 주소 행에 닉네임/사진이 비어 있으면 옛 행에서 가져온다(설정을 잃지 않게).
UPDATE users SET
  custom_name = COALESCE(NULLIF(custom_name, ''),
    (SELECT NULLIF(o.custom_name, '') FROM users o JOIN _email_canon m ON o.email = m.old WHERE m.new = users.email)),
  custom_picture = COALESCE(NULLIF(custom_picture, ''),
    (SELECT NULLIF(o.custom_picture, '') FROM users o JOIN _email_canon m ON o.email = m.old WHERE m.new = users.email))
WHERE email IN (SELECT new FROM _email_canon);

DELETE FROM users WHERE email IN (SELECT old FROM _email_canon WHERE new IN (SELECT email FROM users));

UPDATE users SET email = (SELECT new FROM _email_canon WHERE old = users.email)
WHERE email IN (SELECT old FROM _email_canon);

-- ── friendships ──────────────────────────────────────────────────────────
-- UNIQUE(requester, addressee) 때문에 바로 UPDATE 하면 충돌한다 → 표준 주소로 다시 넣고 옛 행 제거.
INSERT OR IGNORE INTO friendships (requester_email, addressee_email, status, created_at)
SELECT COALESCE(mr.new, f.requester_email), COALESCE(ma.new, f.addressee_email), f.status, f.created_at
FROM friendships f
LEFT JOIN _email_canon mr ON mr.old = f.requester_email
LEFT JOIN _email_canon ma ON ma.old = f.addressee_email
WHERE mr.old IS NOT NULL OR ma.old IS NOT NULL;

-- 옛 행이 'accepted'였는데 표준 행이 'pending'으로 남았다면 친구 상태를 유지시킨다.
UPDATE friendships SET status = 'accepted'
WHERE status = 'pending' AND EXISTS (
  SELECT 1 FROM friendships f
  LEFT JOIN _email_canon mr ON mr.old = f.requester_email
  LEFT JOIN _email_canon ma ON ma.old = f.addressee_email
  WHERE f.status = 'accepted'
    AND COALESCE(mr.new, f.requester_email) = friendships.requester_email
    AND COALESCE(ma.new, f.addressee_email) = friendships.addressee_email
);

DELETE FROM friendships
WHERE requester_email IN (SELECT old FROM _email_canon)
   OR addressee_email IN (SELECT old FROM _email_canon);

-- 자기 자신과의 친구 관계(정규화로 양쪽이 같아진 경우) 제거
DELETE FROM friendships WHERE requester_email = addressee_email;

-- ── shared_books ─────────────────────────────────────────────────────────
-- 앱은 동기화할 때마다 서재 전체를 다시 쓰므로 표준 주소 쪽이 최신이다 → 없는 것만 옮긴다.
INSERT OR IGNORE INTO shared_books (email, book_id, title, author, cover_url, status, rating, current_page, pages, review, updated_at)
SELECT m.new, s.book_id, s.title, s.author, s.cover_url, s.status, s.rating, s.current_page, s.pages, s.review, s.updated_at
FROM shared_books s JOIN _email_canon m ON m.old = s.email;

DELETE FROM shared_books WHERE email IN (SELECT old FROM _email_canon);

-- ── comments ─────────────────────────────────────────────────────────────
UPDATE comments SET owner_email = (SELECT new FROM _email_canon WHERE old = comments.owner_email)
WHERE owner_email IN (SELECT old FROM _email_canon);
UPDATE comments SET author_email = (SELECT new FROM _email_canon WHERE old = comments.author_email)
WHERE author_email IN (SELECT old FROM _email_canon);

-- ── reading_stats ────────────────────────────────────────────────────────
INSERT OR IGNORE INTO reading_stats (email, total_books, done_books, avg_rating, total_pages, updated_at)
SELECT m.new, r.total_books, r.done_books, r.avg_rating, r.total_pages, r.updated_at
FROM reading_stats r JOIN _email_canon m ON m.old = r.email;
DELETE FROM reading_stats WHERE email IN (SELECT old FROM _email_canon);

-- ── widget_data ──────────────────────────────────────────────────────────
-- ★ token 에도 UNIQUE가 걸려 있어 INSERT OR IGNORE 로 옮기면 토큰 충돌로 통째로 무시된 뒤
--   원본이 삭제돼 위젯 데이터가 사라진다. 그래서 '중복 제거 후 이름 바꾸기' 순서로 처리한다.
DELETE FROM widget_data WHERE email IN (SELECT old FROM _email_canon WHERE new IN (SELECT email FROM widget_data));

UPDATE widget_data SET email = (SELECT new FROM _email_canon WHERE old = widget_data.email)
WHERE email IN (SELECT old FROM _email_canon);

DROP TABLE _all_emails;
DROP TABLE _email_canon;
