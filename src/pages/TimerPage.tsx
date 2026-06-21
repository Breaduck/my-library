import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useBooks } from '@/hooks/useBooks';
import { logReadingDate } from '@/lib/storage';
import ClassicTimer from '@/components/timer/ClassicTimer';
import AirplaneTimer from '@/components/timer/AirplaneTimer';
import PlaylistTimer from '@/components/timer/PlaylistTimer';

const HOUR = 3600;
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
  const { books, loaded, updateBook } = useBooks();
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [savedElapsed, setSavedElapsed] = useState(0);
  const [mode, setMode] = useState<Mode>('classic');
  const [showModeSheet, setShowModeSheet] = useState(false);

  const book = books.find((b) => b.id === id);

  useEffect(() => {
    const saved = localStorage.getItem('timer-mode') as Mode | null;
    if (saved && MODES.some((m) => m.key === saved)) setMode(saved);
  }, []);

  function changeMode(m: Mode) {
    setMode(m);
    localStorage.setItem('timer-mode', m);
    setShowModeSheet(false);
  }

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!running || elapsed === 0) return;
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [running, elapsed]);

  function handleFinish() {
    setRunning(false);
    setSavedElapsed(elapsed);
    if (elapsed > 0 && book && id) {
      updateBook(id, { totalReadingTime: (book.totalReadingTime ?? 0) + elapsed });
      logReadingDate();
    }
    setFinished(true);
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
        <Link to={`/book/${id}`}
          className="w-10 h-10 flex items-center justify-center rounded-full text-white active:opacity-60 transition-opacity"
          style={{ background: 'rgba(255,255,255,0.08)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {/* 모드 선택 버튼 */}
        <button onClick={() => setShowModeSheet(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-white text-xs font-medium active:opacity-70 transition-opacity"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {currentMode.label}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {elapsed > 0 ? (
          <button onClick={handleFinish}
            className="px-4 py-2 rounded-full text-white/80 text-xs font-medium border border-white/10 active:opacity-70 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            종료 & 저장
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      <div className="relative flex-1 flex flex-col">
        {mode === 'classic'  && <ClassicTimer  book={book} elapsed={elapsed} running={running} accumulated={accumulated} />}
        {mode === 'airplane' && <AirplaneTimer book={book} elapsed={elapsed} running={running} accumulated={accumulated} />}
        {mode === 'playlist' && <PlaylistTimer book={book} elapsed={elapsed} running={running} accumulated={accumulated} />}
      </div>

      <div className="relative flex items-center justify-center pt-4 pb-2 z-10">
        <button
          onClick={() => setRunning((r) => !r)}
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
