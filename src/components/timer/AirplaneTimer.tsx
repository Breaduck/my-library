import { Book } from '@/types';

interface Props {
  book: Book;
  elapsed: number;
  running: boolean;
  accumulated: number;
}

const HOUR = 3600;

function fmt(s: number) {
  const h = Math.floor(s / HOUR);
  const m = Math.floor((s % HOUR) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/* 1초당 약 25m 이동한다고 가정. 한 시간 = 90km */
function calcDistance(s: number): string {
  const km = (s * 25) / 1000;
  if (km < 1) return `${Math.floor(s * 25)} m`;
  return `${km.toFixed(1)} km`;
}

function calcAltitude(s: number): number {
  // 0~60초: 이륙 (0 → 10000ft), 60초 이후 순항고도
  if (s === 0) return 0;
  if (s < 60) return Math.floor((s / 60) * 10000);
  return 10000 + Math.floor((s - 60) / 10);
}

export default function AirplaneTimer({ book, elapsed, running, accumulated }: Props) {
  // 비행 경로 진행도: 30분 = 1바퀴
  const cycleSec = 1800;
  const progress = (elapsed % cycleSec) / cycleSec;
  const distance = calcDistance(elapsed);
  const altitude = calcAltitude(elapsed);

  // 곡선 경로 (SVG)
  const pathD = 'M 30 220 Q 180 60, 330 220';
  // 비행기 위치 계산 (베지어 곡선의 보간)
  const t = progress;
  const mt = 1 - t;
  const px = mt * mt * 30 + 2 * mt * t * 180 + t * t * 330;
  const py = mt * mt * 220 + 2 * mt * t * 60 + t * t * 220;
  // 접선 각도
  const dx = 2 * mt * (180 - 30) + 2 * t * (330 - 180);
  const dy = 2 * mt * (60 - 220) + 2 * t * (220 - 60);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <>
      {/* 밤하늘 배경 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0c0c18 60%, #000 100%)' }}>
        {/* 별들 */}
        {Array.from({ length: 60 }).map((_, i) => {
          const top = (i * 37) % 100;
          const left = (i * 61) % 100;
          const size = (i % 3) + 1;
          const delay = (i * 0.13) % 3;
          return (
            <div key={i} className="absolute rounded-full bg-white"
              style={{
                top: `${top}%`,
                left: `${left}%`,
                width: size,
                height: size,
                opacity: 0.4 + ((i * 7) % 60) / 100,
                animation: running ? `twinkle ${2 + (i % 3)}s ease-in-out ${delay}s infinite` : 'none',
              }} />
          );
        })}
        {/* 달 */}
        <div className="absolute"
          style={{
            top: '12%',
            right: '15%',
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #fffbeb, #fde68a 60%, #d97706 100%)',
            boxShadow: '0 0 60px rgba(253,230,138,0.4)',
          }} />
        {/* 구름 */}
        <div className="absolute bottom-0 left-0 right-0 h-32"
          style={{ background: 'linear-gradient(to top, rgba(99,102,241,0.15), transparent)' }} />
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
        @keyframes planeWobble {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
      `}</style>

      <div className="relative flex flex-col items-center mt-2 px-6">
        {/* 출발 → 도착 표시 */}
        <div className="w-full max-w-sm flex items-center justify-between mb-4">
          <div className="text-center">
            <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">출발</p>
            <p className="text-white/80 text-xs font-medium">현실</p>
          </div>
          <div className="flex-1 px-3 flex items-center justify-center">
            <div className="text-center">
              <p className="text-amber-300 text-[10px] mb-0.5">✈ {distance}</p>
              <p className="text-white/30 text-[9px]">{altitude.toLocaleString()} ft</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">도착</p>
            <p className="text-white/80 text-xs font-medium truncate max-w-[80px]">{book.title}</p>
          </div>
        </div>

        {/* 비행 경로 SVG */}
        <div className="relative w-full" style={{ maxWidth: 360, height: 240 }}>
          <svg width="100%" height="240" viewBox="0 0 360 240" className="overflow-visible">
            <defs>
              <linearGradient id="pathBg" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
              </linearGradient>
              <linearGradient id="pathDone" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>
            </defs>

            {/* 점선 경로 (전체) */}
            <path d={pathD} fill="none" stroke="rgba(255,255,255,0.15)"
              strokeWidth={2} strokeDasharray="4 6" />

            {/* 진행된 경로 (그라데이션) */}
            <path d={pathD} fill="none" stroke="url(#pathDone)"
              strokeWidth={3}
              strokeLinecap="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1 - progress,
                transition: running ? 'stroke-dashoffset 1s linear' : 'none',
              }} />

            {/* 출발지 점 */}
            <circle cx={30} cy={220} r={5} fill="#a78bfa" />
            <circle cx={30} cy={220} r={9} fill="#a78bfa" opacity={0.3} />

            {/* 도착지 점 */}
            <circle cx={330} cy={220} r={5} fill="#34d399" />
            <circle cx={330} cy={220} r={9} fill="#34d399" opacity={0.3} />

            {/* 비행기 */}
            <g transform={`translate(${px}, ${py}) rotate(${angle})`}
              style={{
                transition: running ? 'transform 1s linear' : 'none',
                animation: running ? 'planeWobble 2s ease-in-out infinite' : 'none',
              }}>
              <g transform="translate(-14, -14)">
                <circle cx={14} cy={14} r={16} fill="rgba(251,191,36,0.15)" />
                <text x={14} y={20} textAnchor="middle" fontSize={20} fill="#fff">✈</text>
              </g>
            </g>
          </svg>
        </div>

        {/* 시간 표시 */}
        <div className="mt-4 text-center">
          <p className="text-white tabular-nums font-extralight"
            style={{ fontSize: elapsed >= HOUR ? 44 : 56, letterSpacing: '-0.025em', lineHeight: 1 }}>
            {fmt(elapsed)}
          </p>
          <p className="text-white/40 text-xs mt-2">
            {!running && elapsed === 0
              ? '탑승하시면 출발합니다'
              : running
              ? '✨ 책으로 비행 중'
              : '잠시 착륙 중'}
          </p>
        </div>

        {/* 누적 시간 */}
        {accumulated > 0 && (
          <div className="mt-3 px-4 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-white/50 text-xs">총 비행 시간 · <span className="text-amber-300">{calcDistance(accumulated)}</span></p>
          </div>
        )}
      </div>
    </>
  );
}
