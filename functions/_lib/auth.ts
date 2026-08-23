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
    const data = await res.json() as { email?: string; aud?: string };
    if (!data.email) return null;
    // aud 검증: 다른 앱에 발급된 구글 토큰으로 이 API를 호출하는 것을 차단
    if (clientId && data.aud !== clientId) return null;
    return data.email.toLowerCase();
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
