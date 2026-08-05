import { requireEmail, json } from '../../_lib/auth';

interface Env { DB: D1Database }

interface UserRow {
  email: string;
  name: string;
  custom_name: string | null;
  google_picture: string | null;
  custom_picture: string | null;
}

// 닉네임(custom_name) 정확히 일치하는 사용자 찾기 — 친구 추가용.
// 무작위 조회 남용을 막기 위해 부분/접두 검색은 지원하지 않고 정확히 일치할 때만 반환.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const me = await requireEmail(request);
  if (!me) return json({ error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  const nickname = url.searchParams.get('nickname')?.trim() ?? '';
  if (!nickname) return json({ users: [] });

  const { results } = await env.DB.prepare(
    'SELECT email, name, custom_name, google_picture, custom_picture FROM users WHERE custom_name = ? COLLATE NOCASE LIMIT 10'
  ).bind(nickname).all<UserRow>();

  const users = (results ?? [])
    .filter((r) => r.email !== me)
    .map((r) => ({
      email: r.email,
      name: (r.custom_name || r.name) ?? r.email,
      picture: (r.custom_picture || r.google_picture) ?? '',
    }));

  return json({ users });
};
