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

// Google OAuth access token(클라이언트가 이미 갖고 있는 GIS 토큰)을 검증해 이메일을 추출.
// 별도 로그인/세션 시스템 없이 기존 프론트 로그인 흐름을 그대로 재사용한다.
export async function requireEmail(request: Request, clientId?: string): Promise<string | null> {
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
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
