import { requireEmail, json } from '../../_lib/auth';

interface Env { DB: D1Database; VITE_GOOGLE_CLIENT_ID?: string }

interface StatsRow {
  total_books: number;
  done_books: number;
  avg_rating: number;
  total_pages: number;
  updated_at: string;
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

  const row = await env.DB.prepare('SELECT * FROM reading_stats WHERE email = ?').bind(target).first<StatsRow>();
  if (!row) return json({ stats: null });

  return json({
    stats: {
      totalBooks: row.total_books,
      doneBooks: row.done_books,
      avgRating: row.avg_rating,
      totalPages: row.total_pages,
      updatedAt: row.updated_at,
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const me = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID);
  if (!me) return json({ error: 'unauthorized' }, 401);

  const body = await request.json() as { totalBooks?: number; doneBooks?: number; avgRating?: number; totalPages?: number };

  await env.DB.prepare(
    `INSERT INTO reading_stats (email, total_books, done_books, avg_rating, total_pages, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET total_books = excluded.total_books, done_books = excluded.done_books,
       avg_rating = excluded.avg_rating, total_pages = excluded.total_pages, updated_at = excluded.updated_at`
  ).bind(me, body.totalBooks ?? 0, body.doneBooks ?? 0, body.avgRating ?? 0, body.totalPages ?? 0, new Date().toISOString()).run();

  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const me = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID);
  if (!me) return json({ error: 'unauthorized' }, 401);

  await env.DB.prepare('DELETE FROM reading_stats WHERE email = ?').bind(me).run();
  return json({ ok: true });
};
