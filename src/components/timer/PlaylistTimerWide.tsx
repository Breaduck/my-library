import { Book } from '@/types';

interface Props {
  book: Book;
  elapsed: number;
  running: boolean;
  accumulated: number;
  sessionTarget?: number;
  // 우측 패널에 넣는 컨트롤들 (트랙 길이 선택 + 재생 버튼)
  sessionOptions?: number[];
  sessionMin?: number;
  onSelectMin?: (min: number) => void;
  onAddCustom?: () => void; // 트랙 길이 직접 추가
  onPickBook?: () => void; // LP를 눌러 다른 책으로 전환
  onToggleRunning?: () => void;
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
export default function PlaylistTimerWide({
  book, elapsed, running, accumulated, sessionTarget = 1800,
  sessionOptions, sessionMin, onSelectMin, onAddCustom, onPickBook, onToggleRunning,
}: Props) {
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

      {/* LP + 정보를 한 덩어리로 묶어 화면 정중앙에 배치. LP는 더 왼쪽, 정보는 더 오른쪽으로
          간격을 넉넉히 벌려 여백을 살린다 */}
      <div className="relative flex-1 flex min-h-0 items-center justify-center px-6 sm:px-10">
        <div className="flex items-center justify-center gap-10 sm:gap-24 w-full max-w-5xl mx-auto">
        {/* 좌측: LP판 — 크게, 세로로도 안 넘치게. 누르면 다른 책으로 전환 */}
        <button type="button" onClick={onPickBook} aria-label="다른 책 선택"
          className="relative flex-shrink-0 active:scale-[0.98] transition-transform"
          style={{ width: 'min(42%, 70vh)', aspectRatio: '1 / 1' }}>
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

          {/* 다른 책 전환 힌트 */}
          {onPickBook && (
            <span className="absolute bottom-[2%] left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-1 rounded-full text-white/80 text-[10px] font-medium pointer-events-none whitespace-nowrap"
              style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" /></svg>
              다른 책
            </span>
          )}
        </button>

        {/* 우측: 정보 + 큰 시간 — 세로 중앙 정렬. max-w로 폭을 제한해 LP와 함께 화면 정중앙에 모이게 한다 */}
        <div className="flex-1 min-w-0 max-w-sm flex flex-col justify-center">
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

          {/* 트랙 길이 선택 — 10분 / 30분 / 1시간 + 직접 추가 */}
          {sessionOptions && onSelectMin && (
            <div className="mt-5 flex flex-wrap items-center gap-1.5">
              {sessionOptions.map((min) => {
                const active = sessionMin === min;
                return (
                  <button key={min} onClick={() => onSelectMin(min)}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                    style={{
                      background: active ? 'linear-gradient(135deg, #1DB954, #22d3ee)' : 'rgba(255,255,255,0.08)',
                      color: active ? '#0C0C18' : 'rgba(255,255,255,0.55)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                    {min === 60 ? '1시간' : `${min}분`}
                  </button>
                );
              })}
              {onAddCustom && (
                <button onClick={onAddCustom} aria-label="트랙 길이 직접 설정"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 active:scale-95 transition-transform"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" /></svg>
                </button>
              )}
            </div>
          )}

          {/* 재생 버튼 + EQ + 세션/누적 */}
          <div className="mt-6 flex items-center gap-4">
            {onToggleRunning && (
              <button
                onClick={onToggleRunning}
                className="w-16 h-16 rounded-full bg-white flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
                style={{ boxShadow: running ? '0 0 40px rgba(129,140,248,0.5), 0 8px 24px rgba(0,0,0,0.5)' : '0 8px 28px rgba(0,0,0,0.6)' }}>
                {running ? (
                  <svg className="w-6 h-6 text-[#0C0C18]" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
                ) : (
                  <svg className="w-6 h-6 text-[#0C0C18] translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>
            )}
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
      </div>
    </>
  );
}
