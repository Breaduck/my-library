import { useState, useEffect, useRef, useCallback, useContext, createContext, ReactNode } from 'react';
import * as gd from '@/lib/googleDrive';
import * as social from '@/lib/social';
import { Book } from '@/types';

import { mergeBooks, getTombstones, setTombstones, prepareSharedBooks, computeReadingStats, getShareStats } from '@/lib/storage';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const CUSTOM_PICTURE_KEY = 'social-custom-picture';
const CUSTOM_NAME_KEY = 'social-custom-name';
const OWNER_KEY = 'book-tracker-owner';

function readLocalBooks(): Book[] {
  try { return JSON.parse(localStorage.getItem('book-tracker') || '[]') as Book[]; }
  catch { return []; }
}

function syncStats(books: Book[]) {
  if (getShareStats()) social.syncMyStats(computeReadingStats(books)).catch(() => {});
  else social.clearMyStats().catch(() => {});
}

// 이 브라우저에 로컬 저장된 책이 어느 구글 계정 소유인지 추적.
// 없으면(첫 로그인 전 익명 데이터) 새 계정에 합쳐도 되지만, 다른 계정이 로그인하면
// 이전 계정의 로컬 데이터가 새 계정에 섞여 들어가면 안 됨.
function getLocalOwner(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(OWNER_KEY);
}

function setLocalOwner(email: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OWNER_KEY, email);
}

function getCachedCustomPicture(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CUSTOM_PICTURE_KEY) || null;
}

function setCachedCustomPicture(v: string | null) {
  if (typeof window === 'undefined') return;
  if (v) localStorage.setItem(CUSTOM_PICTURE_KEY, v);
  else localStorage.removeItem(CUSTOM_PICTURE_KEY);
}

function getCachedCustomName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CUSTOM_NAME_KEY) || null;
}

function setCachedCustomName(v: string | null) {
  if (typeof window === 'undefined') return;
  if (v) localStorage.setItem(CUSTOM_NAME_KEY, v);
  else localStorage.removeItem(CUSTOM_NAME_KEY);
}

export type SyncState = 'idle' | 'connecting' | 'synced' | 'saving' | 'error';

interface AuthApi {
  enabled: boolean;            // whether OAuth client is configured at all
  state: SyncState;
  signedIn: boolean;
  profile: gd.UserProfile | null;
  lastSync: Date | null;
  avatarUrl: string;
  displayName: string;
  updateCustomPicture: (dataUrl: string | null) => Promise<void>;
  updateCustomName: (name: string | null) => Promise<void>;
  signIn: () => void;
  signOut: () => void;
  syncNow: () => Promise<void>;
}

// Singleton-ish: GIS init must happen once per page load
let gisLoaded = false;
let gisLoading = false;
const gisReadyListeners: Array<() => void> = [];

function ensureGis(): Promise<void> {
  return new Promise((resolve) => {
    if (gisLoaded) return resolve();
    gisReadyListeners.push(resolve);
    if (gisLoading) return;
    gisLoading = true;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      gisLoaded = true;
      gisReadyListeners.splice(0).forEach((fn) => fn());
    };
    document.head.appendChild(script);
  });
}

