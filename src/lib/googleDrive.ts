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

export function getToken() { return _token; }

function setToken(t: string | null) {
  _token = t;
  if (t) localStorage.setItem(WAS_SIGNED_IN_KEY, '1');
  else localStorage.removeItem(WAS_SIGNED_IN_KEY);
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
    callback: (response: { access_token?: string; error?: string }) => {
      if (response.error || !response.access_token) { onError(); return; }
      setToken(response.access_token);
      onSuccess(response.access_token);
    },
    error_callback: onError,
  });
}

export function requestAccess(prompt: string = '') {
  if (_tokenClient) {
    (_tokenClient as { requestAccessToken: (opts: { prompt: string }) => void })
      .requestAccessToken({ prompt });
  }
}

export function signOut() {
  if (_token) {
    const g = (window as Window & { google?: { accounts?: { oauth2?: { revoke: (token: string) => void } } } }).google;
    g?.accounts?.oauth2?.revoke(_token);
  }
  setToken(null);
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

export async function loadFromDrive(): Promise<unknown[] | null> {
  try {
    const fileId = await findFileId();
    if (!fileId) return null;
    const res = await apiFetch(`/drive/v3/files/${fileId}?alt=media`);
    const data: unknown = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export async function saveToDrive(books: unknown[]): Promise<void> {
  const fileId = await findFileId();
  const body = JSON.stringify(books);

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
