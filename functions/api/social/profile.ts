import { requireEmail, json } from '../../_lib/auth';

interface Env { DB: D1Database }

interface UserRow {
  email: string;
  name: string;
  google_picture: string | null;
  custom_picture: string | null;
}

function toProfile(row: UserRow) {
  return {
    email: row.email,
    name: row.name,
    googlePicture: row.google_picture ?? '',
    customPicture: row.custom_picture ?? '',
  };
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await requireEmail(request);
  if (!email) return json({ error: 'unauthorized' }, 401);

  const row = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (!row) return json({ profile: null });
  return json({ profile: toProfile(row) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = await requireEmail(request);
  if (!email) return json({ error: 'unauthorized' }, 401);

  const body = await request.json() as { name?: string; googlePicture?: string; customPicture?: string | null };
  const existing = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();

  const name = body.name ?? existing?.name ?? email;
  const googlePicture = body.googlePicture ?? existing?.google_picture ?? '';
  const customPicture = 'customPicture' in body ? (body.customPicture ?? '') : (existing?.custom_picture ?? '');

  await env.DB.prepare(
    `INSERT INTO users (email, name, google_picture, custom_picture, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET name = excluded.name, google_picture = excluded.google_picture,
       custom_picture = excluded.custom_picture, updated_at = excluded.updated_at`
  ).bind(email, name, googlePicture, customPicture, new Date().toISOString()).run();

  return json({ profile: { email, name, googlePicture, customPicture } });
};
