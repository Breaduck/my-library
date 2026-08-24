import { requireEmail, json } from '../../_lib/auth';

interface Env { DB: D1Database; VITE_GOOGLE_CLIENT_ID?: string }

interface Row {
  id: number;
  book_id: string;
  title: string | null;
  cover_url: string | null;
  author_email: string;
  author_name: string | null;
  text: string;
  created_at: string;
}

// 내 책에 '다른 사람'이 남긴 댓글 목록 — 알림/확인용.
// 책 제목·표지는 내가 공유한 shared_books에서 가져와 함께 내려준다.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const me = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID);
  if (!me) return json({ error: 'unauthorized' }, 401);

  const { results } = await env.DB.prepare(
    `SELECT c.id, c.book_id, c.author_email, c.author_name, c.text, c.created_at,
            s.title AS title, s.cover_url AS cover_url
       FROM comments c
       LEFT JOIN shared_books s ON s.email = c.owner_email AND s.book_id = c.book_id
      WHERE c.owner_email = ? AND c.author_email <> ?
      ORDER BY c.created_at DESC
      LIMIT 100`
  ).bind(me, me).all<Row>();

  return json({
    notifications: (results ?? []).map((r) => ({
      id: r.id,
      bookId: r.book_id,
      bookTitle: r.title ?? '내 책',
      coverUrl: r.cover_url ?? '',
      authorName: r.author_name ?? r.author_email,
      text: r.text,
      createdAt: r.created_at,
    })),
  });
};
