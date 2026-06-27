import { useState, useEffect, useRef, useCallback } from 'react';
import * as gd from '@/lib/googleDrive';
import { Book } from '@/types';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

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
  const signedIn = state === 'synced' || state === 'saving';

  const onSignInSuccess = useCallback(async () => {
    setState('saving');
    try {
      const [driveBooks, prof] = await Promise.all([gd.loadFromDrive(), gd.fetchUserProfile()]);
      if (prof) setProfile(prof);

      if (driveBooks && driveBooks.length > 0) {
        lastSyncedJSON.current = JSON.stringify(driveBooks);
        window.dispatchEvent(new CustomEvent<Book[]>('books:replace', { detail: driveBooks as Book[] }));
      } else {
        const local = JSON.parse(localStorage.getItem('book-tracker') || '[]') as Book[];
        if (local.length > 0) {
          lastSyncedJSON.current = JSON.stringify(local);
          await gd.saveToDrive(local);
        }
      }
      setLastSync(new Date());
      setState('synced');
    } catch {
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
    setState('saving');
    try {
      const local = JSON.parse(localStorage.getItem('book-tracker') || '[]') as Book[];
      await gd.saveToDrive(local);
      lastSyncedJSON.current = JSON.stringify(local);
      setLastSync(new Date());
      setState('synced');
    } catch {
      setState('error');
    }
  }, [signedIn]);

  return { enabled, state, profile, lastSync, signIn, signOut, syncNow };
}
