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
  const email = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID, env.DB);
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
  const me = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID, env.DB);
  if (!me) return json({ error: 'unauthorized' }, 401);

  const body = await request.json() as { action?: string; email?: string };
  const action = body.action;
  // 상대가 실제 로그인하는 주소와 어긋나 요청이 누락되지 않도록 표준형으로 맞춘다(대소문자·Gmail 점/별칭).
  const target = canonicalEmail(body.email ?? '');

  if (!target || !EMAIL_RE.test(target)) return json({ error: 'invalid-email' }, 400);
  if (target === me) return json({ error: 'cannot-friend-self' }, 400);

  const db = env.DB;

  if (action === 'invite') {
    // 양방향 기존 관계를 한 번에 조회 — 어느 방향이든 이미 친구/요청 중이면 중복 생성하지 않는다.
    const existing = await db.prepare(
      `SELECT requester_email, addressee_email, status FROM friendships
        WHERE (requester_email = ? AND addressee_email = ?) OR (requester_email = ? AND addressee_email = ?)`
    ).bind(me, target, target, me).first<FriendshipRow>();

    if (existing?.status === 'accepted') return json({ ok: true, status: 'already-friends' });

    // 상대가 이미 나에게 보낸 요청이 있으면 → 즉시 친구 성립(맞초대)
    if (existing?.status === 'pending' && existing.requester_email === target) {
      await db.prepare(`UPDATE friendships SET status = 'accepted' WHERE requester_email = ? AND addressee_email = ?`)
        .bind(target, me).run();
      return json({ ok: true, status: 'accepted' });
    }
    // 내가 이미 보낸 요청이 대기 중
    if (existing?.status === 'pending') return json({ ok: true, status: 'already-exists' });

    await db.prepare(`INSERT INTO friendships (requester_email, addressee_email, status, created_at) VALUES (?, ?, 'pending', ?)`)
      .bind(me, target, new Date().toISOString()).run();
    return json({ ok: true, status: 'pending' });
  }

  if (action === 'accept') {
    // 상대→나 방향의 대기 요청을 수락. 화면이 오래된 목록을 보여주고 있거나(상대가 취소함)
    // 이미 처리된 요청을 다시 누른 경우를 구분해 알려준다 — 예전엔 무엇도 안 바뀌었는데 ok만 돌려줘
    // "수락했는데 친구가 안 됐다"로 보였다.
    const res = await db.prepare(
      `UPDATE friendships SET status = 'accepted' WHERE requester_email = ? AND addressee_email = ? AND status = 'pending'`
    ).bind(target, me).run();
    if ((res.meta?.changes ?? 0) > 0) return json({ ok: true, status: 'accepted' });

    const already = await db.prepare(
      `SELECT status FROM friendships WHERE status = 'accepted' AND ((requester_email = ? AND addressee_email = ?) OR (requester_email = ? AND addressee_email = ?))`
    ).bind(me, target, target, me).first();
    if (already) return json({ ok: true, status: 'already-friends' });

    // 받은 요청이 사라졌다면(상대가 취소) 대신 내가 요청을 보내 관계가 끊기지 않게 한다.
    await db.prepare(`INSERT OR IGNORE INTO friendships (requester_email, addressee_email, status, created_at) VALUES (?, ?, 'pending', ?)`)
      .bind(me, target, new Date().toISOString()).run();
    return json({ ok: true, status: 'pending' });
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
