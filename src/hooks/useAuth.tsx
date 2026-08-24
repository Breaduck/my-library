import { useState, useEffect, useRef, useCallback, useContext, createContext, ReactNode } from 'react';
import * as gd from '@/lib/googleDrive';
import * as social from '@/lib/social';
import { Book } from '@/types';

import { mergeBooks, getTombstones, setTombstones, prepareSharedBooks, computeReadingStats, getShareStats, clearPersonalData, applyPersonalData, getPersonalData } from '@/lib/storage';

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
  // 토큰이 없어(캐시 로그인 상태) 프로필 저장이 실패했을 때, 재연결 후 함께 저장할 대기 값.
  const pendingProfileRef = useRef<{ customPicture?: string | null; customName?: string | null }>({});

  const enabled = !!CLIENT_ID;
  // idle = 완전 로그아웃. 그 외(connecting/saving/synced/error)는 "기억됨" 상태로 취급.
  const signedIn = state !== 'idle';

  const onSignInSuccess = useCallback(async () => {
    setState('saving');
    try {
      const [driveResult, prof] = await Promise.all([gd.loadFromDrive(), gd.fetchUserProfile()]);
      if (prof) setProfile(prof);

      // ★ 읽기 실패('error')면 Drive 상태를 알 수 없으므로 절대 덮어쓰지 않는다.
      // 로컬 데이터는 그대로 안전하고, 다음 변경/수동 동기화 때 다시 시도된다.
      if (driveResult.status === 'error') { setState('error'); return; }
      const remotePayload = driveResult.status === 'ok' ? driveResult.payload : null;

      // 이 브라우저의 로컬 데이터가 다른 계정 소유라면(계정 전환) 섞이면 안 되므로
      // 로컬을 병합 대상에서 제외하고 Drive(새 계정) 데이터만 사용한다.
      const owner = getLocalOwner();
      const isAccountSwitch = !!owner && !!prof && owner !== prof.email;
      // 계정이 바뀌면 이전 계정의 일별 기록·목표·공개 설정도 새 계정에 섞이면 안 됨
      if (isAccountSwitch) clearPersonalData();

      // ★ 절대 덮어쓰지 않고 합집합 병합 — 어느 쪽 책도 사라지지 않음. 삭제는 툼스톤으로 반영.
      const local = isAccountSwitch ? [] : readLocalBooks();
      const remote = (remotePayload?.books ?? []) as Book[];
      const tombs = isAccountSwitch
        ? Array.from(new Set(remotePayload?.tombstones ?? []))
        : Array.from(new Set([...getTombstones(), ...(remotePayload?.tombstones ?? [])]));
      setTombstones(tombs);

      // 일별 기록·연속 독서·목표도 원격과 병합해 로컬에 반영(어떤 기록도 잃지 않음)
      applyPersonalData(remotePayload ?? undefined);

      const merged = mergeBooks(local, remote, tombs);
      const mergedJSON = JSON.stringify(merged);
      if (prof) setLocalOwner(prof.email);

      lastSyncedJSON.current = mergedJSON;
      if (mergedJSON !== JSON.stringify(local)) {
        window.dispatchEvent(new CustomEvent<Book[]>('books:replace', { detail: merged }));
      }
      await gd.saveToDrive({ books: merged, tombstones: tombs, ...getPersonalData() });

      // 친구 기능용 백엔드 동기화(실패해도 Drive 백업엔 영향 없음)
      if (prof) {
        // 토큰이 없어 저장 못했던 프로필 사진/이름 변경이 있으면 이번에 함께 반영한다.
        const pending = pendingProfileRef.current;
        social.saveProfile({ name: prof.name, googlePicture: prof.picture, ...pending })
          .then((p) => {
            pendingProfileRef.current = {};
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
          // ★ 통째로 덮어쓰지 않는다: 먼저 원격을 읽어 합집합 병합한 뒤 저장한다.
          // (다른 기기가 올린 최신 백업을 이 기기의 오래된 로컬이 덮어쓰는 사고 방지)
          const remote = await gd.loadFromDrive();
          if (remote.status === 'error') { setState('error'); return; } // 읽기 실패 → 덮어쓰기 금지
          const rp = remote.status === 'ok' ? remote.payload : null;

          const tombs = Array.from(new Set([...getTombstones(), ...(rp?.tombstones ?? [])]));
          setTombstones(tombs);
          applyPersonalData(rp ?? undefined);

          const merged = mergeBooks(books, (rp?.books ?? []) as Book[], tombs);
          const mergedJSON = JSON.stringify(merged);
          // dispatch 전에 먼저 표시해야, books:replace→books:changed 재진입이 즉시 단락됨(중복 저장 방지)
          lastSyncedJSON.current = mergedJSON;
          if (mergedJSON !== JSON.stringify(books)) {
            // 원격에만 있던 책을 로컬에도 반영
            window.dispatchEvent(new CustomEvent<Book[]>('books:replace', { detail: merged }));
          }

          await gd.saveToDrive({ books: merged, tombstones: tombs, ...getPersonalData() });
          social.syncMyBooks(prepareSharedBooks(merged)).catch(() => {});
          syncStats(merged);
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

  // "모든 기록 초기화"는 삭제이므로 병합 저장(합집합)으로는 표현할 수 없다
  // (개인 기록은 툼스톤이 없어 합치면 원격에서 다시 딸려온다). 그래서 초기화는
  // 병합을 건너뛰고 빈 페이로드로 Drive를 '권위 있게' 덮어쓴다.
  useEffect(() => {
    if (!signedIn) return;
    const handler = () => {
      // 동기적으로 먼저 세팅 → 뒤이어 오는 books:changed('[]')가 병합 저장을 건너뛰게 함
      lastSyncedJSON.current = '[]';
      void (async () => {
        if (!gd.getToken()) { gd.requestAccess('', gd.getCachedProfile()?.email); return; }
        setState('saving');
        try {
          // handleReset이 clearReadingRecords로 로컬 개인 기록을 비우고 리셋 에포크를 올린 뒤라,
          // getPersonalData()는 {빈 기록 + 올라간 personalResetAt}을 담는다 → 다른 기기에도 전파.
          await gd.saveToDrive({ books: [], tombstones: getTombstones(), ...getPersonalData() });
          social.syncMyBooks([]).catch(() => {});
          social.clearMyStats().catch(() => {});
          setLastSync(new Date());
          setState('synced');
        } catch {
          setState('error');
        }
      })();
    };
    window.addEventListener('account:wipe', handler);
    return () => window.removeEventListener('account:wipe', handler);
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
    // 1) 화면 먼저 즉시 반영 — 토큰이 없어도 사진이 바로 바뀌게(캐시 로그인 상태 대응)
    setCustomPicture(dataUrl);
    setCachedCustomPicture(dataUrl);
    // 2) 서버에도 저장(친구에게도 보이도록). 토큰 없으면 대기열에 넣고 조용히 재연결 → onSignInSuccess가 함께 저장.
    try {
      const p = await social.saveProfile({ customPicture: dataUrl });
      setCustomPicture(p.customPicture || null);
      setCachedCustomPicture(p.customPicture || null);
    } catch {
      pendingProfileRef.current = { ...pendingProfileRef.current, customPicture: dataUrl };
      if (!gd.getToken()) gd.requestAccess('', gd.getCachedProfile()?.email);
    }
  }, []);

  const updateCustomName = useCallback(async (name: string | null) => {
    setCustomName(name);
    setCachedCustomName(name);
    try {
      const p = await social.saveProfile({ customName: name });
      setCustomName(p.customName || null);
      setCachedCustomName(p.customName || null);
    } catch {
      pendingProfileRef.current = { ...pendingProfileRef.current, customName: name };
      if (!gd.getToken()) gd.requestAccess('', gd.getCachedProfile()?.email);
    }
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
