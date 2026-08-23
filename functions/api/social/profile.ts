import { requireEmail, json } from '../../_lib/auth';

interface Env { DB: D1Database; VITE_GOOGLE_CLIENT_ID?: string }

interface UserRow {
  email: string;
  name: string;
  custom_name: string | null;
  google_picture: string | null;
  custom_picture: string | null;
}

function toProfile(row: UserRow) {
  return {
    email: row.email,
    name: row.name,
    customName: row.custom_name ?? '',
    googlePicture: row.google_picture ?? '',
    customPicture: row.custom_picture ?? '',
  };
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID);
  if (!email) return json({ error: 'unauthorized' }, 401);

  const row = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (!row) return json({ profile: null });
  return json({ profile: toProfile(row) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID);
  if (!email) return json({ error: 'unauthorized' }, 401);

  const body = await request.json() as { name?: string; googlePicture?: string; customPicture?: string | null; customName?: string | null };
  const existing = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();

  // name/googlePicture: 로그인할 때마다 구글 최신 정보로 갱신
  // customName/customPicture: 사용자가 설정에서 명시적으로 바꿨을 때만 갱신(닉네임/사진 유지)
  const name = body.name ?? existing?.name ?? email;
  const googlePicture = body.googlePicture ?? existing?.google_picture ?? '';
  const customPicture = 'customPicture' in body ? (body.customPicture ?? '') : (existing?.custom_picture ?? '');
  const customName = 'customName' in body ? (body.customName ?? '') : (existing?.custom_name ?? '');
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO users (email, name, custom_name, google_picture, custom_picture, created_at, last_seen_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET name = excluded.name, custom_name = excluded.custom_name,
       google_picture = excluded.google_picture, custom_picture = excluded.custom_picture,
       last_seen_at = excluded.last_seen_at, updated_at = excluded.updated_at`
  ).bind(email, name, customName, googlePicture, customPicture, now, now, now).run();

  return json({ profile: { email, name, customName, googlePicture, customPicture } });
};
