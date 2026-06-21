import { useState, useEffect, useRef } from 'react';
import * as gd from '@/lib/googleDrive';
import { Book } from '@/types';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

type SyncState = 'idle' | 'connecting' | 'synced' | 'saving' | 'error';

export default function DriveSync() {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [gisReady, setGisReady] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedJSON = useRef('');
  const signedIn = syncState === 'synced' || syncState === 'saving';

  // Load GIS script once
  useEffect(() => {
    if (!CLIENT_ID) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => setGisReady(true);
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch {} };
  }, []);

  // Init token client + auto sign-in if user was previously signed in
  useEffect(() => {
    if (!gisReady || !CLIENT_ID) return;

    gd.initTokenClient(
      CLIENT_ID,
      async () => {
        setSyncState('synced');
        try {
          setSyncState('saving');
          const driveBooks = await gd.loadFromDrive();
          if (driveBooks && driveBooks.length > 0) {
            lastSyncedJSON.current = JSON.stringify(driveBooks);
            window.dispatchEvent(new CustomEvent<Book[]>('books:replace', { detail: driveBooks as Book[] }));
          } else {
            // Upload current local books to Drive (first time)
            const local = JSON.parse(localStorage.getItem('book-tracker') || '[]') as Book[];
            if (local.length > 0) {
              lastSyncedJSON.current = JSON.stringify(local);
              await gd.saveToDrive(local);
            }
          }
          setLastSync(new Date());
          setSyncState('synced');
        } catch {
          setSyncState('error');
        }
      },
      () => {
        setSyncState(gd.wasSignedIn() ? 'error' : 'idle');
      },
    );

    if (gd.wasSignedIn()) {
      setSyncState('connecting');
      gd.requestAccess(''); // silent (no popup for returning users)
    }
  }, [gisReady]);

  // Watch for books changes and sync to Drive (debounced)
  useEffect(() => {
    if (!signedIn) return;

    const handler = (e: Event) => {
      const books = (e as CustomEvent<Book[]>).detail;
      const json = JSON.stringify(books);
      if (json === lastSyncedJSON.current) return; // same data — skip

      if (timerRef.current) clearTimeout(timerRef.current);
      setSyncState('saving');
      timerRef.current = setTimeout(async () => {
        try {
          await gd.saveToDrive(books);
          lastSyncedJSON.current = json;
          setLastSync(new Date());
          setSyncState('synced');
        } catch {
          setSyncState('error');
        }
      }, 1200);
    };

    window.addEventListener('books:changed', handler);
    return () => {
      window.removeEventListener('books:changed', handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [signedIn]);

  function handleSignIn() {
    setSyncState('connecting');
    gd.requestAccess('consent');
  }

  function handleSignOut() {
    gd.signOut();
    setSyncState('idle');
    setLastSync(null);
    lastSyncedJSON.current = '';
  }

  if (!CLIENT_ID) return null;

  if (syncState === 'idle' || syncState === 'error') {
    return (
      <button onClick={handleSignIn}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-colors bg-white hover:bg-gray-50 active:bg-gray-100"
        style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.08)', color: syncState === 'error' ? '#ef4444' : '#1D1D1F' }}>
        <GoogleIcon />
        {syncState === 'error' ? 'Drive 재연결' : 'Drive 연동'}
      </button>
    );
  }

  if (syncState === 'connecting') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white text-[#6E6E73] text-xs"
        style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
        <div className="w-3 h-3 border border-[#AEAEB2] border-t-[#6E6E73] rounded-full animate-spin" />
        연결 중...
      </div>
    );
  }

  // synced or saving
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white text-xs"
        style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
        {syncState === 'saving' ? (
          <>
            <div className="w-2.5 h-2.5 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-indigo-500">저장 중</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[#6E6E73]">Drive</span>
            {lastSync && (
              <span className="text-[#AEAEB2]">· {formatTime(lastSync)}</span>
            )}
          </>
        )}
      </div>
      <button onClick={handleSignOut}
        title="Drive 연동 해제"
        className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-[#AEAEB2] hover:text-red-400 active:bg-red-50 transition-colors"
        style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function GoogleIcon() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
