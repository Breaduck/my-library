import { Book } from '@/types';
import { DailyReading } from '@/lib/storage';

interface Props {
  books: Book[];
  dailyReadings: DailyReading[];
  streak: number;
}

// 레벨 정의 — 누적 XP 기준
const LEVELS = [
  { xp: 0,     title: '독서 새싹',   emoji: '🌱' },
  { xp: 300,   title: '책 친구',     emoji: '📖' },
  { xp: 800,   title: '이야기 수집가', emoji: '📚' },
  { xp: 1600,  title: '책벌레',      emoji: '🐛' },
  { xp: 3000,  title: '활자 애호가',  emoji: '🤓' },
  { xp: 5000,  title: '독서가',      emoji: '🎓' },
  { xp: 8000,  title: '서재의 주인',  emoji: '🏛️' },
  { xp: 12000, title: '독서 마스터',  emoji: '👑' },
];

export default function GamificationCard({ books, dailyReadings, streak }: Props) {
  const done = books.filter((b) => b.status === 'done');
  // XP: 읽은 페이지 1p = 1XP, 완독 1권 = 100XP 보너스
  const pagesFromDaily = dailyReadings.reduce((s, r) => s + r.pages, 0);
  const pagesFromDone = done.reduce((s, b) => s + (b.pages ?? 0), 0);
  const totalPages = Math.max(pagesFromDaily, pagesFromDone);
  const xp = totalPages + done.length * 100;

  const levelIdx = LEVELS.reduce((acc, lv, i) => (xp >= lv.xp ? i : acc), 0);
  const level = LEVELS[levelIdx];
  const next = LEVELS[levelIdx + 1];
  const levelProgress = next
    ? Math.min((xp - level.xp) / (next.xp - level.xp), 1)
    : 1;
  const rated = done.filter((b) => b.rating > 0);

  // 업적 배지
  const badges = [
    { emoji: '🎬', label: '첫 걸음',   desc: '첫 책 완독',       earned: done.length >= 1 },
    { emoji: '🔥', label: '3일 연속',  desc: '3일 연속 독서',     earned: streak >= 3 },
    { emoji: '⚡', label: '일주일',    desc: '7일 연속 독서',     earned: streak >= 7 },
    { emoji: '📗', label: '책장 채우기', desc: '10권 완독',        earned: done.length >= 10 },
    { emoji: '📜', label: '천 페이지',  desc: '누적 1,000쪽',     earned: totalPages >= 1000 },
    { emoji: '⭐', label: '평론가',    desc: '별점 5권 이상',     earned: rated.length >= 5 },
    { emoji: '🏆', label: '다독가',    desc: '25권 완독',        earned: done.length >= 25 },
    { emoji: '🌙', label: '만 페이지',  desc: '누적 10,000쪽',    earned: totalPages >= 10000 },
  ];
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="rounded-3xl p-5 sm:p-6 mb-4 text-white relative overflow-hidden"
      style={{ background: 'linear-gradient(140deg, #4F46E5 0%, #7C3AED 55%, #DB2777 100%)', boxShadow: '0 8px 32px rgba(99,70,229,0.28)' }}>
      {/* 배경 장식 */}
      <div className="absolute -top-14 -right-10 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)' }} />

      {/* 레벨 헤더 */}
      <div className="relative flex items-center gap-3.5">
        <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)' }}>
          <span className="text-3xl leading-none">{level.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-bold text-white/60 tracking-wide">LV.{levelIdx + 1}</span>
            <h2 className="text-[19px] font-extrabold tracking-tight truncate">{level.title}</h2>
          </div>
          <p className="text-white/60 text-[12px] mt-0.5 tabular-nums">{xp.toLocaleString()} XP</p>
        </div>
      </div>

      {/* 다음 레벨 진행 바 */}
      <div className="relative mt-4">
        <div className="flex justify-between text-[11px] text-white/60 mb-1.5">
          <span>{next ? `${next.emoji} ${next.title}까지` : '최고 레벨 달성 🎉'}</span>
          {next && <span className="tabular-nums font-semibold text-white/80">{(next.xp - xp).toLocaleString()} XP</span>}
        </div>
        <div className="h-2.5 bg-black/20 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${levelProgress * 100}%`, background: 'linear-gradient(90deg, #FDE68A, #FBBF24)' }} />
        </div>
      </div>

      {/* 스트릭 + 페이지 요약 */}
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <div className="bg-white/10 rounded-2xl py-2.5 text-center">
          <p className="text-[19px] font-extrabold leading-none">🔥 {streak}</p>
          <p className="text-white/60 text-[10px] mt-1">연속 독서</p>
        </div>
        <div className="bg-white/10 rounded-2xl py-2.5 text-center">
          <p className="text-[19px] font-extrabold leading-none">{done.length}</p>
          <p className="text-white/60 text-[10px] mt-1">완독</p>
        </div>
        <div className="bg-white/10 rounded-2xl py-2.5 text-center">
          <p className="text-[19px] font-extrabold leading-none tabular-nums">{(totalPages / 1000).toFixed(1)}k</p>
          <p className="text-white/60 text-[10px] mt-1">읽은 쪽</p>
        </div>
      </div>

      {/* 업적 배지 */}
      <div className="relative mt-5">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[13px] font-bold text-white/90">업적</p>
          <p className="text-[11px] font-semibold text-white/60">{earnedCount}/{badges.length}</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {badges.map((b) => (
            <div key={b.label} title={b.desc}
              className="rounded-2xl py-2.5 px-1 flex flex-col items-center gap-1 transition-all"
              style={{
                background: b.earned ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)',
                boxShadow: b.earned ? 'inset 0 0 0 1px rgba(255,255,255,0.25)' : 'none',
              }}>
              <span className="text-2xl leading-none" style={{ filter: b.earned ? 'none' : 'grayscale(1)', opacity: b.earned ? 1 : 0.35 }}>{b.emoji}</span>
              <span className={`text-[9.5px] font-semibold leading-tight text-center ${b.earned ? 'text-white' : 'text-white/40'}`}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
