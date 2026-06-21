'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useBooks } from '@/hooks/useBooks';
import { logReadingDate } from '@/lib/storage';

const R = 112;
const SW = 10;
const SIZE = (R + SW) * 2 + 8;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRC = 2 * Math.PI * R;
const HOUR = 3600;

function fmt(s: number) {
  const h = Math.floor(s / HOUR);
  const m = Math.floor((s % HOUR) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fmtTotal(s: number): string {
  if (s === 0) return '0분';
  if (s < 60) return `${s}초`;
  const h = Math.floor(s / HOUR);
  const m = Math.floor((s % HOUR) / 60);
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

export default function TimerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { books, loaded, updateBook } = useBooks();
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [savedElapsed, setSavedElapsed] = useState(0);

  const book = books.find((b) => b.id === id);

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
    if (elapsed > 0 && book) {
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
      <Link href="/" className="text-white/50 text-sm">서재로 돌아가기</Link>
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
          {/* Check circle */}
          <div className="w-20 h-20 rounded-full border border-indigo-400/30 flex items-center justify-center"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, rgba(99,102,241,0.05) 100%)' }}>
            <svg className="w-9 h-9 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          {/* Session time */}
          <div className="text-center">
            <p className="text-white/40 text-sm mb-3">오늘 독서</p>
            <p className="text-white font-extralight tabular-nums"
              style={{ fontSize: 62, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {fmtTotal(savedElapsed)}
            </p>
            <p className="text-white/30 text-sm mt-3">읽었어요</p>
          </div>

          {/* Cumulative */}
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
          <Link href={`/book/${id}`}
            className="w-full py-4 rounded-2xl bg-white text-[#0C0C18] text-sm font-semibold text-center active:scale-[0.98] transition-all block">
            서재로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  /* ── Timer ── */
  const progress = elapsed > 0 ? (elapsed % HOUR) / HOUR : 0;
  const lap = Math.floor(elapsed / HOUR);
  const dashOffset = CIRC * (1 - progress);
  const accumulated = (book.totalReadingTime ?? 0) + elapsed;

  return (
    <div className="min-h-screen bg-[#0C0C18] flex flex-col select-none"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>

      {/* Blurred background cover */}
      {book.coverUrl && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <img src={book.coverUrl} alt="" className="w-full h-full object-cover opacity-[0.07] scale-125"
            style={{ filter: 'blur(48px)' }} />
        </div>
      )}

      {/* Top bar */}
      <div className="relative flex items-center justify-between px-5 pt-5 pb-2">
        <Link href={`/book/${id}`}
          className="w-10 h-10 flex items-center justify-center rounded-full text-white active:opacity-60 transition-opacity"
          style={{ background: 'rgba(255,255,255,0.08)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        {elapsed > 0 && (
          <button onClick={handleFinish}
            className="px-5 py-2.5 rounded-full text-white/80 text-sm font-medium border border-white/10 active:opacity-70 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            종료 & 저장
          </button>
        )}
      </div>

      {/* Book info */}
      <div className="relative flex flex-col items-center mt-5 px-6">
        <div className="rounded-2xl overflow-hidden flex-shrink-0 mb-3"
          style={{ width: 64, height: 92, boxShadow: '0 16px 48px rgba(0,0,0,0.7)' }}>
          {book.coverUrl
            ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <span className="text-white/50 text-sm font-bold">{book.title.slice(0, 2)}</span>
              </div>
          }
        </div>
        <p className="text-white font-medium text-sm text-center max-w-[220px] leading-snug line-clamp-1">{book.title}</p>
        <p className="text-white/40 text-xs mt-0.5 max-w-[180px] text-center truncate">{book.author}</p>
      </div>

      {/* Ring */}
      <div className="relative flex-1 flex flex-col items-center justify-center mt-2">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE}>
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#C084FC" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <g transform={`rotate(-90 ${CX} ${CY})`}>
              {/* Track */}
              <circle cx={CX} cy={CY} r={R} fill="none"
                stroke="rgba(255,255,255,0.06)" strokeWidth={SW} />
              {/* Progress */}
              {elapsed > 0 && (
                <circle cx={CX} cy={CY} r={R} fill="none"
                  stroke="url(#ringGrad)" strokeWidth={SW}
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={dashOffset}
                  filter={running ? 'url(#glow)' : undefined}
                  style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }}
                />
              )}
            </g>
          </svg>

          {/* Center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-white tabular-nums font-extralight"
              style={{ fontSize: elapsed >= HOUR ? 38 : 52, letterSpacing: '-0.025em', lineHeight: 1 }}>
              {fmt(elapsed)}
            </p>
            {lap > 0 && (
              <p className="text-white/30 text-xs mt-2">{lap}시간 완료</p>
            )}
            {!running && elapsed === 0 && (
              <p className="text-white/25 text-xs mt-2">탭하여 시작</p>
            )}
          </div>
        </div>

        {/* Accumulated */}
        {accumulated > 0 && (
          <div className="mt-4 flex flex-col items-center">
            <p className="text-white/25 text-[10px] tracking-[0.12em] uppercase mb-0.5">총 독서 시간</p>
            <p className="text-white/55 text-base font-light">{fmtTotal(accumulated)}</p>
          </div>
        )}
      </div>

      {/* Play / Pause */}
      <div className="relative flex items-center justify-center pt-4 pb-2">
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
    </div>
  );
}
