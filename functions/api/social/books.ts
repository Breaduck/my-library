import { requireEmail, json } from '../../_lib/auth';

interface Env { DB: D1Database; VITE_GOOGLE_CLIENT_ID?: string }

interface SharedBookRow {
  book_id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  status: string | null;
  rating: number | null;
  current_page: number | null;
  pages: number | null;
  review: string | null;
  updated_at: string | null;
}

interface SyncBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  status: string;
  rating: number;
  currentPage?: number;
  pages?: number;
  review?: string;
  updatedAt?: string;
}

async function areFriends(db: D1Database, a: string, b: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM friendships WHERE status = 'accepted' AND ((requester_email = ? AND addressee_email = ?) OR (requester_email = ? AND addressee_email = ?))`
  ).bind(a, b, b, a).first();
  return !!row;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const me = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID);
  if (!me) return json({ error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  const target = url.searchParams.get('email')?.toLowerCase().trim() ?? '';
  if (!target) return json({ error: 'missing-email' }, 400);

  if (target !== me && !(await areFriends(env.DB, me, target))) {
    return json({ error: 'not-friends' }, 403);
  }

  const { results } = await env.DB.prepare(
    'SELECT book_id, title, author, cover_url, status, rating, current_page, pages, review, updated_at FROM shared_books WHERE email = ? ORDER BY updated_at DESC'
  ).bind(target).all<SharedBookRow>();

  return json({
    books: (results ?? []).map((r) => ({
      id: r.book_id,
      title: r.title,
      author: r.author ?? '',
      coverUrl: r.cover_url ?? '',
      status: r.status ?? '',
      rating: r.rating ?? 0,
      currentPage: r.current_page ?? 0,
      pages: r.pages ?? 0,
      review: r.review ?? '',
      updatedAt: r.updated_at ?? '',
    })),
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const me = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID);
  if (!me) return json({ error: 'unauthorized' }, 401);

  const body = await request.json() as { books?: SyncBook[] };
  // 저장소 남용 방지를 위한 상한 — 개수·문자열 길이·수치 범위를 서버에서 강제한다.
  const MAX_BOOKS = 1000;
  const books = (Array.isArray(body.books) ? body.books : []).slice(0, MAX_BOOKS);

  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const num = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(Math.round(v), min), max) : min;
  // 표지 URL은 http(s)만 허용(javascript:/data: 등 차단), 그 외엔 빈 값으로
  const safeUrl = (v: unknown) => {
    const s = typeof v === 'string' ? v.slice(0, 2000) : '';
    return /^https?:\/\//i.test(s) ? s : '';
  };

  const db = env.DB;
  const statements = [db.prepare('DELETE FROM shared_books WHERE email = ?').bind(me)];
  for (const b of books) {
    if (!b?.id || !b.title) continue;
    statements.push(
      db.prepare(
        `INSERT INTO shared_books (email, book_id, title, author, cover_url, status, rating, current_page, pages, review, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        me, str(b.id, 128), str(b.title, 500), str(b.author, 300), safeUrl(b.coverUrl),
        str(b.status, 32), num(b.rating, 0, 5), num(b.currentPage, 0, 1_000_000),
        num(b.pages, 0, 1_000_000), str(b.review, 20_000), str(b.updatedAt, 40) || new Date().toISOString()
      )
    );
  }
  await db.batch(statements);

  return json({ ok: true, count: books.length });
};
