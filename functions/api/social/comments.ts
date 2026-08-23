import { requireEmail, json } from '../../_lib/auth';

interface Env { DB: D1Database; VITE_GOOGLE_CLIENT_ID?: string }

interface CommentRow {
  id: number;
  author_email: string;
  author_name: string | null;
  text: string;
  created_at: string;
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
  const owner = url.searchParams.get('owner')?.toLowerCase().trim() ?? '';
  const bookId = url.searchParams.get('bookId') ?? '';
  if (!owner || !bookId) return json({ error: 'missing-params' }, 400);

  if (owner !== me && !(await areFriends(env.DB, me, owner))) {
    return json({ error: 'not-friends' }, 403);
  }

  const { results } = await env.DB.prepare(
    'SELECT id, author_email, author_name, text, created_at FROM comments WHERE owner_email = ? AND book_id = ? ORDER BY created_at ASC'
  ).bind(owner, bookId).all<CommentRow>();

  return json({
    comments: (results ?? []).map((r) => ({
      id: r.id,
      authorEmail: r.author_email,
      authorName: r.author_name ?? r.author_email,
      text: r.text,
      createdAt: r.created_at,
    })),
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const me = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID);
  if (!me) return json({ error: 'unauthorized' }, 401);

  const body = await request.json() as { owner?: string; bookId?: string; text?: string; authorName?: string };
  const owner = body.owner?.toLowerCase().trim() ?? '';
  const bookId = body.bookId ?? '';
  const text = body.text?.trim() ?? '';
  if (!owner || !bookId || !text) return json({ error: 'missing-params' }, 400);
  if (text.length > 1000) return json({ error: 'text-too-long' }, 400);

  if (owner !== me && !(await areFriends(env.DB, me, owner))) {
    return json({ error: 'not-friends' }, 403);
  }

  const createdAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO comments (owner_email, book_id, author_email, author_name, text, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(owner, bookId, me, body.authorName ?? me, text, createdAt).run();

  return json({ ok: true, createdAt });
};
