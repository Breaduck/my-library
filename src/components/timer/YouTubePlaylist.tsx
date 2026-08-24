import { useState, useEffect, useRef, useCallback } from 'react';

// 타이머 '플레이리스트' 모드에서 쓰는 유튜브 음악 재생기.
// 사용자가 유튜브 링크를 추가하면 트랙이 되고, 타이머를 재생하면 음악이 자동으로 나온다.
// (곡이 끝나면 다음 곡으로 자동 넘어감. 개별 재생/일시정지/다음 버튼도 제공)

interface Track { id: string; vid: string; title: string; }
const STORAGE_KEY = 'timer-yt-tracks';

// 다양한 형태의 유튜브 URL(또는 순수 videoId)에서 11자리 videoId를 뽑아낸다.
function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.slice(1).split('/')[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const m = u.pathname.match(/\/(embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
      if (m) return m[2];
    }
  } catch { /* URL이 아님 */ }
  return null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// YT IFrame API는 페이지당 한 번만 로드
let ytApiPromise: Promise<void> | null = null;
function loadYtApi(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const w = window as any;
    if (w.YT && w.YT.Player) { resolve(); return; }
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

function loadTracks(): Track[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveTracks(t: Track[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch { /* ignore */ }
}

export default function YouTubePlaylist({ running, manageOpen, onCloseManage }: { running: boolean; manageOpen: boolean; onCloseManage: () => void }) {
  const [tracks, setTracks] = useState<Track[]>(loadTracks);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');

  // 편집 시트를 열 때마다 이전 오류 메시지 초기화
  useEffect(() => { if (manageOpen) setErr(''); }, [manageOpen]);

  const playerRef = useRef<any>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef(tracks);
  const currentRef = useRef(current);
  const prevRunning = useRef(running);
  tracksRef.current = tracks;
  currentRef.current = current;

  const playIndex = useCallback((idx: number) => {
    const list = tracksRef.current;
    if (!playerRef.current || list.length === 0) return;
    const i = ((idx % list.length) + list.length) % list.length;
    setCurrent(i);
    try { playerRef.current.loadVideoById(list[i].vid); } catch { /* ignore */ }
  }, []);

  // 플레이어 생성 (숨김 — 오디오만 사용)
  useEffect(() => {
    let cancelled = false;
    loadYtApi().then(() => {
      if (cancelled || !hostRef.current) return;
      const w = window as any;
      playerRef.current = new w.YT.Player(hostRef.current, {
        height: '200', width: '200',
        playerVars: { playsinline: 1, controls: 0 },
        events: {
          onReady: () => { if (!cancelled) setReady(true); },
          onStateChange: (e: any) => {
            const YT = (window as any).YT;
            if (e.data === YT.PlayerState.ENDED) {
              // 다음 곡으로 자동 진행
              playIndex(currentRef.current + 1);
            } else if (e.data === YT.PlayerState.PLAYING) {
              setPlaying(true);
            } else if (e.data === YT.PlayerState.PAUSED) {
              setPlaying(false);
            }
          },
        },
      });
    });
    return () => { cancelled = true; try { playerRef.current?.destroy(); } catch { /* ignore */ } };
  }, [playIndex]);

  // 타이머 재생/일시정지 '전환'에 맞춰 음악도 시작/정지 (진행 중엔 수동 조작을 방해하지 않음)
  useEffect(() => {
    if (!ready) return;
    const started = running && !prevRunning.current;
    const paused = !running && prevRunning.current;
    prevRunning.current = running;
    if (started && tracksRef.current.length > 0) {
      const p = playerRef.current;
      try {
        const st = p.getPlayerState?.();
        // 아직 아무 곡도 안 실렸으면 현재 곡을 로드(자동재생), 이미 있으면 이어재생
        if (st === -1 || st === 5 || st === undefined) playIndex(currentRef.current);
        else p.playVideo();
      } catch { /* ignore */ }
    } else if (paused) {
      try { playerRef.current?.pauseVideo(); } catch { /* ignore */ }
    }
  }, [running, ready, playIndex]);

  function togglePlay() {
    const p = playerRef.current;
    if (!p || tracks.length === 0) return;
    if (playing) {
      try { p.pauseVideo(); } catch { /* ignore */ }
    } else {
      try {
        const st = p.getPlayerState?.();
        if (st === -1 || st === 5 || st === undefined) playIndex(current);
        else p.playVideo();
      } catch { /* ignore */ }
    }
  }

  function addTrack() {
    const vid = parseVideoId(input);
    if (!vid) { setErr('유효한 유튜브 링크가 아니에요'); return; }
    const t: Track = { id: crypto.randomUUID(), vid, title: '유튜브 트랙' };
    const next = [...tracks, t];
    setTracks(next); saveTracks(next); setInput(''); setErr('');
    // 제목은 oEmbed로 가져와 채운다(실패해도 무방)
    fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vid}&format=json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        if (d?.title) {
          setTracks((prev) => {
            const updated = prev.map((x) => (x.id === t.id ? { ...x, title: d.title } : x));
            saveTracks(updated);
            return updated;
          });
        }
      })
      .catch(() => { /* ignore */ });
  }

  function removeTrack(id: string) {
    const idx = tracks.findIndex((t) => t.id === id);
    const next = tracks.filter((t) => t.id !== id);
    setTracks(next); saveTracks(next);
    if (idx <= current && current > 0) setCurrent((c) => Math.max(0, c - 1));
  }

  const cur = tracks[current];

  return (
    <>
      {/* 숨겨진 유튜브 플레이어 */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
        <div ref={hostRef} />
      </div>

      {/* 나우플레잉 바 */}
      <div className="relative z-10 mx-auto w-full max-w-sm px-6 mt-3">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <svg className="w-4 h-4 flex-shrink-0 text-[#FF0000]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31 31 0 000 12a31 31 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31 31 0 0024 12a31 31 0 00-.5-5.8zM9.5 15.5v-7l6.3 3.5-6.3 3.5z" />
          </svg>
          <div className="flex-1 min-w-0">
            {tracks.length === 0 ? (
              <p className="text-white/45 text-xs truncate">유튜브 링크를 추가해 나만의 독서 BGM을 만들어요</p>
            ) : (
              <p className="text-white/85 text-xs font-medium truncate">{cur?.title || '유튜브 트랙'}</p>
            )}
            {tracks.length > 0 && (
              <p className="text-white/40 text-[10px] tabular-nums">{current + 1} / {tracks.length}곡</p>
            )}
          </div>
          {tracks.length > 0 && (
            <>
              <button onClick={togglePlay} aria-label={playing ? '일시정지' : '재생'}
                className="w-9 h-9 flex-shrink-0 rounded-full bg-white flex items-center justify-center active:scale-95 transition-transform">
                {playing ? (
                  <svg className="w-4 h-4 text-[#0C0C18]" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
                ) : (
                  <svg className="w-4 h-4 text-[#0C0C18] translate-x-px" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>
              <button onClick={() => playIndex(current + 1)} aria-label="다음 곡"
                className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform"
                style={{ background: 'rgba(255,255,255,0.12)' }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 플레이리스트 관리 시트 */}
      {manageOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => e.target === e.currentTarget && onCloseManage()}>
          <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #0c0c18 100%)', border: '1px solid rgba(255,255,255,0.08)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-2 sm:hidden" />
            <div className="px-6 pt-3 pb-3">
              <h3 className="text-white text-base font-bold mb-1">독서 플레이리스트</h3>
              <p className="text-white/40 text-xs">유튜브 링크를 붙여넣어 곡을 추가하세요</p>
            </div>
            <div className="px-4 pb-2">
              <div className="flex gap-2">
                <input value={input} onChange={(e) => { setInput(e.target.value); setErr(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTrack())}
                  placeholder="https://youtu.be/..."
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                <button onClick={addTrack} disabled={!input.trim()}
                  className="px-4 py-2.5 rounded-xl bg-white text-[#0C0C18] text-sm font-semibold disabled:opacity-40 active:scale-95 transition-transform flex-shrink-0">
                  추가
                </button>
              </div>
              {err && <p className="text-red-400 text-[11px] mt-2 px-1">{err}</p>}
            </div>
            <div className="px-4 pt-2 pb-3 max-h-64 overflow-y-auto space-y-1.5">
              {tracks.length === 0 ? (
                <p className="text-white/30 text-xs text-center py-6">아직 추가한 곡이 없어요</p>
              ) : (
                tracks.map((t, i) => (
                  <div key={t.id}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl ${i === current ? 'bg-white/12' : 'bg-white/[0.04]'}`}>
                    <button onClick={() => { playIndex(i); }} className="flex-1 min-w-0 flex items-center gap-2.5 text-left">
                      <span className="text-white/40 text-xs tabular-nums w-4 flex-shrink-0">{i + 1}</span>
                      <span className="text-white/85 text-xs truncate">{t.title}</span>
                    </button>
                    <button onClick={() => removeTrack(t.id)} aria-label="삭제"
                      className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="px-4 pt-1">
              <button onClick={onCloseManage}
                className="w-full py-3 rounded-xl text-white/80 text-sm font-medium" style={{ background: 'rgba(255,255,255,0.08)' }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
