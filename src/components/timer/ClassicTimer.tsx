import { Book } from '@/types';

const R = 112;
const SW = 10;
const SIZE = (R + SW) * 2 + 8;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRC = 2 * Math.PI * R;
const HOUR = 3600;

interface Props {
  book: Book;
  elapsed: number;
  running: boolean;
  accumulated: number;
}

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

export default function ClassicTimer({ book, elapsed, running, accumulated }: Props) {
  const progress = elapsed > 0 ? (elapsed % HOUR) / HOUR : 0;
  const lap = Math.floor(elapsed / HOUR);
  const dashOffset = CIRC * (1 - progress);

  return (
    <>
      {book.coverUrl && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <img src={book.coverUrl} alt="" className="w-full h-full object-cover opacity-[0.07] scale-125"
            style={{ filter: 'blur(48px)' }} />
        </div>
      )}

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
              <circle cx={CX} cy={CY} r={R} fill="none"
                stroke="rgba(255,255,255,0.06)" strokeWidth={SW} />
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

        {accumulated > 0 && (
          <div className="mt-4 flex flex-col items-center">
            <p className="text-white/25 text-[10px] tracking-[0.12em] uppercase mb-0.5">총 독서 시간</p>
            <p className="text-white/55 text-base font-light">{fmtTotal(accumulated)}</p>
          </div>
        )}
      </div>
    </>
  );
}
