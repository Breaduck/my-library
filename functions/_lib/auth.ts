// Google OAuth access token(클라이언트가 이미 갖고 있는 GIS 토큰)을 검증해 이메일을 추출.
// 별도 로그인/세션 시스템 없이 기존 프론트 로그인 흐름을 그대로 재사용한다.
export async function requireEmail(request: Request): Promise<string | null> {
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  try {
    const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const data = await res.json() as { email?: string; aud?: string };
    return data.email ? data.email.toLowerCase() : null;
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
