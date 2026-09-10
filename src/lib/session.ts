// 우리 서버 세션 토큰.
//
// 구글 액세스 토큰은 1시간이면 만료되고, 현재 로그인 방식(GIS initTokenClient)은
// refresh token을 발급하지 않는다. 그래서 구글 토큰은 '최초 신원 확인'에만 쓰고,
// 이후 우리 API(친구·백업·위젯)는 여기 세션 토큰으로 인증한다 — 90일, 쓸 때마다 연장.
// 이 덕분에 한 시간 뒤에도 친구 검색·초대·수락과 서버 백업이 계속 동작한다.
import { getToken as getGoogleToken } from '@/lib/googleDrive';

const KEY = 'app-session-token';
const OWNER_KEY = 'app-session-email';

export function getSessionToken(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

function setSession(token: string | null, email = ''): void {
  try {
    if (token) { localStorage.setItem(KEY, token); localStorage.setItem(OWNER_KEY, email); }
    else { localStorage.removeItem(KEY); localStorage.removeItem(OWNER_KEY); }
  } catch { /* ignore */ }
}

export function getSessionEmail(): string {
  try { return localStorage.getItem(OWNER_KEY) || ''; } catch { return ''; }
}

export function clearSession(): void { setSession(null); }

// 구글 토큰이 살아 있는 동안(로그인 직후) 호출해 세션을 발급받는다.
// 이미 세션이 있으면 아무것도 하지 않는다 — 세션을 계속 새로 찍어낼 이유가 없다.
let inFlight: Promise<string | null> | null = null;
export function ensureSession(force = false): Promise<string | null> {
  const existing = getSessionToken();
  if (existing && !force) return Promise.resolve(existing);
  if (inFlight) return inFlight;

  const google = getGoogleToken();
  if (!google) return Promise.resolve(existing); // 구글 토큰 없이는 발급 불가 — 기존 것 유지

  inFlight = (async () => {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${google}` },
      });
      if (!res.ok) return existing;
      const data = await res.json() as { token?: string; email?: string };
      if (!data.token) return existing;
      setSession(data.token, data.email ?? '');
      return data.token;
    } catch {
      return existing;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

// 로그아웃 — 서버에서도 세션을 무효화한다(토큰이 유출돼도 더는 쓸 수 없게).
export async function revokeSession(): Promise<void> {
  const token = getSessionToken();
  clearSession();
  if (!token) return;
  try {
    await fetch('/api/auth/session', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  } catch { /* 네트워크 실패해도 로컬에선 이미 지워졌다 */ }
}
