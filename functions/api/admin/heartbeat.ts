import { requireEmail, json } from '../../_lib/auth';

interface Env { DB: D1Database }

// 로그인한 사용자가 앱을 보고 있는 동안 주기적으로(30초마다) 호출 — 대략적인 체류시간 집계용.
// 탭이 백그라운드거나 닫혀 있으면 프론트에서 호출하지 않으므로 실제 사용 시간에 가깝다.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = await requireEmail(request);
  if (!email) return json({ error: 'unauthorized' }, 401);

  const body = await request.json().catch(() => ({})) as { seconds?: number };
  const seconds = Math.min(Math.max(Math.round(body.seconds ?? 30), 1), 120);

  await env.DB.prepare(
    `UPDATE users SET total_active_seconds = total_active_seconds + ?, last_seen_at = ? WHERE email = ?`
  ).bind(seconds, new Date().toISOString(), email).run();

  return json({ ok: true });
};
