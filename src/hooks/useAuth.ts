import { useState, useEffect, useRef, useCallback } from 'react';
import * as gd from '@/lib/googleDrive';
import { Book } from '@/types';

import { mergeBooks, getTombstones, setTombstones } from '@/lib/storage';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

function readLocalBooks(): Book[] {
  try { return JSON.parse(localStorage.getItem('book-tracker') || '[]') as Book[]; }
  catch { return []; }
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
  // 이미 이 세션에 토큰이 있으면(SPA 네비게이션) 곧바로 로그인 상태로 시작 → 화면 이동마다 로그인 요구 안 함
  const [state, setState] = useState<SyncState>(() => (gd.getToken() ? 'synced' : 'idle'));
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

      // ★ 절대 덮어쓰지 않고 합집합 병합 — 어느 쪽 책도 사라지지 않음. 삭제는 툼스톤으로 반영.
      const local = readLocalBooks();
      const remote = (driveBooks?.books ?? []) as Book[];
      const tombs = Array.from(new Set([...getTombstones(), ...(driveBooks?.tombstones ?? [])]));
      setTombstones(tombs);
      const merged = mergeBooks(local, remote, tombs);
      const mergedJSON = JSON.stringify(merged);

      lastSyncedJSON.current = mergedJSON;
      if (mergedJSON !== JSON.stringify(local)) {
        window.dispatchEvent(new CustomEvent<Book[]>('books:replace', { detail: merged }));
      }
      await gd.saveToDrive({ books: merged, tombstones: tombs });

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
      // 이미 토큰이 있으면(세션 내 재마운트) 재요청하지 않음 — 매번 로그인 팝업/깜빡임 방지
      if (gd.getToken()) {
        setState('synced');
      } else if (gd.wasSignedIn()) {
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
          await gd.saveToDrive({ books, tombstones: getTombstones() });
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
