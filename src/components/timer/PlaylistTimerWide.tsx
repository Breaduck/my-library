import { Book } from '@/types';

interface Props {
  book: Book;
  elapsed: number;
  running: boolean;
  accumulated: number;
  sessionTarget?: number;
}

const HOUR = 3600;

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
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

// 옵션 2 — LP판을 좌측에 크게(화면 절반) 두고, 우측에 시간·정보를 큼직하게 보여주는 레이아웃
export default function PlaylistTimerWide({ book, elapsed, running, accumulated, sessionTarget = 1800 }: Props) {
  const SESSION_TARGET = sessionTarget;
  const sessionProgress = (elapsed % SESSION_TARGET) / SESSION_TARGET;
  const sessionRemaining = Math.max(SESSION_TARGET - (elapsed % SESSION_TARGET), 0);
  const completedSessions = Math.floor(elapsed / SESSION_TARGET);
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <>
      {/* 배경: 책 표지 블러 */}
      {book.coverUrl && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <img src={book.coverUrl} alt="" className="w-full h-full object-cover scale-150"
            style={{ filter: 'blur(80px) saturate(1.4)', opacity: 0.5 }} />
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(12,12,24,0.55) 0%, rgba(12,12,24,0.85) 100%)' }} />
        </div>
      )}

      <style>{`
        @keyframes vinylSpinW { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes equalizerW { 0%,100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
      `}</style>

      <div className="relative flex-1 flex items-center gap-5 sm:gap-10 px-5 sm:px-12">
        {/* 좌측: 큰 LP판 (화면 절반 정도) */}
        <div className="relative flex-shrink-0"
          style={{ width: 'min(46vw, 400px)', height: 'min(46vw, 400px)' }}>
          {/* 비닐 디스크 */}
          <div className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, #1a1a2e 30%, #0c0c18 70%)',
              boxShadow: '0 28px 80px rgba(0,0,0,0.65), inset 0 0 40px rgba(0,0,0,0.8)',
              animation: running ? 'vinylSpinW 8s linear infinite' : 'none',
            }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="absolute rounded-full border border-white/5"
                style={{ inset: `${6 + i * 5.5}%` }} />
            ))}
          </div>

          {/* 표지 */}
          <div className="absolute rounded-full overflow-hidden"
            style={{
              inset: '15%',
              boxShadow: '0 0 0 4px rgba(0,0,0,0.4), 0 8px 40px rgba(0,0,0,0.5)',
              animation: running ? 'vinylSpinW 12s linear infinite' : 'none',
            }}>
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)' }}>
                <span className="text-white text-4xl font-black">{book.title.slice(0, 2)}</span>
              </div>
            )}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0C0C18] border-2 border-white/20"
              style={{ width: '9%', height: '9%' }} />
          </div>

          {/* 진행률 링 */}
          <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1.2} />
            <circle cx={50} cy={50} r={R} fill="none" stroke="url(#playGradW)" strokeWidth={1.8}
              strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - sessionProgress)}
              transform="rotate(-90 50 50)"
              style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }} />
            <defs>
              <linearGradient id="playGradW" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1DB954" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* 우측: 정보 + 큰 시간 */}
        <div className="flex-1 min-w-0 flex flex-col">
          <p className="text-white/40 text-[10px] sm:text-xs uppercase tracking-[0.3em] mb-2">읽는중</p>
          <h1 className="text-white font-bold leading-tight line-clamp-2 text-xl sm:text-3xl">{book.title}</h1>
          <p className="text-white/50 text-sm sm:text-base mt-1 truncate">{book.author}</p>

          {/* 큰 시간 */}
          <div className="mt-6 sm:mt-8">
            <p className="text-white font-extralight tabular-nums leading-none"
              style={{ fontSize: 'clamp(44px, 11vw, 84px)', letterSpacing: '-0.03em' }}>
              {fmt(elapsed % SESSION_TARGET)}
            </p>
            <p className="text-white/40 text-sm mt-2 tabular-nums">남은 트랙 -{fmt(sessionRemaining)}</p>
          </div>

          {/* 진행 바 */}
          <div className="mt-5 w-full max-w-xs">
            <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full"
                style={{ width: `${sessionProgress * 100}%`, transition: running ? 'width 1s linear' : 'none' }} />
            </div>
          </div>

          {/* EQ + 세션/누적 */}
          <div className="mt-5 flex items-center gap-3">
            {running && (
              <div className="flex items-end gap-1 h-5">
                {[0.2, 0.6, 0.4, 0.8, 0.3].map((delay, i) => (
                  <div key={i} className="w-1 rounded-full bg-emerald-400"
                    style={{ height: '100%', transformOrigin: 'bottom', animation: `equalizerW 0.${5 + i}s ease-in-out ${delay}s infinite` }} />
                ))}
              </div>
            )}
            <div className="px-3 py-1 rounded-full bg-white/10 border border-white/10">
              <p className="text-white/70 text-xs">
                {completedSessions > 0 ? `트랙 ${completedSessions}개 · ` : ''}총 {fmtTotal(accumulated)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
