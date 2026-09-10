// 세션 발급/해지.
//
// POST: 구글 액세스 토큰으로 신원을 확인하고 우리 세션 토큰을 발급한다.
//   구글 토큰은 1시간이면 만료되지만(그리고 현재 로그인 방식은 refresh token을 주지 않는다),
//   여기서 받은 세션 토큰은 90일간 유효하고 쓸 때마다 연장된다.
//   → 로그인 한 번으로 친구 기능·백업이 계속 동작한다.
// DELETE: 로그아웃 — 세션을 즉시 무효화한다.
import { requireEmail, createSession, revokeSession, SESSION_PREFIX, json } from '../../_lib/auth';

interface Env { DB: D1Database; VITE_GOOGLE_CLIENT_ID?: string }

function bearer(request: Request): string {
  const auth = request.headers.get('Authorization') ?? '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const token = bearer(request);
  // ★ 세션 발급은 반드시 '구글 토큰'으로만 가능해야 한다. 세션 토큰으로 새 세션을 찍어낼 수
  // 있으면 한 번 유출된 토큰이 무한히 갱신돼 해지가 의미를 잃는다.
  if (!token || token.startsWith(SESSION_PREFIX)) return json({ error: 'google-token-required' }, 401);

  const email = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID);
  if (!email) return json({ error: 'unauthorized' }, 401);

  // 만료된 세션 찌꺼기는 이 기회에 정리(별도 크론 없이 유지보수)
  await env.DB.prepare('DELETE FROM sessions WHERE email = ? AND expires_at <= ?')
    .bind(email, new Date().toISOString()).run();

  const session = await createSession(env.DB, email);
  return json({ token: session, email });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const token = bearer(request);
  if (token.startsWith(SESSION_PREFIX)) await revokeSession(env.DB, token);
  return json({ ok: true });
};
