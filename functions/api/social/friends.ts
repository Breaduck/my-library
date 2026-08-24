import { requireEmail, canonicalEmail, json } from '../../_lib/auth';

interface Env { DB: D1Database; VITE_GOOGLE_CLIENT_ID?: string }

interface UserRow {
  email: string;
  name: string;
  custom_name: string | null;
  google_picture: string | null;
  custom_picture: string | null;
}

interface FriendshipRow {
  requester_email: string;
  addressee_email: string;
  status: string;
  created_at: string;
}

function pictureOf(row: UserRow | undefined, email: string) {
  return {
    email,
    name: (row?.custom_name || row?.name) ?? email,
    picture: (row?.custom_picture || row?.google_picture) ?? '',
  };
}

async function fetchUsers(db: D1Database, emails: string[]): Promise<Map<string, UserRow>> {
  const unique = Array.from(new Set(emails));
  const map = new Map<string, UserRow>();
  if (unique.length === 0) return map;
  const placeholders = unique.map(() => '?').join(',');
  const { results } = await db.prepare(`SELECT * FROM users WHERE email IN (${placeholders})`).bind(...unique).all<UserRow>();
  for (const r of results ?? []) map.set(r.email, r);
  return map;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID);
  if (!email) return json({ error: 'unauthorized' }, 401);

  const [accepted, incoming, outgoing] = await Promise.all([
    env.DB.prepare(`SELECT * FROM friendships WHERE status = 'accepted' AND (requester_email = ? OR addressee_email = ?)`).bind(email, email).all<FriendshipRow>(),
    env.DB.prepare(`SELECT * FROM friendships WHERE status = 'pending' AND addressee_email = ?`).bind(email).all<FriendshipRow>(),
    env.DB.prepare(`SELECT * FROM friendships WHERE status = 'pending' AND requester_email = ?`).bind(email).all<FriendshipRow>(),
  ]);

  const friendEmails = (accepted.results ?? []).map((r) => (r.requester_email === email ? r.addressee_email : r.requester_email));
  const incomingEmails = (incoming.results ?? []).map((r) => r.requester_email);
  const outgoingEmails = (outgoing.results ?? []).map((r) => r.addressee_email);
  const users = await fetchUsers(env.DB, [...friendEmails, ...incomingEmails, ...outgoingEmails]);

  return json({
    friends: friendEmails.map((e) => pictureOf(users.get(e), e)),
    incoming: (incoming.results ?? []).map((r) => ({ ...pictureOf(users.get(r.requester_email), r.requester_email), createdAt: r.created_at })),
    outgoing: (outgoing.results ?? []).map((r) => ({ ...pictureOf(users.get(r.addressee_email), r.addressee_email), createdAt: r.created_at })),
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const me = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID);
  if (!me) return json({ error: 'unauthorized' }, 401);

  const body = await request.json() as { action?: string; email?: string };
  const action = body.action;
  // 상대가 실제 로그인하는 주소와 어긋나 요청이 누락되지 않도록 표준형으로 맞춘다(대소문자·Gmail 점/별칭).
  const target = canonicalEmail(body.email ?? '');

  if (!target || !EMAIL_RE.test(target)) return json({ error: 'invalid-email' }, 400);
  if (target === me) return json({ error: 'cannot-friend-self' }, 400);

  const db = env.DB;

  if (action === 'invite') {
    // 상대가 이미 나에게 보낸 요청이 있으면 → 즉시 친구 수락(맞초대)
    const reverse = await db.prepare(`SELECT * FROM friendships WHERE requester_email = ? AND addressee_email = ? AND status = 'pending'`).bind(target, me).first();
    if (reverse) {
      await db.prepare(`UPDATE friendships SET status = 'accepted' WHERE requester_email = ? AND addressee_email = ?`).bind(target, me).run();
      return json({ ok: true, status: 'accepted' });
    }
    const existing = await db.prepare(`SELECT * FROM friendships WHERE (requester_email = ? AND addressee_email = ?) OR (requester_email = ? AND addressee_email = ?)`).bind(me, target, target, me).first();
    if (existing) return json({ ok: true, status: 'already-exists' });
    await db.prepare(`INSERT INTO friendships (requester_email, addressee_email, status, created_at) VALUES (?, ?, 'pending', ?)`)
      .bind(me, target, new Date().toISOString()).run();
    return json({ ok: true, status: 'pending' });
  }

  if (action === 'accept') {
    await db.prepare(`UPDATE friendships SET status = 'accepted' WHERE requester_email = ? AND addressee_email = ? AND status = 'pending'`).bind(target, me).run();
    return json({ ok: true });
  }

  if (action === 'decline') {
    await db.prepare(`DELETE FROM friendships WHERE status = 'pending' AND ((requester_email = ? AND addressee_email = ?) OR (requester_email = ? AND addressee_email = ?))`)
      .bind(me, target, target, me).run();
    return json({ ok: true });
  }

  if (action === 'remove') {
    await db.prepare(`DELETE FROM friendships WHERE status = 'accepted' AND ((requester_email = ? AND addressee_email = ?) OR (requester_email = ? AND addressee_email = ?))`)
      .bind(me, target, target, me).run();
    return json({ ok: true });
  }

  return json({ error: 'unknown-action' }, 400);
};
