import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useBooks } from '@/hooks/useBooks';
import { logReadingDate } from '@/lib/storage';
import { logTimerSeconds } from '@/lib/game';
import ClassicTimer from '@/components/timer/ClassicTimer';
import AirplaneTimer from '@/components/timer/AirplaneTimer';
import PlaylistTimer from '@/components/timer/PlaylistTimer';
import PlaylistTimerWide from '@/components/timer/PlaylistTimerWide';
import YouTubePlaylist from '@/components/timer/YouTubePlaylist';

const HOUR = 3600;
const SESSION_OPTIONS = [10, 30, 60]; // 트랙(세션) 길이(분) — 10분 / 30분 / 1시간
type Mode = 'classic' | 'airplane' | 'playlist';

const MODES: { key: Mode; label: string; desc: string }[] = [
  { key: 'classic',  label: '일반형',     desc: '깔끔한 링 타이머' },
  { key: 'airplane', label: '비행기 여행', desc: '책으로 떠나는 여행' },
  { key: 'playlist', label: '플레이리스트', desc: '독서를 재생' },
];

function fmtTotal(s: number): string {
  if (s === 0) return '0분';
  if (s < 60) return `${s}초`;
  const h = Math.floor(s / HOUR);
  const m = Math.floor((s % HOUR) / 60);
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

export default function TimerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { books, loaded, updateBook } = useBooks();
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [savedElapsed, setSavedElapsed] = useState(0);
  const [mode, setMode] = useState<Mode>('classic');
  const [showModeSheet, setShowModeSheet] = useState(false);
  const [sessionMin, setSessionMin] = useState(30);
  const [customMins, setCustomMins] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('playlist-custom-sessions') || '[]'); } catch { return []; }
  });
  const [showCustomSheet, setShowCustomSheet] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showYtManage, setShowYtManage] = useState(false);
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [playlistLayout, setPlaylistLayout] = useState<'1' | '2'>('1');
  // 시작 시각 기준으로 경과를 계산 — setInterval 카운트 방식은 화면이 꺼지거나
  // 백그라운드로 가면 멈춰서 실제 읽은 시간이 크게 누락된다.
  const startAtRef = useRef<number | null>(null);

  const book = books.find((b) => b.id === id);

  const currentElapsed = useCallback(() => {
    if (running && startAtRef.current != null) {
      return Math.max(0, Math.floor((Date.now() - startAtRef.current) / 1000));
    }
    return elapsed;
  }, [running, elapsed]);

  function toggleRunning() {
    if (running) {
      setElapsed(currentElapsed());
      setRunning(false);
    } else {
      startAtRef.current = Date.now() - elapsed * 1000;
      setRunning(true);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem('timer-mode') as Mode | null;
    if (saved && MODES.some((m) => m.key === saved)) setMode(saved);
    const savedMin = parseInt(localStorage.getItem('playlist-session-min') || '');
    if (savedMin > 0) setSessionMin(savedMin);
    const savedLayout = localStorage.getItem('playlist-layout');
    if (savedLayout === '1' || savedLayout === '2') setPlaylistLayout(savedLayout);
  }, []);

  function changeLayout(v: '1' | '2') {
    setPlaylistLayout(v);
    localStorage.setItem('playlist-layout', v);
  }

  function changeSessionMin(min: number) {
    setSessionMin(min);
    localStorage.setItem('playlist-session-min', String(min));
  }

  function addCustomMin() {
    const n = Math.max(1, Math.min(600, parseInt(customInput) || 0));
    if (!n) return;
    if (![...SESSION_OPTIONS, ...customMins].includes(n)) {
      const next = [...customMins, n].sort((a, b) => a - b);
      setCustomMins(next);
      localStorage.setItem('playlist-custom-sessions', JSON.stringify(next));
    }
    changeSessionMin(n);
    setCustomInput('');
    setShowCustomSheet(false);
  }

  function removeCustomMin(n: number) {
    const next = customMins.filter((m) => m !== n);
    setCustomMins(next);
    localStorage.setItem('playlist-custom-sessions', JSON.stringify(next));
    if (sessionMin === n) changeSessionMin(30);
  }

  function changeMode(m: Mode) {
    setMode(m);
    localStorage.setItem('timer-mode', m);
    setShowModeSheet(false);
  }

  useEffect(() => {
    if (!running) return;
    const sync = () => {
      if (startAtRef.current != null) {
        setElapsed(Math.max(0, Math.floor((Date.now() - startAtRef.current) / 1000)));
      }
    };
    const t = setInterval(sync, 1000);
    // 화면이 다시 켜지면(백그라운드 복귀) 즉시 실제 경과 시간으로 보정
    document.addEventListener('visibilitychange', sync);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', sync); };
  }, [running]);

  useEffect(() => {
    if (!running || elapsed === 0) return;
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [running, elapsed]);

  function handleFinish() {
    const e = currentElapsed();
    setRunning(false);
    setElapsed(e);
    setSavedElapsed(e);
    if (e > 0 && book && id) {
      updateBook(id, { totalReadingTime: (book.totalReadingTime ?? 0) + e });
      logReadingDate();
      logTimerSeconds(e); // 게임 모드 타이머 퀘스트 진행도
    }
    setFinished(true);
  }

  // 뒤로가기로 나가도 기록이 사라지지 않게 저장하고 이동
  function leaveAndSave() {
    const e = currentElapsed();
    if (e > 0 && book && id) {
      updateBook(id, { totalReadingTime: (book.totalReadingTime ?? 0) + e });
      logReadingDate();
      logTimerSeconds(e);
    }
    navigate(`/book/${id}`);
  }

  // 플레이리스트에서 LP를 눌러 다른 책으로 전환 — 현재까지 읽은 시간은 지금 책에 저장하고,
  // 타이머를 0부터 새로 시작한다(재생 중이면 새 책도 이어서 재생).
  function switchBook(newId: string) {
    setShowBookPicker(false);
    if (newId === id) return;
    const e = currentElapsed();
    if (e > 0 && book && id) {
      updateBook(id, { totalReadingTime: (book.totalReadingTime ?? 0) + e });
      logReadingDate();
      logTimerSeconds(e);
    }
    setElapsed(0);
    startAtRef.current = running ? Date.now() : null;
    navigate(`/timer/${newId}`, { replace: true });
  }

  if (!loaded) return (
    <div className="min-h-screen bg-[#0C0C18] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
    </div>
  );

  if (!book) return (
    <div className="min-h-screen bg-[#0C0C18] flex items-center justify-center">
      <Link to="/" className="text-white/50 text-sm">서재로 돌아가기</Link>
    </div>
  );

  /* ── Completion ── */
  if (finished) {
    const total = book.totalReadingTime ?? 0;
    return (
      <div className="min-h-screen bg-[#0C0C18] flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>
        {book.coverUrl && (
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            <img src={book.coverUrl} alt="" className="w-full h-full object-cover opacity-[0.08] scale-125"
              style={{ filter: 'blur(40px)' }} />
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 relative">
          <div className="w-20 h-20 rounded-full border border-indigo-400/30 flex items-center justify-center"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, rgba(99,102,241,0.05) 100%)' }}>
            <svg className="w-9 h-9 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div className="text-center">
            <p className="text-white/40 text-sm mb-3">오늘 독서</p>
            <p className="text-white font-extralight tabular-nums"
              style={{ fontSize: 62, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {fmtTotal(savedElapsed)}
            </p>
            <p className="text-white/30 text-sm mt-3">읽었어요</p>
          </div>

          {total > 0 && (
            <div className="w-full max-w-xs rounded-2xl px-6 py-5 text-center border border-white/8"
              style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>
              <p className="text-white/30 text-[10px] uppercase tracking-[0.15em] mb-1.5">누적 독서 시간</p>
              <p className="text-white text-2xl font-light">{fmtTotal(total)}</p>
            </div>
          )}
        </div>

        <div className="relative px-6 flex flex-col gap-3">
          <button
            onClick={() => { setElapsed(0); setSavedElapsed(0); setFinished(false); setRunning(false); }}
            className="w-full py-4 rounded-2xl text-white/80 text-sm font-medium border border-white/10 active:scale-[0.98] transition-all"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            계속 읽기
          </button>
          <Link to={`/book/${id}`}
            className="w-full py-4 rounded-2xl bg-white text-[#0C0C18] text-sm font-semibold text-center active:scale-[0.98] transition-all block">
            서재로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const accumulated = (book.totalReadingTime ?? 0) + elapsed;
  const currentMode = MODES.find((m) => m.key === mode)!;

  return (
    <div className="min-h-screen bg-[#0C0C18] flex flex-col select-none"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>

      <div className="relative flex items-center justify-between px-5 pt-5 pb-2 z-10">
        <button onClick={leaveAndSave}
          title="나가기 (시간은 자동 저장돼요)"
          className="w-10 h-10 flex items-center justify-center rounded-full text-white active:opacity-60 transition-opacity"
          style={{ background: 'rgba(255,255,255,0.08)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 모드 선택 버튼 */}
        <button onClick={() => setShowModeSheet(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-white text-xs font-medium active:opacity-70 transition-opacity"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {currentMode.label}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {mode === 'playlist' && (
            <div className="inline-flex p-0.5 rounded-full gap-0.5" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {([['1', '기본'], ['2', '크게']] as const).map(([v, label]) => {
                const active = playlistLayout === v;
                return (
                  <button key={v} onClick={() => changeLayout(v)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all active:scale-95"
                    style={{ background: active ? 'rgba(255,255,255,0.95)' : 'transparent', color: active ? '#0C0C18' : 'rgba(255,255,255,0.55)' }}>
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          {mode === 'playlist' && (
            <button onClick={() => setShowYtManage(true)} aria-label="유튜브 링크 추가"
              className="w-10 h-10 flex items-center justify-center rounded-full text-white active:opacity-70 transition-opacity"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <svg className="w-5 h-5 text-[#FF0000]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31 31 0 000 12a31 31 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31 31 0 0024 12a31 31 0 00-.5-5.8zM9.5 15.5v-7l6.3 3.5-6.3 3.5z" />
              </svg>
            </button>
          )}
          {elapsed > 0 ? (
            <button onClick={handleFinish}
              className="px-4 py-2 rounded-full text-white/80 text-xs font-medium border border-white/10 active:opacity-70 transition-opacity"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              종료 & 저장
            </button>
          ) : (mode !== 'playlist' && <div className="w-10" />)}
        </div>
      </div>

      <div className="relative flex-1 flex flex-col">
        {mode === 'classic'  && <ClassicTimer  book={book} elapsed={elapsed} running={running} accumulated={accumulated} />}
        {mode === 'airplane' && <AirplaneTimer book={book} elapsed={elapsed} running={running} accumulated={accumulated} />}
        {mode === 'playlist' && (playlistLayout === '2'
          ? <PlaylistTimerWide book={book} elapsed={elapsed} running={running} accumulated={accumulated} sessionTarget={sessionMin * 60}
              sessionOptions={[...SESSION_OPTIONS, ...customMins]} sessionMin={sessionMin}
              onSelectMin={changeSessionMin} onAddCustom={() => { setCustomInput(''); setShowCustomSheet(true); }}
              onPickBook={() => setShowBookPicker(true)}
              onToggleRunning={toggleRunning} />
          : <PlaylistTimer book={book} elapsed={elapsed} running={running} accumulated={accumulated} sessionTarget={sessionMin * 60}
              onPickBook={() => setShowBookPicker(true)} />)}
      </div>

      {/* 플레이리스트 트랙 길이 선택 — 옵션2(크게)에서는 우측 패널 안으로 들어간다 */}
      {mode === 'playlist' && playlistLayout !== '2' && (
        <div className="relative z-10 flex justify-center px-6 pt-2">
          <div className="flex items-center gap-0.5 p-1 rounded-full max-w-full overflow-x-auto" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {[...SESSION_OPTIONS, ...customMins].map((min) => {
              const active = sessionMin === min;
              return (
                <button key={min} onClick={() => changeSessionMin(min)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 flex-shrink-0"
                  style={{
                    background: active ? 'linear-gradient(135deg, #1DB954, #22d3ee)' : 'transparent',
                    color: active ? '#0C0C18' : 'rgba(255,255,255,0.55)',
                  }}>
                  {min === 60 ? '1시간' : `${min}분`}
                </button>
              );
            })}
            <button onClick={() => { setCustomInput(''); setShowCustomSheet(true); }} aria-label="트랙 길이 직접 설정"
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 active:scale-95 transition-transform flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* 유튜브 음악 플레이리스트 — 타이머를 재생하면 음악도 자동으로 나온다 */}
      {mode === 'playlist' && (
        <YouTubePlaylist running={running} manageOpen={showYtManage} onCloseManage={() => setShowYtManage(false)} />
      )}

      {/* 트랙 길이 직접 설정 — 10/30/60분 외에 원하는 시간을 추가 */}
      {showCustomSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => e.target === e.currentTarget && setShowCustomSheet(false)}>
          <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #0c0c18 100%)', border: '1px solid rgba(255,255,255,0.08)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-2 sm:hidden" />
            <div className="px-6 pt-3 pb-3">
              <h3 className="text-white text-base font-bold mb-1">트랙 길이 직접 설정</h3>
              <p className="text-white/40 text-xs">원하는 시간(분)을 정해 나만의 트랙을 만들어요</p>
            </div>
            <div className="px-4 pb-2">
              <div className="flex gap-2">
                <input type="number" inputMode="numeric" value={customInput} min={1} max={600} autoFocus
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomMin())}
                  placeholder="예) 45"
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                <button onClick={addCustomMin} disabled={!customInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-white text-[#0C0C18] text-sm font-semibold disabled:opacity-40 active:scale-95 transition-transform flex-shrink-0">
                  추가
                </button>
              </div>
            </div>
            {customMins.length > 0 && (
              <div className="px-4 pt-2 pb-1">
                <p className="text-white/35 text-[11px] mb-1.5 px-1">내가 추가한 시간</p>
                <div className="flex flex-wrap gap-1.5">
                  {customMins.map((m) => (
                    <span key={m} className="flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-full text-white/85 text-xs"
                      style={{ background: 'rgba(255,255,255,0.08)' }}>
                      {m}분
                      <button onClick={() => removeCustomMin(m)} aria-label={`${m}분 삭제`}
                        className="w-5 h-5 flex items-center justify-center rounded-full text-white/50 hover:text-red-400 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="px-4 pt-3">
              <button onClick={() => setShowCustomSheet(false)}
                className="w-full py-3 rounded-xl text-white/80 text-sm font-medium" style={{ background: 'rgba(255,255,255,0.08)' }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 책 선택 — 플레이리스트에서 LP를 눌러 다른 책으로 전환 */}
      {showBookPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => e.target === e.currentTarget && setShowBookPicker(false)}>
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
            style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #0c0c18 100%)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '80vh', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-2 sm:hidden flex-shrink-0" />
            <div className="px-6 pt-3 pb-3 flex-shrink-0">
              <h3 className="text-white text-base font-bold mb-1">다른 책 재생하기</h3>
              <p className="text-white/40 text-xs">표지를 선택하면 그 책으로 이어서 읽어요 · 지금까지 읽은 시간은 자동 저장돼요</p>
            </div>
            <div className="px-4 pb-2 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                {[...books]
                  .sort((a, b) => {
                    // 읽는 중인 책을 먼저, 그다음 최근 갱신 순
                    const order = (s: string) => (s === 'reading' ? 0 : s === 'want' ? 1 : 2);
                    if (order(a.status) !== order(b.status)) return order(a.status) - order(b.status);
                    return (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? '');
                  })
                  .map((b) => {
                    const current = b.id === id;
                    return (
                      <button key={b.id} onClick={() => switchBook(b.id)}
                        className="group flex flex-col gap-1.5 active:scale-95 transition-transform text-left">
                        <div className="relative rounded-xl overflow-hidden aspect-[2/3]"
                          style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.5)', border: current ? '2px solid #22d3ee' : '1px solid rgba(255,255,255,0.08)' }}>
                          {b.coverUrl ? (
                            <img src={b.coverUrl} alt={b.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center p-1"
                              style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)' }}>
                              <span className="text-white text-sm font-black text-center line-clamp-3">{b.title}</span>
                            </div>
                          )}
                          {current && (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(12,12,24,0.55)' }}>
                              <span className="px-2 py-0.5 rounded-full bg-cyan-400 text-[#0C0C18] text-[10px] font-bold">재생 중</span>
                            </div>
                          )}
                        </div>
                        <p className="text-white/80 text-[11px] leading-tight line-clamp-2 px-0.5">{b.title}</p>
                      </button>
                    );
                  })}
              </div>
            </div>
            <div className="px-4 pt-3 flex-shrink-0">
              <button onClick={() => setShowBookPicker(false)}
                className="w-full py-3 rounded-xl text-white/80 text-sm font-medium" style={{ background: 'rgba(255,255,255,0.08)' }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 재생 버튼 — 옵션2(크게)에서는 우측 패널 안에 있으므로 숨김 */}
      {!(mode === 'playlist' && playlistLayout === '2') && (
        <div className="relative flex items-center justify-center pt-4 pb-2 z-10">
          <button
            onClick={toggleRunning}
            className="w-[76px] h-[76px] rounded-full bg-white flex items-center justify-center active:scale-95 transition-transform"
            style={{ boxShadow: running ? '0 0 48px rgba(129,140,248,0.5), 0 8px 24px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.6)' }}>
            {running ? (
              <svg className="w-7 h-7 text-[#0C0C18]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-[#0C0C18] translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Mode picker bottom sheet */}
      {showModeSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => e.target === e.currentTarget && setShowModeSheet(false)}>
          <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #1a1a2e 0%, #0c0c18 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
            }}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-2 sm:hidden" />
            <div className="px-6 pt-3 pb-4">
              <h3 className="text-white text-base font-bold mb-1">타이머 모드</h3>
              <p className="text-white/40 text-xs">취향에 맞는 방식으로 책에 빠져들어요</p>
            </div>
            <div className="px-3 pb-3 space-y-2">
              {MODES.map((m) => {
                const active = mode === m.key;
                return (
                  <button key={m.key} onClick={() => changeMode(m.key)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left active:scale-[0.98]"
                    style={{
                      background: active ? 'rgba(129,140,248,0.18)' : 'rgba(255,255,255,0.04)',
                      border: active ? '1px solid rgba(129,140,248,0.5)' : '1px solid rgba(255,255,255,0.06)',
                    }}>
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        background: active
                          ? 'linear-gradient(135deg, #818CF8, #C084FC)'
                          : 'rgba(255,255,255,0.05)',
                      }}>
                      {m.key === 'classic' && (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {m.key === 'airplane' && (
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                        </svg>
                      )}
                      {m.key === 'playlist' && (
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-semibold">{m.label}</p>
                      <p className="text-white/50 text-xs mt-0.5">{m.desc}</p>
                    </div>
                    {active && (
                      <svg className="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
