import { Book } from '@/types';

interface Props {
  book: Book;
  elapsed: number;
  running: boolean;
  accumulated: number;
}

const HOUR = 3600;
const SESSION_TARGET = 1800; // 30분 한 세션

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

export default function PlaylistTimer({ book, elapsed, running, accumulated }: Props) {
  // 한 세션 진행률 (30분 기준)
  const sessionProgress = Math.min(elapsed / SESSION_TARGET, 1);
  const sessionRemaining = Math.max(SESSION_TARGET - (elapsed % SESSION_TARGET), 0);
  const completedSessions = Math.floor(elapsed / SESSION_TARGET);

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
        @keyframes vinylSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes vinylSpinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes equalizer {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
      `}</style>

      <div className="relative flex flex-col items-center px-6 mt-4">
        <p className="text-white/40 text-[10px] uppercase tracking-[0.3em] mb-1">Now Reading</p>

        {/* 비닐/표지 */}
        <div className="relative my-6" style={{ width: 240, height: 240 }}>
          {/* 비닐 디스크 (뒷쪽, 회전) */}
          <div className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, #1a1a2e 30%, #0c0c18 70%)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.8)',
              animation: running ? 'vinylSpin 8s linear infinite' : 'none',
              transform: running ? undefined : 'rotate(0deg)',
            }}>
            {/* 비닐 홈 */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="absolute rounded-full border border-white/5"
                style={{
                  inset: 16 + i * 14,
                }} />
            ))}
          </div>

          {/* 표지 (앞쪽, 비닐보다 빠르게 회전) */}
          <div className="absolute rounded-full overflow-hidden"
            style={{
              inset: 36,
              boxShadow: '0 0 0 4px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.5)',
              animation: running ? 'vinylSpin 12s linear infinite' : 'none',
            }}>
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)' }}>
                <span className="text-white text-2xl font-black">{book.title.slice(0, 2)}</span>
              </div>
            )}
            {/* 중앙 구멍 */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#0C0C18] border-2 border-white/20" />
          </div>

          {/* 진행률 링 (오버레이) */}
          <svg className="absolute inset-0 pointer-events-none" width={240} height={240}>
            <circle cx={120} cy={120} r={118} fill="none"
              stroke="rgba(255,255,255,0.08)" strokeWidth={2} />
            <circle cx={120} cy={120} r={118} fill="none"
              stroke="url(#playGrad)" strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 118}
              strokeDashoffset={2 * Math.PI * 118 * (1 - sessionProgress)}
              transform="rotate(-90 120 120)"
              style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }} />
            <defs>
              <linearGradient id="playGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1DB954" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* 곡 정보 */}
        <p className="text-white text-lg font-bold text-center leading-tight max-w-[280px] line-clamp-1">{book.title}</p>
        <p className="text-white/50 text-sm mt-1 text-center max-w-[260px] truncate">{book.author}</p>

        {/* EQ */}
        {running && (
          <div className="flex items-end gap-1 mt-3 h-5">
            {[0.2, 0.6, 0.4, 0.8, 0.3].map((delay, i) => (
              <div key={i} className="w-1 rounded-full bg-emerald-400"
                style={{
                  height: '100%',
                  transformOrigin: 'bottom',
                  animation: `equalizer 0.${5 + i}s ease-in-out ${delay}s infinite`,
                }} />
            ))}
          </div>
        )}

        {/* 진행 바 */}
        <div className="w-full max-w-sm mt-6">
          <div className="h-1 bg-white/15 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full"
              style={{
                width: `${sessionProgress * 100}%`,
                transition: running ? 'width 1s linear' : 'none',
              }} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-white/60 text-xs font-medium tabular-nums">{fmt(elapsed % SESSION_TARGET)}</p>
            <p className="text-white/40 text-xs tabular-nums">-{fmt(sessionRemaining)}</p>
          </div>
        </div>

        {/* 세션 카운트 */}
        {completedSessions > 0 && (
          <div className="mt-4 px-3 py-1 rounded-full bg-white/10 border border-white/10">
            <p className="text-white/70 text-xs">트랙 {completedSessions}개 완주 · 총 {fmtTotal(accumulated)}</p>
          </div>
        )}
        {completedSessions === 0 && accumulated > 0 && (
          <div className="mt-4 px-3 py-1 rounded-full bg-white/10 border border-white/10">
            <p className="text-white/70 text-xs">총 {fmtTotal(accumulated)}</p>
          </div>
        )}
      </div>
    </>
  );
}
