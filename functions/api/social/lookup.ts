import { requireEmail, canonicalEmail, json } from '../../_lib/auth';

interface Env { DB: D1Database; VITE_GOOGLE_CLIENT_ID?: string }

interface UserRow {
  email: string;
  name: string;
  custom_name: string | null;
  google_picture: string | null;
  custom_picture: string | null;
}

const SELECT = 'SELECT email, name, custom_name, google_picture, custom_picture FROM users';

// LIKE 패턴에서 와일드카드(%, _)와 이스케이프 문자는 리터럴로 취급되게 escape 한다.
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// 닉네임/이름으로 사용자 찾기 — 친구 추가용.
// 예전엔 '완전 일치'만 지원해서, 저장된 이름에 공백이 섞여 있거나 사용자가 이름 일부만
// 기억하면 "일치하는 닉네임이 없어요"만 떴다. 이제 완전 일치 → 부분 일치 순으로 찾고,
// 이메일을 입력한 경우엔 이메일로도 찾는다. (무작위 수집 방지를 위해 2글자 이상 + LIMIT 유지)
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const me = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID, env.DB);
  if (!me) return json({ error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get('nickname') ?? '').trim();
  if (!q) return json({ users: [] });

  const rows = new Map<string, UserRow>();
  const collect = (results: UserRow[] | undefined) => {
    for (const r of results ?? []) if (!rows.has(r.email)) rows.set(r.email, r);
  };

  // 1) 완전 일치 (저장된 값의 앞뒤 공백은 무시)
  const exact = await env.DB.prepare(
    `${SELECT} WHERE TRIM(custom_name) = ? COLLATE NOCASE OR TRIM(name) = ? COLLATE NOCASE LIMIT 10`
  ).bind(q, q).all<UserRow>();
  collect(exact.results);

  // 2) 이메일로 입력한 경우
  if (rows.size < 10 && q.includes('@')) {
    const byEmail = await env.DB.prepare(`${SELECT} WHERE email = ? LIMIT 5`)
      .bind(canonicalEmail(q)).all<UserRow>();
    collect(byEmail.results);
  }

  // 3) 부분 일치 (2글자 이상일 때만)
  if (rows.size < 10 && q.length >= 2) {
    const pattern = `%${escapeLike(q)}%`;
    const partial = await env.DB.prepare(
      `${SELECT} WHERE custom_name LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' LIMIT 10`
    ).bind(pattern, pattern).all<UserRow>();
    collect(partial.results);
  }

  const users = Array.from(rows.values())
    .filter((r) => r.email !== me)
    .slice(0, 10)
    .map((r) => ({
      email: r.email,
      name: (r.custom_name || r.name) ?? r.email,
      picture: (r.custom_picture || r.google_picture) ?? '',
    }));

  return json({ users });
};
