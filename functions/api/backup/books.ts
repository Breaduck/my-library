// 서버 백업 — 구글 Drive와 별개로 우리 D1에도 서재를 통째로 보관한다.
//
// Drive 백업은 구글 토큰이 살아 있어야만 동작해서, 토큰이 만료된 구간의 변경은 로컬에만
// 남았다. 이 백업은 우리 세션 토큰(90일)으로 인증하므로 그 공백을 메운다.
//
// ★ 책 한 권 = 한 행. D1은 행/문자열 하나가 2 MB를 넘을 수 없는데 직접 올린 표지가
//   data URL이라, 서재 전체를 JSON 한 덩어리로 넣으면 그 한계에 닿는다.
import { requireEmail, json } from '../../_lib/auth';

interface Env { DB: D1Database; VITE_GOOGLE_CLIENT_ID?: string }

// 한 권이 지나치게 크면(표지 data URL이 비정상적으로 큰 경우) 행 한계에 걸려 배치 전체가
// 실패한다. 그런 책은 표지를 떼고 저장한다 — 기록을 통째로 잃는 것보다 낫다.
const MAX_BOOK_BYTES = 1_500_000;
const MAX_BOOKS = 2000;
const MAX_META_BYTES = 1_500_000;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const me = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID, env.DB);
  if (!me) return json({ error: 'unauthorized' }, 401);

  const [books, meta] = await Promise.all([
    env.DB.prepare('SELECT json FROM backup_books WHERE email = ?').bind(me).all<{ json: string }>(),
    env.DB.prepare('SELECT json, updated_at FROM backup_meta WHERE email = ?').bind(me).first<{ json: string; updated_at: string }>(),
  ]);

  const parsed: unknown[] = [];
  for (const r of books.results ?? []) {
    try { parsed.push(JSON.parse(r.json)); } catch { /* 깨진 행 하나가 복원 전체를 막지 않게 */ }
  }
  let metaObj: unknown = null;
  if (meta?.json) { try { metaObj = JSON.parse(meta.json); } catch { /* 무시 */ } }

  return json({ books: parsed, meta: metaObj, updatedAt: meta?.updated_at ?? '' });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const me = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID, env.DB);
  if (!me) return json({ error: 'unauthorized' }, 401);

  const body = await request.json() as { books?: { id?: string }[]; meta?: unknown };
  if (!Array.isArray(body.books)) return json({ error: 'books-required' }, 400);

  const now = new Date().toISOString();
  const books = body.books.slice(0, MAX_BOOKS);

  // ★ 통째 교체(DELETE 후 INSERT)를 하되 한 배치(트랜잭션)로 처리한다.
  // 중간에 실패하면 아무것도 반영되지 않아, 백업이 반쯤 지워진 상태로 남지 않는다.
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM backup_books WHERE email = ?').bind(me),
  ];

  let trimmed = 0;
  for (const b of books) {
    if (!b || typeof b.id !== 'string' || !b.id) continue;
    let text = JSON.stringify(b);
    if (text.length > MAX_BOOK_BYTES) {
      // 표지를 떼고 다시 시도 — 그래도 크면 이 책은 건너뛴다(나머지 백업은 지킨다).
      text = JSON.stringify({ ...b, coverUrl: '' });
      trimmed++;
      if (text.length > MAX_BOOK_BYTES) continue;
    }
    statements.push(
      env.DB.prepare('INSERT INTO backup_books (email, book_id, json, updated_at) VALUES (?, ?, ?, ?)')
        .bind(me, b.id.slice(0, 128), text, now)
    );
  }

  if (body.meta !== undefined) {
    const metaText = JSON.stringify(body.meta);
    if (metaText.length <= MAX_META_BYTES) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO backup_meta (email, json, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`
        ).bind(me, metaText, now)
      );
    }
  }

  await env.DB.batch(statements);
  return json({ ok: true, count: statements.length - 1, trimmed, updatedAt: now });
};
