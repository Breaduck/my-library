const FILE_NAME = 'my-library-books.json';
const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
].join(' ');
const WAS_SIGNED_IN_KEY = 'gd-was-signed-in';
const PROFILE_KEY = 'gd-profile';
// 액세스 토큰 자체를 저장해 앱을 다시 열어도(같은 토큰 유효시간 내: ~1시간) 재인증 없이 바로 동기화된다.
// 토큰은 짧은 수명(휘발성)이라 저장해도 위험이 낮고, 만료되면 자동으로 폐기한다.
const TOKEN_KEY = 'gd-token';
const TOKEN_EXP_KEY = 'gd-token-exp';
const TOKEN_SCOPES_KEY = 'gd-token-scopes';
// 만료 임박 판정 여유(초) — 실제 만료 직전엔 미리 무효로 취급해 401을 줄인다.
const EXPIRY_MARGIN_MS = 60_000;

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
// 이번 토큰에 실제로 승인된 스코프 목록. 새 기기 첫 로그인 때 구글이 권한별 체크박스를
// 보여주는데, 사용자가 Drive 체크를 빼먹으면 백업을 전혀 못 읽는다 — 이를 감지하기 위함.
let _grantedScopes = '';

// 모듈 로드 시 저장된 토큰을 복원 — 아직 유효하면(만료 여유 이내) 재인증 없이 즉시 사용.
(function restoreToken() {
  if (typeof window === 'undefined') return;
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    const expRaw = localStorage.getItem(TOKEN_EXP_KEY);
    const exp = expRaw ? parseInt(expRaw, 10) : 0;
    if (t && exp && Date.now() < exp - EXPIRY_MARGIN_MS) {
      _token = t;
      _tokenExpiresAt = exp;
      _grantedScopes = localStorage.getItem(TOKEN_SCOPES_KEY) || '';
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXP_KEY);
      localStorage.removeItem(TOKEN_SCOPES_KEY);
    }
  } catch { /* ignore */ }
})();

export function hasDriveScope(): boolean {
  // scope 정보가 없으면(구버전 응답 등) 막지 않고 통과시킨다 — 실제 실패는 API 호출이 알려줌
  if (!_grantedScopes) return true;
  return _grantedScopes.includes('drive.appdata');
}

export function getToken() {
  // 만료(여유 포함)된 토큰은 즉시 폐기 — 있으나 마나 401을 유발하므로 없는 것으로 취급.
  if (_token && _tokenExpiresAt && Date.now() >= _tokenExpiresAt - EXPIRY_MARGIN_MS) {
    setToken(null);
  }
  return _token;
}
export function getTokenExpiresAt() { return _tokenExpiresAt; }

// 액세스 토큰(수명 ~1시간, 휘발성)과 "로그인 기억" 플래그를 분리한다.
// 토큰이 만료돼도 remembered는 유지 → 다음 로드에서 조용히 재연결(로그아웃처럼 보이지 않음).
function setToken(t: string | null, expiresInSec?: number) {
  _token = t;
  _tokenExpiresAt = t && expiresInSec ? Date.now() + expiresInSec * 1000 : null;
  try {
    if (t) {
      localStorage.setItem(WAS_SIGNED_IN_KEY, '1');
      // 토큰을 저장해 앱 재실행 시 유효시간 내라면 재인증 없이 즉시 동기화되게 한다.
      localStorage.setItem(TOKEN_KEY, t);
      if (_tokenExpiresAt) localStorage.setItem(TOKEN_EXP_KEY, String(_tokenExpiresAt));
      localStorage.setItem(TOKEN_SCOPES_KEY, _grantedScopes);
    } else {
      // 토큰 만료 — 캐시 토큰만 제거(기억 플래그는 유지 → 로그아웃 아님, 조용히 재연결 대상).
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXP_KEY);
      localStorage.removeItem(TOKEN_SCOPES_KEY);
    }
  } catch { /* ignore */ }
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
    callback: (response: { access_token?: string; error?: string; expires_in?: number; scope?: string }) => {
      if (response.error || !response.access_token) { onError(); return; }
      _grantedScopes = response.scope ?? '';
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

export interface DrivePayload {
  books: unknown[];
  tombstones: string[];
  // 일별 독서 기록·연속 독서 날짜·목표도 함께 백업 (없을 수 있음 — 구버전 호환)
  dailyReadings?: unknown[];
  readingDates?: string[];
  goals?: { readingGoal?: string; monthlyGoal?: string; dailyGoal?: string };
  personalResetAt?: string; // 개인 기록 리셋 에포크
}

// 읽기 결과를 3가지로 명확히 구분한다:
//  - 'ok'    : 파일을 정상적으로 읽음(payload 있음)
//  - 'empty' : appDataFolder에 백업 파일이 아직 없음(첫 동기화 — 덮어써도 안전)
//  - 'error' : 네트워크/구글 API 오류 등으로 읽기 실패(★ 절대 덮어쓰면 안 됨)
// 예전 loadFromDrive는 'empty'와 'error'를 똑같이 null로 반환해서, 읽기 실패 시
// "백업이 비었다"고 오판하고 로컬로 Drive를 덮어써 백업 전체가 날아갈 수 있었다.
export type LoadResult =
  | { status: 'ok'; payload: DrivePayload }
  | { status: 'empty' }
  | { status: 'error' };

function normalizePayload(data: unknown): DrivePayload | null {
  // 구버전(책 배열) 호환 + 신버전({books, tombstones, ...})
  if (Array.isArray(data)) return { books: data, tombstones: [] };
  if (data && typeof data === 'object' && Array.isArray((data as DrivePayload).books)) {
    const d = data as DrivePayload;
    return {
      books: d.books,
      tombstones: Array.isArray(d.tombstones) ? d.tombstones : [],
      dailyReadings: Array.isArray(d.dailyReadings) ? d.dailyReadings : undefined,
      readingDates: Array.isArray(d.readingDates) ? d.readingDates : undefined,
      goals: d.goals && typeof d.goals === 'object' ? d.goals : undefined,
      personalResetAt: typeof d.personalResetAt === 'string' ? d.personalResetAt : undefined,
    };
  }
  return null;
}

export async function loadFromDrive(): Promise<LoadResult> {
  let fileId: string | null;
  try {
    fileId = await findFileId();
  } catch {
    return { status: 'error' }; // 목록 조회 실패 = 상태 불명 → 덮어쓰기 금지
  }
  if (!fileId) return { status: 'empty' }; // 파일 없음 = 첫 동기화(정상)

  try {
    const res = await apiFetch(`/drive/v3/files/${fileId}?alt=media`);
    const data: unknown = await res.json();
    const payload = normalizePayload(data);
    // 파일은 있는데 JSON이 깨졌거나 형식이 이상함 → 덮어쓰면 원본이 사라지므로 error로 취급
    if (!payload) return { status: 'error' };
    return { status: 'ok', payload };
  } catch {
    return { status: 'error' }; // 파일은 존재하지만 읽기 실패 → 덮어쓰기 금지
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
