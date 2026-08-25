import { useState, useEffect } from 'react';
import { Book } from '@/types';
import { DailyReading, localDate } from '@/lib/storage';
import { checkLevelUp, LEVELUP_BONUS } from '@/lib/game';

const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 업적 메달 링 색 (당근 배지 느낌)
const TONE_GRADIENTS: Record<string, string> = {
  gold:   'linear-gradient(140deg, #FDE68A, #F59E0B)',
  flame:  'linear-gradient(140deg, #FDBA74, #EF4444)',
  green:  'linear-gradient(140deg, #86EFAC, #16A34A)',
  blue:   'linear-gradient(140deg, #93C5FD, #2563EB)',
  cyan:   'linear-gradient(140deg, #A5F3FC, #0891B2)',
  purple: 'linear-gradient(140deg, #C4B5FD, #7C3AED)',
  indigo: 'linear-gradient(140deg, #A5B4FC, #4338CA)',
  amber:  'linear-gradient(140deg, #FCD34D, #D97706)',
};

interface Props {
  books: Book[];
  dailyReadings: DailyReading[];
  streak: number;
  freezes?: number; // 연속 독서 보호막 개수
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

export default function GamificationCard({ books, dailyReadings, streak, freezes = 0 }: Props) {
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

  // 오늘 / 이번 주 독서
  const todayStr = localDate();
  const todayPages = dailyReadings.filter((r) => r.date === todayStr).reduce((s, r) => s + r.pages, 0);
  // 이번 주(일~토) 고정 배치 — 오늘 강조, 아직 안 온 날은 흐리게
  const weekDays = (() => {
    const now = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    const out: { label: string; read: boolean; isToday: boolean; isFuture: boolean; pages: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const ds = localDate(d);
      const pages = dailyReadings.filter((r) => r.date === ds).reduce((s, r) => s + r.pages, 0);
      out.push({ label: WEEK_LABELS[i], read: pages > 0, isToday: ds === todayStr, isFuture: ds > todayStr, pages });
    }
    return out;
  })();
  const weekReadCount = weekDays.filter((d) => d.read).length;
  const perfectWeek = weekReadCount === 7;

  // 업적 배지 (12종) — tone: 메달 링 색
  const badges = [
    { emoji: '🎬', label: '첫 걸음',   desc: '첫 책 완독',       tone: 'gold',   blurb: '첫 책을 끝까지 읽어냈어요. 모든 여정의 시작!',        earned: done.length >= 1 },
    { emoji: '🔥', label: '3일 연속',  desc: '3일 연속 독서',     tone: 'flame',  blurb: '3일 내리 책을 펼쳤어요. 습관이 붙는 중이에요.',        earned: streak >= 3 },
    { emoji: '⚡', label: '일주일',    desc: '7일 연속 독서',     tone: 'flame',  blurb: '일주일 내내 독서! 이제 멈출 수 없는 흐름이에요.',       earned: streak >= 7 },
    { emoji: '🌟', label: '한 달 연속', desc: '30일 연속 독서',    tone: 'amber',  blurb: '30일 연속! 독서가 삶의 일부가 되었어요.',            earned: streak >= 30 },
    { emoji: '✨', label: '완벽한 한 주', desc: '이번 주 7일 독서',  tone: 'purple', blurb: '이번 주 7일 모두 책을 폈어요. 완벽한 한 주!',          earned: perfectWeek },
    { emoji: '📗', label: '책장 채우기', desc: '10권 완독',        tone: 'green',  blurb: '10권을 완독했어요. 책장이 차곡차곡 채워지는 중.',      earned: done.length >= 10 },
    { emoji: '🏆', label: '다독가',    desc: '25권 완독',        tone: 'gold',   blurb: '25권 완독! 당신은 이미 소문난 다독가예요.',          earned: done.length >= 25 },
    { emoji: '💎', label: '다독왕',    desc: '50권 완독',        tone: 'cyan',   blurb: '50권 완독. 진정한 다독왕의 반열에 올랐어요.',         earned: done.length >= 50 },
    { emoji: '⭐', label: '평론가',    desc: '별점 5권 이상',     tone: 'amber',  blurb: '5권에 별점을 남긴 진정한 리뷰어가 되었어요.',          earned: rated.length >= 5 },
    { emoji: '📜', label: '천 페이지',  desc: '누적 1,000쪽',     tone: 'blue',   blurb: '누적 1,000쪽 돌파! 종이의 무게가 느껴지나요?',        earned: totalPages >= 1000 },
    { emoji: '🌊', label: '오천 페이지', desc: '누적 5,000쪽',     tone: 'cyan',   blurb: '누적 5,000쪽. 페이지의 바다를 헤엄쳐 왔어요.',        earned: totalPages >= 5000 },
    { emoji: '🌙', label: '만 페이지',  desc: '누적 10,000쪽',    tone: 'indigo', blurb: '누적 10,000쪽. 밤을 잊고 읽어 내려간 독서가.',        earned: totalPages >= 10000 },
  ];
  type Badge = typeof badges[number];
  const earnedCount = badges.filter((b) => b.earned).length;
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  // 레벨업 축하 — 처음 도달한 레벨이면 1회 연출(+보석 보너스)
  const [showLevelUp, setShowLevelUp] = useState(false);
  useEffect(() => {
    if (checkLevelUp(levelIdx) != null) setShowLevelUp(true);
  }, [levelIdx]);

  // 오늘의 목표 (하루 페이지 목표)
  const [dailyGoal, setDailyGoal] = useState(30);
  const [editingDaily, setEditingDaily] = useState(false);
  const [dailyInput, setDailyInput] = useState('30');
  useEffect(() => {
    const s = localStorage.getItem('daily-page-goal');
    if (s) { setDailyGoal(parseInt(s)); setDailyInput(s); }
  }, []);
  function saveDaily() {
    const n = Math.max(1, Math.min(999, parseInt(dailyInput) || 30));
    setDailyGoal(n); setDailyInput(String(n));
    localStorage.setItem('daily-page-goal', String(n));
    setEditingDaily(false);
  }
  const dailyProgress = Math.min(todayPages / dailyGoal, 1);
  const DR = 26, DC = 2 * Math.PI * DR;

  return (
    <div className="rounded-3xl p-5 sm:p-6 mb-4 text-[#1D1D1F] relative overflow-hidden"
      style={{
        background: 'radial-gradient(120% 90% at 0% 0%, rgba(129,140,248,0.20), transparent 46%), radial-gradient(110% 85% at 100% 0%, rgba(56,189,248,0.18), transparent 46%), radial-gradient(120% 100% at 55% 120%, rgba(236,72,153,0.12), transparent 52%), rgba(255,255,255,0.72)',
        backdropFilter: 'blur(22px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.7)',
        border: '1px solid rgba(255,255,255,0.85)',
        boxShadow: '0 8px 32px rgba(80,90,130,0.14), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}>
      {/* 상단 광택 하이라이트 */}
      <div className="absolute -top-16 left-0 right-0 h-40 pointer-events-none" style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, transparent 100%)',
      }} />

      {/* 레벨 헤더 */}
      <div className="relative flex items-center gap-3.5">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 12px rgba(80,90,130,0.12)' }}>
          <span className="text-3xl leading-none">{level.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-bold text-[#8E8E93] tracking-wide">LV.{levelIdx + 1}</span>
            <h2 className="text-[19px] font-extrabold tracking-tight truncate text-[#1D1D1F]">{level.title}</h2>
          </div>
          <p className="text-[#6E6E73] text-[12px] mt-0.5 tabular-nums font-medium">{xp.toLocaleString()} XP</p>
        </div>
      </div>

      {/* 다음 레벨 진행 바 */}
      <div className="relative mt-4">
        <div className="flex justify-between text-[11px] text-[#6E6E73] mb-1.5">
          <span>{next ? `${next.emoji} ${next.title}까지` : '최고 레벨 달성 🎉'}</span>
          {next && <span className="tabular-nums font-semibold text-[#1D1D1F]">{(next.xp - xp).toLocaleString()} XP</span>}
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${levelProgress * 100}%`, background: 'linear-gradient(90deg, #FBBF24, #F59E0B)' }} />
        </div>
      </div>

      {/* 오늘의 목표 링 */}
      <div className="relative mt-4 rounded-2xl p-3.5 flex items-center gap-4"
        style={{ background: 'rgba(255,255,255,0.62)', border: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="relative flex-shrink-0" style={{ width: 60, height: 60 }}>
          <svg width={60} height={60}>
            <circle cx={30} cy={30} r={DR} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={6} />
            <circle cx={30} cy={30} r={DR} fill="none" stroke={dailyProgress >= 1 ? '#10B981' : '#3B7DE8'} strokeWidth={6} strokeLinecap="round"
              strokeDasharray={DC} strokeDashoffset={DC * (1 - dailyProgress)} transform="rotate(-90 30 30)"
              style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg leading-none">{dailyProgress >= 1 ? '✅' : '📖'}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-[#8E8E93] font-medium">오늘의 목표</p>
          {editingDaily ? (
            <div className="flex items-center gap-2 mt-1">
              <input type="number" value={dailyInput} onChange={(e) => setDailyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveDaily()}
                className="w-16 px-2 py-1 rounded-lg bg-[#F0F0F5] text-[#1D1D1F] text-sm text-center outline-none focus:ring-2 focus:ring-[#3B7DE8]/40" autoFocus />
              <span className="text-[#8E8E93] text-xs">쪽</span>
              <button onClick={saveDaily} className="px-2.5 py-1 bg-[#1D1D1F] text-white rounded-lg text-xs font-bold">저장</button>
            </div>
          ) : (
            <>
              <p className="text-[17px] font-extrabold tabular-nums leading-tight text-[#1D1D1F]">
                {todayPages.toLocaleString()}<span className="text-[#AEAEB2] text-[13px] font-semibold"> / {dailyGoal}쪽</span>
              </p>
              <p className="text-[11px] text-[#6E6E73] mt-0.5">
                {dailyProgress >= 1 ? '🎉 오늘 목표 달성!' : `${dailyGoal - todayPages}쪽 더 읽으면 달성`}
                <button onClick={() => setEditingDaily(true)} className="ml-2 text-[#3B7DE8] font-semibold">수정</button>
              </p>
            </>
          )}
        </div>
      </div>

      {/* 이번 주 독서 */}
      <div className="relative mt-4">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[13px] font-bold text-[#1D1D1F]">이번 주 독서</p>
          <p className="text-[11px] font-semibold text-[#6E6E73]">{weekReadCount}/7일</p>
        </div>
        <div className="flex items-center justify-between">
          {weekDays.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5" style={{ opacity: d.isFuture ? 0.4 : 1 }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: d.read ? 'linear-gradient(135deg,#38BDF8,#3B7DE8)' : d.isToday ? 'rgba(59,125,232,0.10)' : 'rgba(0,0,0,0.05)',
                  border: d.isToday ? '2px solid rgba(59,125,232,0.7)' : '1px solid rgba(0,0,0,0.06)',
                  boxShadow: d.read ? '0 3px 10px rgba(59,125,232,0.28)' : 'none',
                }}>
                {d.read ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <span className="text-[13px] font-bold leading-none" style={{ color: d.isToday ? '#3B7DE8' : '#C7C7CC' }}>·</span>
                )}
              </div>
              <span className="text-[10px] font-semibold" style={{ color: d.isToday ? '#3B7DE8' : '#AEAEB2' }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 연속 보호막(스트릭 프리즈) — 하루 빠져도 기록을 지켜준다 */}
      <div className="relative mt-4 rounded-2xl px-3.5 py-3 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.14), rgba(59,125,232,0.10))', border: '1px solid rgba(59,125,232,0.15)' }}>
        <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg"
          style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.05)' }}>❄️</div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#1D1D1F] leading-tight">
            연속 보호막 {freezes > 0 ? `${freezes}개 보유` : '없음'}
          </p>
          <p className="text-[11px] text-[#6E6E73] mt-0.5 leading-snug">
            {freezes > 0
              ? '하루 빠뜨려도 연속 기록이 끊기지 않아요. 5일 연속마다 1개씩 쌓여요.'
              : '5일 연속 읽으면 보호막이 생겨요. 하루쯤 놓쳐도 안심!'}
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {[0, 1].map((i) => (
            <span key={i} className="text-[15px] leading-none" style={{ opacity: i < freezes ? 1 : 0.25, filter: i < freezes ? 'none' : 'grayscale(1)' }}>❄️</span>
          ))}
        </div>
      </div>

      {/* 스트릭 + 페이지 요약 */}
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        {[
          { v: `🔥 ${streak}`, l: '연속 독서' },
          { v: `${done.length}`, l: '완독' },
          { v: totalPages.toLocaleString(), l: '읽은 쪽' },
        ].map((t) => (
          <div key={t.l} className="rounded-2xl py-2.5 text-center" style={{ background: 'rgba(255,255,255,0.62)', border: '1px solid rgba(0,0,0,0.05)' }}>
            <p className="text-[18px] font-extrabold leading-none tabular-nums text-[#1D1D1F]">{t.v}</p>
            <p className="text-[#8E8E93] text-[10px] mt-1 font-medium">{t.l}</p>
          </div>
        ))}
      </div>

      {/* 업적 배지 */}
      <div className="relative mt-5">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[13px] font-bold text-[#1D1D1F]">업적</p>
          <p className="text-[11px] font-semibold text-[#6E6E73]">{earnedCount}/{badges.length}</p>
        </div>
        <div className="grid grid-cols-4 gap-y-3 gap-x-2">
          {badges.map((b) => (
            <button key={b.label} onClick={() => setSelectedBadge(b)}
              className="flex flex-col items-center gap-1.5 transition-transform active:scale-90">
              {/* 동그란 메달 */}
              <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center relative"
                style={{
                  background: b.earned ? TONE_GRADIENTS[b.tone] ?? TONE_GRADIENTS.gold : '#EAEAEF',
                  boxShadow: b.earned
                    ? 'inset 0 2px 4px rgba(255,255,255,0.55), inset 0 -2px 5px rgba(0,0,0,0.12), 0 5px 12px rgba(80,90,130,0.22)'
                    : 'inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -1px 3px rgba(0,0,0,0.06)',
                }}>
                <span className="text-[26px] leading-none" style={{ filter: b.earned ? 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' : 'grayscale(1)', opacity: b.earned ? 1 : 0.45 }}>{b.emoji}</span>
                {b.earned && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                    <svg className="w-2.5 h-2.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" /></svg>
                  </span>
                )}
              </div>
              <span className={`text-[9.5px] font-semibold leading-tight text-center ${b.earned ? 'text-[#1D1D1F]' : 'text-[#AEAEB2]'}`}>{b.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 레벨업 축하 연출 */}
      {showLevelUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={() => setShowLevelUp(false)}>
          <style>{`
            @keyframes lvPop{0%{transform:scale(0.6);opacity:0}60%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}
            @keyframes lvRay{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
            @keyframes lvConfetti{0%{transform:translateY(-10px) rotate(0deg);opacity:1}100%{transform:translateY(120px) rotate(300deg);opacity:0}}
          `}</style>
          <div className="w-full max-w-[320px] rounded-3xl p-8 text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(160deg,#FFFBEB,#FEF3C7)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', animation: 'lvPop 0.35s ease-out' }}
            onClick={(e) => e.stopPropagation()}>
            {/* 빛살 */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 pointer-events-none opacity-30"
              style={{ background: 'conic-gradient(from 0deg, transparent 0deg, #FBBF24 15deg, transparent 30deg, transparent 45deg, #FBBF24 60deg, transparent 75deg, transparent 90deg, #FBBF24 105deg, transparent 120deg, transparent 135deg, #FBBF24 150deg, transparent 165deg, transparent 180deg, #FBBF24 195deg, transparent 210deg, transparent 225deg, #FBBF24 240deg, transparent 255deg, transparent 270deg, #FBBF24 285deg, transparent 300deg, transparent 315deg, #FBBF24 330deg, transparent 345deg)', animation: 'lvRay 14s linear infinite' }} />
            {/* 색종이 */}
            {['🎉', '✨', '🎊', '⭐', '✨', '🎉'].map((c, i) => (
              <span key={i} className="absolute text-lg pointer-events-none"
                style={{ left: `${10 + i * 15}%`, top: 12, animation: `lvConfetti ${1.2 + (i % 3) * 0.4}s ease-in ${i * 0.15}s infinite` }}>{c}</span>
            ))}
            <p className="relative text-[12px] font-bold text-amber-600 tracking-[0.2em] uppercase mb-2">Level Up!</p>
            <div className="relative mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'radial-gradient(circle at 30% 25%, #FDE68A 0%, #F59E0B 60%, #B45309 100%)', boxShadow: '0 12px 32px rgba(245,158,11,0.45)' }}>
              <span className="text-5xl leading-none">{level.emoji}</span>
            </div>
            <h3 className="relative text-[22px] font-extrabold text-[#1D1D1F] tracking-tight">LV.{levelIdx + 1} {level.title}</h3>
            <p className="relative text-[13px] text-[#92700C] mt-2 font-semibold">보너스 💎 {LEVELUP_BONUS} 획득!</p>
            <button onClick={() => setShowLevelUp(false)}
              className="relative mt-6 w-full py-3 rounded-2xl bg-[#1D1D1F] text-white text-sm font-bold active:scale-[0.98] transition-transform">
              계속 읽기
            </button>
          </div>
        </div>
      )}

      {/* 배지 상세 팝업 카드 */}
      {selectedBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => setSelectedBadge(null)}>
          <div className="w-full max-w-[300px] rounded-3xl p-7 text-center relative animate-[pop_0.18s_ease-out]"
            style={{ background: '#fff', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}
            onClick={(e) => e.stopPropagation()}>
            <style>{`@keyframes pop{from{transform:scale(0.85);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
            {/* 닫기 */}
            <button onClick={() => setSelectedBadge(null)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-[#AEAEB2] hover:bg-[#F5F5F7] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            {/* 엠블럼 */}
            <div className="mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-4"
              style={{
                background: selectedBadge.earned
                  ? 'radial-gradient(circle at 30% 25%, #FDE68A 0%, #F59E0B 55%, #B45309 100%)'
                  : 'linear-gradient(135deg, #E5E5EA, #C7C7CC)',
                boxShadow: selectedBadge.earned ? '0 10px 28px rgba(245,158,11,0.4)' : '0 6px 18px rgba(0,0,0,0.12)',
              }}>
              <span className="text-5xl leading-none" style={{ filter: selectedBadge.earned ? 'none' : 'grayscale(1)', opacity: selectedBadge.earned ? 1 : 0.5 }}>
                {selectedBadge.emoji}
              </span>
            </div>
            <h3 className="text-[20px] font-extrabold text-[#1D1D1F] tracking-tight">{selectedBadge.label}</h3>
            <p className="text-[13.5px] text-[#6E6E73] mt-2 leading-relaxed">{selectedBadge.blurb}</p>
            {/* 상태 */}
            <div className="mt-5">
              {selectedBadge.earned ? (
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#34D399,#10B981)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  획득 완료!
                </span>
              ) : (
                <div className="inline-flex flex-col items-center gap-1 px-4 py-2 rounded-2xl bg-[#F5F5F7]">
                  <span className="text-[11px] font-semibold text-[#AEAEB2]">🔒 아직 잠김</span>
                  <span className="text-[12.5px] font-bold text-[#1D1D1F]">조건 · {selectedBadge.desc}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
