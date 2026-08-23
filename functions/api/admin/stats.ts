import { requireEmail, json, isAdmin } from '../../_lib/auth';

interface Env { DB: D1Database; ADMIN_EMAILS?: string; VITE_GOOGLE_CLIENT_ID?: string }

interface CountRow { c: number }
interface DayRow { day: string; c: number }
interface UserRow {
  email: string; name: string; custom_name: string | null;
  created_at: string | null; last_seen_at: string | null; total_active_seconds: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID);
  if (!email) return json({ error: 'unauthorized' }, 401);
  if (!isAdmin(email, env.ADMIN_EMAILS)) return json({ error: 'forbidden' }, 403);

  const db = env.DB;
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    totalUsers, newUsers7d, newUsers30d, active7d, active30d,
    totalFriendships, totalComments, totalSharedBooks, signupsByDay, recentUsers,
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) as c FROM users').first<CountRow>(),
    db.prepare('SELECT COUNT(*) as c FROM users WHERE created_at >= ?').bind(sevenDaysAgo).first<CountRow>(),
    db.prepare('SELECT COUNT(*) as c FROM users WHERE created_at >= ?').bind(thirtyDaysAgo).first<CountRow>(),
    db.prepare('SELECT COUNT(*) as c FROM users WHERE last_seen_at >= ?').bind(sevenDaysAgo).first<CountRow>(),
    db.prepare('SELECT COUNT(*) as c FROM users WHERE last_seen_at >= ?').bind(thirtyDaysAgo).first<CountRow>(),
    db.prepare(`SELECT COUNT(*) as c FROM friendships WHERE status = 'accepted'`).first<CountRow>(),
    db.prepare('SELECT COUNT(*) as c FROM comments').first<CountRow>(),
    db.prepare('SELECT COUNT(DISTINCT email) as c FROM shared_books').first<CountRow>(),
    db.prepare(
      `SELECT substr(created_at, 1, 10) as day, COUNT(*) as c FROM users
       WHERE created_at >= ? GROUP BY day ORDER BY day ASC`
    ).bind(thirtyDaysAgo).all<DayRow>(),
    db.prepare(
      `SELECT email, name, custom_name, created_at, last_seen_at, total_active_seconds
       FROM users ORDER BY created_at DESC LIMIT 20`
    ).all<UserRow>(),
  ]);

  return json({
    totalUsers: totalUsers?.c ?? 0,
    newUsers7d: newUsers7d?.c ?? 0,
    newUsers30d: newUsers30d?.c ?? 0,
    active7d: active7d?.c ?? 0,
    active30d: active30d?.c ?? 0,
    totalFriendships: totalFriendships?.c ?? 0,
    totalComments: totalComments?.c ?? 0,
    totalSharedBooks: totalSharedBooks?.c ?? 0,
    signupsByDay: signupsByDay.results ?? [],
    recentUsers: (recentUsers.results ?? []).map((r) => ({
      email: r.email,
      name: r.custom_name || r.name,
      createdAt: r.created_at,
      lastSeenAt: r.last_seen_at,
      activeMinutes: Math.round((r.total_active_seconds ?? 0) / 60),
    })),
  });
};
