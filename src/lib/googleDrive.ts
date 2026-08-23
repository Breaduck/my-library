const FILE_NAME = 'my-library-books.json';
const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
].join(' ');
const WAS_SIGNED_IN_KEY = 'gd-was-signed-in';
const PROFILE_KEY = 'gd-profile';

export interface UserProfile {
  email: string;
  name: string;
  picture: string;
}

export function getCachedProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) as UserProfile : null;
  } catch { return null; }
}

function setCachedProfile(p: UserProfile | null) {
  if (typeof window === 'undefined') return;
  if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  else localStorage.removeItem(PROFILE_KEY);
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  if (!_token) return null;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${_token}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { email?: string; name?: string; picture?: string };
    if (!data.email) return null;
    const profile: UserProfile = {
      email: data.email,
      name: data.name ?? data.email,
      picture: data.picture ?? '',
    };
    setCachedProfile(profile);
    return profile;
  } catch { return null; }
}

let _token: string | null = null;
let _tokenClient: unknown = null;
let _tokenExpiresAt: number | null = null;

export function getToken() { return _token; }
export function getTokenExpiresAt() { return _tokenExpiresAt; }

// 액세스 토큰(수명 ~1시간, 휘발성)과 "로그인 기억" 플래그를 분리한다.
// 토큰이 만료돼도 remembered는 유지 → 다음 로드에서 조용히 재연결(로그아웃처럼 보이지 않음).
function setToken(t: string | null, expiresInSec?: number) {
  _token = t;
  _tokenExpiresAt = t && expiresInSec ? Date.now() + expiresInSec * 1000 : null;
  if (t) localStorage.setItem(WAS_SIGNED_IN_KEY, '1');
  // t === null 일 때는 기억 플래그를 지우지 않는다 (만료일 뿐 로그아웃 아님).
}

export function clearRemembered() {
  if (typeof window !== 'undefined') localStorage.removeItem(WAS_SIGNED_IN_KEY);
}

export function wasSignedIn() {
  return typeof window !== 'undefined' && localStorage.getItem(WAS_SIGNED_IN_KEY) === '1';
}

export function initTokenClient(
  clientId: string,
  onSuccess: (token: string) => void,
  onError: () => void,
) {
  const g = (window as Window & { google?: { accounts?: { oauth2?: { initTokenClient: (cfg: unknown) => unknown; revoke: (token: string, cb?: () => void) => void } } } }).google;
  if (!clientId || !g?.accounts?.oauth2) return;

  _tokenClient = g.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    // 점진적 승인(구글 콘솔 진단 항목): 이미 승인된 스코프를 새 요청에 합산 (기본값이지만 명시)
    include_granted_scopes: true,
    callback: (response: { access_token?: string; error?: string; expires_in?: number }) => {
      if (response.error || !response.access_token) { onError(); return; }
      setToken(response.access_token, response.expires_in);
      onSuccess(response.access_token);
    },
    error_callback: onError,
  });
}

// hint(이전 로그인 이메일)를 넘기면 구글이 "어느 계정?" 팝업 없이 바로 그 계정으로 조용히 재인증을 시도한다.
// 특히 브라우저에 구글 계정이 여러 개 로그인돼 있을 때, hint 없이는 prompt:''라도 계정 선택 팝업이 뜬다.
export function requestAccess(prompt: string = '', hint?: string) {
  if (_tokenClient) {
    (_tokenClient as { requestAccessToken: (opts: { prompt: string; hint?: string }) => void })
      .requestAccessToken(hint ? { prompt, hint } : { prompt });
  }
}

export function signOut() {
  if (_token) {
    const g = (window as Window & { google?: { accounts?: { oauth2?: { revoke: (token: string) => void } } } }).google;
    g?.accounts?.oauth2?.revoke(_token);
  }
  setToken(null);
  clearRemembered(); // 명시적 로그아웃일 때만 기억 해제
  setCachedProfile(null);
}

// ─── Drive REST API ───────────────────────────────────────────────────────────

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!_token) throw new Error('not-signed-in');
  const res = await fetch(`https://www.googleapis.com${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${_token}`, ...(options.headers as Record<string, string> ?? {}) },
  });
  if (res.status === 401) { setToken(null); throw new Error('token-expired'); }
  if (!res.ok) throw new Error(`drive-error-${res.status}`);
  return res;
}

async function findFileId(): Promise<string | null> {
  const res = await apiFetch(
    `/drive/v3/files?spaces=appDataFolder&q=name%3D'${FILE_NAME}'&fields=files(id)`,
  );
  const data = await res.json() as { files?: { id: string }[] };
  return data.files?.[0]?.id ?? null;
}

export interface DrivePayload { books: unknown[]; tombstones: string[] }

export async function loadFromDrive(): Promise<DrivePayload | null> {
  try {
    const fileId = await findFileId();
    if (!fileId) return null;
    const res = await apiFetch(`/drive/v3/files/${fileId}?alt=media`);
    const data: unknown = await res.json();
    // 구버전(책 배열) 호환 + 신버전({books, tombstones})
    if (Array.isArray(data)) return { books: data, tombstones: [] };
    if (data && typeof data === 'object' && Array.isArray((data as DrivePayload).books)) {
      const d = data as DrivePayload;
      return { books: d.books, tombstones: Array.isArray(d.tombstones) ? d.tombstones : [] };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveToDrive(payload: DrivePayload): Promise<void> {
  const fileId = await findFileId();
  const body = JSON.stringify(payload);

  if (fileId) {
    await apiFetch(`/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } else {
    const meta = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] });
    const form = new FormData();
    form.append('metadata', new Blob([meta], { type: 'application/json' }));
    form.append('file', new Blob([body], { type: 'application/json' }));
    await apiFetch('/upload/drive/v3/files?uploadType=multipart', { method: 'POST', body: form });
  }
}
