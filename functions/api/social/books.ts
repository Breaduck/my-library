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
  const books = Array.isArray(body.books) ? body.books : [];

  const db = env.DB;
  const statements = [db.prepare('DELETE FROM shared_books WHERE email = ?').bind(me)];
  for (const b of books) {
    if (!b?.id || !b.title) continue;
    statements.push(
      db.prepare(
        `INSERT INTO shared_books (email, book_id, title, author, cover_url, status, rating, current_page, pages, review, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        me, b.id, b.title, b.author ?? '', b.coverUrl ?? '', b.status ?? '', b.rating ?? 0,
        b.currentPage ?? 0, b.pages ?? 0, b.review ?? '', b.updatedAt ?? new Date().toISOString()
      )
    );
  }
  await db.batch(statements);

  return json({ ok: true, count: books.length });
};
