import { useState, useEffect, useRef, useCallback } from 'react';
import * as gd from '@/lib/googleDrive';
import { Book } from '@/types';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

function readLocalBooks(): Book[] {
  try { return JSON.parse(localStorage.getItem('book-tracker') || '[]') as Book[]; }
  catch { return []; }
}

/* 합집합 병합 — 절대 책을 잃지 않는다.
   같은 id는 updatedAt(없으면 createdAt)이 더 최신인 쪽을 채택.
   로컬 순서를 유지하고, 원격에만 있는 책을 뒤에 붙인다. */
function mergeBooks(local: Book[], remote: Book[]): Book[] {
  const byId = new Map<string, Book>();
  const order: string[] = [];
  for (const b of local) { if (!byId.has(b.id)) order.push(b.id); byId.set(b.id, b); }
  for (const b of remote) {
    const ex = byId.get(b.id);
    if (!ex) { order.push(b.id); byId.set(b.id, b); continue; }
    const et = ex.updatedAt ?? ex.createdAt ?? '';
    const rt = b.updatedAt ?? b.createdAt ?? '';
    if (rt > et) byId.set(b.id, b);
  }
  return order.map((id) => byId.get(id)!);
}

export type SyncState = 'idle' | 'connecting' | 'synced' | 'saving' | 'error';

interface AuthApi {
  enabled: boolean;            // whether OAuth client is configured at all
  state: SyncState;
  profile: gd.UserProfile | null;
  lastSync: Date | null;
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

export function useAuth(): AuthApi {
  const [state, setState] = useState<SyncState>('idle');
  const [profile, setProfile] = useState<gd.UserProfile | null>(() => gd.getCachedProfile());
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const tokenClientReady = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedJSON = useRef('');

  const enabled = !!CLIENT_ID;
  // idle = 완전 로그아웃. 그 외(connecting/saving/synced/error)는 "기억됨" 상태로 취급.
  const signedIn = state !== 'idle';

  const onSignInSuccess = useCallback(async () => {
    setState('saving');
    try {
      const [driveBooks, prof] = await Promise.all([gd.loadFromDrive(), gd.fetchUserProfile()]);
      if (prof) setProfile(prof);

      // ★ 절대 덮어쓰지 않고 합집합 병합 — 로컬/원격 어느 쪽 책도 사라지지 않음
      const local = readLocalBooks();
      const remote = (driveBooks ?? []) as Book[];
      const merged = mergeBooks(local, remote);
      const mergedJSON = JSON.stringify(merged);

      lastSyncedJSON.current = mergedJSON;
      if (mergedJSON !== JSON.stringify(local)) {
        // 로컬에 없던(원격) 책이 합쳐졌을 때만 로컬 갱신
        window.dispatchEvent(new CustomEvent<Book[]>('books:replace', { detail: merged }));
      }
      // 원격이 축소되지 않도록 합쳐진 전체를 업로드
      await gd.saveToDrive(merged);

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
        setState(gd.wasSignedIn() ? 'error' : 'idle');
      });
      tokenClientReady.current = true;
      if (gd.wasSignedIn()) {
        setState('connecting');
        gd.requestAccess('');
      }
    });
    return () => { cancelled = true; };
  }, [enabled, onSignInSuccess]);

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
        try {
          await gd.saveToDrive(books);
          lastSyncedJSON.current = json;
          setLastSync(new Date());
          setState('synced');
        } catch {
          // 토큰 만료 등 — 로컬은 안전. 조용히 재연결 시도(로그아웃 아님).
          // 재연결 성공 시 onSignInSuccess가 병합·업로드로 밀린 변경을 반영한다.
          if (gd.wasSignedIn()) { setState('connecting'); gd.requestAccess(''); }
          else setState('error');
        }
      }, 1200);
    };
    window.addEventListener('books:changed', handler);
    return () => {
      window.removeEventListener('books:changed', handler);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
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
    setState('idle');
  }, []);

  const syncNow = useCallback(async () => {
    if (!signedIn) return;
    // 토큰이 없으면(만료) 조용히 재연결 → 콜백이 병합 동기화 수행
    if (!gd.getToken()) { setState('connecting'); gd.requestAccess(''); return; }
    // 로컬만 올리면 원격(다른 기기)의 책이 줄 수 있으므로 항상 병합 동기화
    await onSignInSuccess();
  }, [signedIn, onSignInSuccess]);

  return { enabled, state, profile, lastSync, signIn, signOut, syncNow };
}
