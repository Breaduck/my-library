// 우리 앱의 OAuth 클라이언트 ID. 이미 클라이언트 번들에 공개돼 있는 값이므로 비밀이 아니며,
// 여기 상수로 둬서 런타임 환경변수(VITE_GOOGLE_CLIENT_ID)가 없더라도 aud 검증이 반드시 수행되게 한다.
// ★ 이게 없으면 '다른 앱에 발급된 구글 토큰'으로도 우리 API 인증이 통과되는 우회가 가능하다.
const KNOWN_CLIENT_ID = '911521208153-5ev7h7ser40irv4lhfjlglr379jq9s1k.apps.googleusercontent.com';

// 이메일을 하나의 표준형으로 정규화한다. 친구를 이메일로 초대할 때 상대가 실제로 로그인하는
// 주소와 글자가 정확히 일치하지 않으면(대소문자·Gmail의 점/＋별칭) 요청이 조용히 누락된다.
// - 공통: 앞뒤 공백 제거, 소문자화, '+태그' 제거
// - Gmail/Googlemail: 로컬part의 '.'은 무시되므로 제거(같은 편지함으로 취급)
export function canonicalEmail(raw: string): string {
  const email = (raw ?? '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;
  let local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const plus = local.indexOf('+');
  if (plus >= 0) local = local.slice(0, plus);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
    return `${local}@gmail.com`;
  }
  return `${local}@${domain}`;
}

// ── 자체 세션 토큰 ────────────────────────────────────────────────────────
// 구글 액세스 토큰은 1시간이면 만료되고, 지금 로그인 방식(GIS initTokenClient)은
// refresh token을 발급하지 않는다. 그래서 구글 토큰은 '최초 신원 확인'에만 쓰고,
// 이후 우리 API는 여기서 발급하는 세션 토큰으로 인증한다 — 만료는 우리가 정한다.
export const SESSION_PREFIX = 'mls_';
const SESSION_TTL_DAYS = 90;
// 마지막 사용이 하루 이상 지났을 때만 만료를 연장한다(쓸 때마다 쓰면 DB 쓰기가 과해진다).
const SLIDING_RENEW_MS = 24 * 60 * 60 * 1000;

// 토큰 원문은 DB에 남기지 않는다 — 해시만 저장해 DB가 유출돼도 그대로는 쓰지 못하게.
export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return SESSION_PREFIX + b64;
}

export async function createSession(db: D1Database, email: string): Promise<string> {
  const token = generateSessionToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_DAYS * 86400_000);
  await db.prepare(
    'INSERT INTO sessions (token_hash, email, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(await hashToken(token), email, now.toISOString(), now.toISOString(), expires.toISOString()).run();
  return token;
}

export async function revokeSession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hashToken(token)).run();
}

async function emailFromSession(db: D1Database, token: string): Promise<string | null> {
  const hash = await hashToken(token);
  const row = await db.prepare('SELECT email, expires_at, last_used_at FROM sessions WHERE token_hash = ?')
    .bind(hash).first<{ email: string; expires_at: string; last_used_at: string }>();
  if (!row) return null;

  const now = new Date();
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    // 만료된 세션은 즉시 정리 — 남겨두면 테이블만 커진다.
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
    return null;
  }

  if (now.getTime() - new Date(row.last_used_at).getTime() > SLIDING_RENEW_MS) {
    const expires = new Date(now.getTime() + SESSION_TTL_DAYS * 86400_000);
    await db.prepare('UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE token_hash = ?')
      .bind(now.toISOString(), expires.toISOString(), hash).run();
  }
  return row.email;
}

// 요청을 인증해 이메일을 반환. 두 가지 토큰을 받는다:
//  1) 우리 세션 토큰('mls_' 접두) — 기본 경로. db 인자가 필요하다.
//  2) 구글 액세스 토큰 — 최초 로그인(세션 발급) 및 구버전 클라이언트 호환용.
export async function requireEmail(request: Request, clientId?: string, db?: D1Database): Promise<string | null> {
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;

  if (token.startsWith(SESSION_PREFIX)) {
    if (!db) return null; // 세션 토큰인데 DB가 없으면 검증 불가 → fail-closed
    try { return await emailFromSession(db, token); } catch { return null; }
  }

  try {
    // 토큰을 쿼리스트링에 넣으면 중간 프록시/서버 로그에 남을 수 있어 POST 본문으로 전달
    const res = await fetch('https://www.googleapis.com/oauth2/v3/tokeninfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: token }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { email?: string; email_verified?: string; aud?: string };
    if (!data.email) return null;
    // aud 검증(fail-closed): 다른 앱에 발급된 구글 토큰으로 이 API를 호출하는 것을 차단.
    // 환경변수가 있으면 그걸, 없으면 상수를 기준으로 — 항상 검증한다.
    const expectedAud = clientId || KNOWN_CLIENT_ID;
    if (data.aud !== expectedAud) return null;
    // 미인증(email_verified=false) 계정은 이메일 소유가 확인되지 않았으므로 거부
    if (data.email_verified === 'false') return null;
    return canonicalEmail(data.email);
  } catch {
    return null;
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// 관리자 대시보드 접근 제어. Cloudflare Pages 환경변수 ADMIN_EMAILS(콤마 구분)에
// 등록된 이메일만 허용 — 코드에 이메일을 하드코딩하지 않기 위함.
export function isAdmin(email: string, adminEmailsEnv: string | undefined): boolean {
  const allowed = (adminEmailsEnv ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