function useAuthState(): AuthApi {
  // 이미 토큰이 있으면(SPA 네비게이션) 곧바로 synced로 시작. 토큰은 없지만 이전에 로그인한
  // 적이 있다면(새로고침 등으로 메모리상 토큰만 날아간 경우) idle이 아니라 connecting으로 시작해서
  // "로그인 안 됨" 화면이 잠깐이라도 깜빡이지 않게 한다 — 재연결은 아래 effect가 조용히 처리.
  const [state, setState] = useState<SyncState>(() => (gd.getToken() ? 'synced' : gd.wasSignedIn() ? 'connecting' : 'idle'));
  const [profile, setProfile] = useState<gd.UserProfile | null>(() => gd.getCachedProfile());
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [customPicture, setCustomPicture] = useState<string | null>(() => getCachedCustomPicture());
  const [customName, setCustomName] = useState<string | null>(() => getCachedCustomName());
  const tokenClientReady = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedJSON = useRef('');
  const reconnectRetried = useRef(false);

  const enabled = !!CLIENT_ID;
  // idle = 완전 로그아웃. 그 외(connecting/saving/synced/error)는 "기억됨" 상태로 취급.
  const signedIn = state !== 'idle';

  const onSignInSuccess = useCallback(async () => {
    setState('saving');
    try {
      const [driveBooks, prof] = await Promise.all([gd.loadFromDrive(), gd.fetchUserProfile()]);
      if (prof) setProfile(prof);

      // 이 브라우저의 로컬 데이터가 다른 계정 소유라면(계정 전환) 섞이면 안 되므로
      // 로컬을 병합 대상에서 제외하고 Drive(새 계정) 데이터만 사용한다.
      const owner = getLocalOwner();
      const isAccountSwitch = !!owner && !!prof && owner !== prof.email;

      // ★ 절대 덮어쓰지 않고 합집합 병합 — 어느 쪽 책도 사라지지 않음. 삭제는 툼스톤으로 반영.
      const local = isAccountSwitch ? [] : readLocalBooks();
      const remote = (driveBooks?.books ?? []) as Book[];
      const tombs = isAccountSwitch
        ? Array.from(new Set(driveBooks?.tombstones ?? []))
        : Array.from(new Set([...getTombstones(), ...(driveBooks?.tombstones ?? [])]));
      setTombstones(tombs);
      const merged = mergeBooks(local, remote, tombs);
      const mergedJSON = JSON.stringify(merged);
      if (prof) setLocalOwner(prof.email);

      lastSyncedJSON.current = mergedJSON;
      if (mergedJSON !== JSON.stringify(local)) {
        window.dispatchEvent(new CustomEvent<Book[]>('books:replace', { detail: merged }));
      }
      await gd.saveToDrive({ books: merged, tombstones: tombs });

      // 친구 기능용 백엔드 동기화(실패해도 Drive 백업엔 영향 없음)
      if (prof) {
        social.saveProfile({ name: prof.name, googlePicture: prof.picture })
          .then((p) => {
            setCustomPicture(p.customPicture || null); setCachedCustomPicture(p.customPicture || null);
            setCustomName(p.customName || null); setCachedCustomName(p.customName || null);
          })
          .catch(() => {});
      }
      social.syncMyBooks(prepareSharedBooks(merged)).catch(() => {});
      syncStats(merged);

      setLastSync(new Date());
      setState('synced');
    } catch {
      // 실패해도 로컬 데이터는 그대로 안전. 기억 플래그 유지 → 재연결 가능.
      setState('error');
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    ensureGis().then(() => {
      if (cancelled) return;
      gd.initTokenClient(CLIENT_ID, onSignInSuccess, () => {
        // 일시적인 실패(네트워크 지연, 3rd-party 쿠키 타이밍 등)일 수 있으므로 한 번만 자동 재시도.
        // 매번 성공 여부와 무관하게 로그인된 것으로 취급(state !== 'idle')하므로, 재시도 중에도 UI는 로그인 상태로 보임.
        if (gd.wasSignedIn() && !reconnectRetried.current) {
          reconnectRetried.current = true;
          setState('connecting');
          setTimeout(() => { if (!cancelled) gd.requestAccess('', gd.getCachedProfile()?.email); }, 1500);
        } else {
          setState(gd.wasSignedIn() ? 'error' : 'idle');
        }
      });
      tokenClientReady.current = true;
      // 이미 토큰이 있으면(세션 내 재마운트) 재요청하지 않음 — 매번 로그인 팝업/깜빡임 방지
      if (gd.getToken()) {
        setState('synced');
      } else if (gd.wasSignedIn()) {
        // 앱을 새로 열 때마다 조용히 재연결을 시도하면, hint를 줘도 구글 팝업창이 순간적으로
        // 열렸다 닫히는 게 보인다(완전히 안 보이게 만드는 옵션은 구글 API에 없음). 그래서 여기서는
        // 더 이상 재연결을 시도하지 않고, 캐시된 프로필로 로그인된 것처럼 조용히 보여준다.
        // 실제 토큰은 book 저장/동기화가 실제로 필요해질 때(아래 debounced save, syncNow)만 요청한다.
        setState('synced');
      }
    });
    return () => { cancelled = true; };
  }, [enabled, onSignInSuccess]);

  // ⚠️ 배경 타이머로 gd.requestAccess()를 자동 호출하지 않는다 — 사용자 제스처 없이 호출하면
  // 브라우저가 조용한 재인증을 허용하지 않고 실제 구글 계정 선택 팝업을 띄우는 경우가 있어서
  // "책 삭제/뒤로가기 같은 평범한 조작에도 로그인창이 뜬다"는 문제로 이어졌다.
  // 재연결은 (1) 실제로 저장할 변경사항이 생겼을 때, (2) 사용자가 "동기화"를 직접 눌렀을 때만 시도한다.

  // Sync local book changes up to Drive (debounced)
  useEffect(() => {
    if (!signedIn) return;
    const handler = (e: Event) => {
      const books = (e as CustomEvent<Book[]>).detail;
      const json = JSON.stringify(books);
      if (json === lastSyncedJSON.current) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setState('saving');
      debounceRef.current = setTimeout(async () => {
        // 토큰이 없으면(첫 진입 후 아직 재연결 안 됐거나 만료) 이 시점에 조용히 재연결 시도 —
        // 성공하면 onSignInSuccess가 최신 로컬 데이터를 병합해서 알아서 동기화한다.
        if (!gd.getToken()) {
          gd.requestAccess('', gd.getCachedProfile()?.email);
          return;
        }
        try {
          await gd.saveToDrive({ books, tombstones: getTombstones() });
          social.syncMyBooks(prepareSharedBooks(books)).catch(() => {});
          syncStats(books);
          lastSyncedJSON.current = json;
          setLastSync(new Date());
          setState('synced');
        } catch {
          // 토큰 만료 등 — 로컬은 안전. 다음 변경사항이 생기거나 "동기화"를 직접 누르면 재연결된다.
          setState('error');
        }
      }, 1200);
    };
    window.addEventListener('books:changed', handler);
    return () => {
      window.removeEventListener('books:changed', handler);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [signedIn]);

  // 공개 범위(나만 보기/전체/일부) 설정이 바뀌면 즉시 친구용 백엔드에 다시 반영
  useEffect(() => {
    if (!signedIn) return;
    const handler = () => {
      const books = readLocalBooks();
      social.syncMyBooks(prepareSharedBooks(books)).catch(() => {});
      syncStats(books);
    };
    window.addEventListener('visibility:changed', handler);
    return () => window.removeEventListener('visibility:changed', handler);
  }, [signedIn]);

  // 대략적인 체류시간 집계 — 탭이 실제로 보이는 동안에만 30초마다 서버에 알림.
  useEffect(() => {
    if (!signedIn) return;
    const HEARTBEAT_SEC = 30;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        social.sendHeartbeat(HEARTBEAT_SEC).catch(() => {});
      }
    }, HEARTBEAT_SEC * 1000);
    return () => clearInterval(interval);
  }, [signedIn]);

  const signIn = useCallback(() => {
    if (!enabled) return;
    setState('connecting');
    const start = () => gd.requestAccess('consent');
    if (tokenClientReady.current) start();
    else ensureGis().then(start);
  }, [enabled]);

  const signOut = useCallback(() => {
    gd.signOut();
    setProfile(null);
    setLastSync(null);
    lastSyncedJSON.current = '';
    setCustomPicture(null);
    setCachedCustomPicture(null);
    setCustomName(null);
    setCachedCustomName(null);
    setState('idle');
  }, []);

  const syncNow = useCallback(async () => {
    if (!signedIn) return;
    // 토큰이 없으면(만료) 조용히 재연결 → 콜백이 병합 동기화 수행
    if (!gd.getToken()) { setState('connecting'); gd.requestAccess('', gd.getCachedProfile()?.email); return; }
    // 로컬만 올리면 원격(다른 기기)의 책이 줄 수 있으므로 항상 병합 동기화
    await onSignInSuccess();
  }, [signedIn, onSignInSuccess]);

  const updateCustomPicture = useCallback(async (dataUrl: string | null) => {
    const p = await social.saveProfile({ customPicture: dataUrl });
    setCustomPicture(p.customPicture || null);
    setCachedCustomPicture(p.customPicture || null);
  }, []);

  const updateCustomName = useCallback(async (name: string | null) => {
    const p = await social.saveProfile({ customName: name });
    setCustomName(p.customName || null);
    setCachedCustomName(p.customName || null);
  }, []);

  const avatarUrl = customPicture || profile?.picture || '';
  const displayName = customName || profile?.name || '';

  return { enabled, state, signedIn, profile, lastSync, avatarUrl, displayName, updateCustomPicture, updateCustomName, signIn, signOut, syncNow };
}

// Context로 감싸서 앱 전체에 단 하나의 인스턴스만 존재하게 한다.
// 페이지마다 useAuth()를 새로 마운트하면 토큰 클라이언트 초기화·재연결 로직이 라우팅할 때마다
// 다시 실행돼 불필요한 재인증 시도(팝업)로 이어질 수 있어서, Provider를 앱 최상단에 한 번만 둔다.
const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthState();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
