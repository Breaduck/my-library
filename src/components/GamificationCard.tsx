import { useState, useEffect } from 'react';
import { Book } from '@/types';
import { DailyReading } from '@/lib/storage';

const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

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

  // 오늘 / 이번 주 독서
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayPages = dailyReadings.filter((r) => r.date === todayStr).reduce((s, r) => s + r.pages, 0);
  const weekDays = (() => {
    const out: { label: string; read: boolean; isToday: boolean; pages: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const pages = dailyReadings.filter((r) => r.date === ds).reduce((s, r) => s + r.pages, 0);
      out.push({ label: WEEK_LABELS[d.getDay()], read: pages > 0, isToday: ds === todayStr, pages });
    }
    return out;
  })();
  const weekReadCount = weekDays.filter((d) => d.read).length;
  const perfectWeek = weekReadCount === 7;

  // 업적 배지 (12종)
  const badges = [
    { emoji: '🎬', label: '첫 걸음',   desc: '첫 책 완독',       blurb: '첫 책을 끝까지 읽어냈어요. 모든 여정의 시작!',        earned: done.length >= 1 },
    { emoji: '🔥', label: '3일 연속',  desc: '3일 연속 독서',     blurb: '3일 내리 책을 펼쳤어요. 습관이 붙는 중이에요.',        earned: streak >= 3 },
    { emoji: '⚡', label: '일주일',    desc: '7일 연속 독서',     blurb: '일주일 내내 독서! 이제 멈출 수 없는 흐름이에요.',       earned: streak >= 7 },
    { emoji: '🌟', label: '한 달 연속', desc: '30일 연속 독서',    blurb: '30일 연속! 독서가 삶의 일부가 되었어요.',            earned: streak >= 30 },
    { emoji: '✨', label: '완벽한 한 주', desc: '이번 주 7일 독서',  blurb: '이번 주 7일 모두 책을 폈어요. 완벽한 한 주!',          earned: perfectWeek },
    { emoji: '📗', label: '책장 채우기', desc: '10권 완독',        blurb: '10권을 완독했어요. 책장이 차곡차곡 채워지는 중.',      earned: done.length >= 10 },
    { emoji: '🏆', label: '다독가',    desc: '25권 완독',        blurb: '25권 완독! 당신은 이미 소문난 다독가예요.',          earned: done.length >= 25 },
    { emoji: '💎', label: '다독왕',    desc: '50권 완독',        blurb: '50권 완독. 진정한 다독왕의 반열에 올랐어요.',         earned: done.length >= 50 },
    { emoji: '⭐', label: '평론가',    desc: '별점 5권 이상',     blurb: '5권에 별점을 남긴 진정한 리뷰어가 되었어요.',          earned: rated.length >= 5 },
    { emoji: '📜', label: '천 페이지',  desc: '누적 1,000쪽',     blurb: '누적 1,000쪽 돌파! 종이의 무게가 느껴지나요?',        earned: totalPages >= 1000 },
    { emoji: '🌊', label: '오천 페이지', desc: '누적 5,000쪽',     blurb: '누적 5,000쪽. 페이지의 바다를 헤엄쳐 왔어요.',        earned: totalPages >= 5000 },
    { emoji: '🌙', label: '만 페이지',  desc: '누적 10,000쪽',    blurb: '누적 10,000쪽. 밤을 잊고 읽어 내려간 독서가.',        earned: totalPages >= 10000 },
  ];
  type Badge = typeof badges[number];
  const earnedCount = badges.filter((b) => b.earned).length;
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

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
    <div className="rounded-3xl p-5 sm:p-6 mb-4 text-white relative overflow-hidden"
      style={{
        background: 'rgba(17, 22, 38, 0.66)',
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 10px 40px rgba(15,20,40,0.28), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(255,255,255,0.05)',
      }}>
      {/* 유리 안쪽 컬러 글로우 (리퀴드 글래스) */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(120% 80% at 8% 0%, rgba(99,102,241,0.55) 0%, transparent 42%), radial-gradient(110% 80% at 100% 0%, rgba(34,211,238,0.40) 0%, transparent 42%), radial-gradient(130% 90% at 60% 120%, rgba(139,92,246,0.45) 0%, transparent 48%)',
      }} />
      {/* 상단 광택 하이라이트 */}
      <div className="absolute -top-16 left-0 right-0 h-40 pointer-events-none" style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.20) 0%, transparent 100%)',
      }} />

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

      {/* 오늘의 목표 링 */}
      <div className="relative mt-4 rounded-2xl p-3.5 flex items-center gap-4"
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="relative flex-shrink-0" style={{ width: 60, height: 60 }}>
          <svg width={60} height={60}>
            <circle cx={30} cy={30} r={DR} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={6} />
            <circle cx={30} cy={30} r={DR} fill="none" stroke={dailyProgress >= 1 ? '#34D399' : '#38BDF8'} strokeWidth={6} strokeLinecap="round"
              strokeDasharray={DC} strokeDashoffset={DC * (1 - dailyProgress)} transform="rotate(-90 30 30)"
              style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg leading-none">{dailyProgress >= 1 ? '✅' : '📖'}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-white/55">오늘의 목표</p>
          {editingDaily ? (
            <div className="flex items-center gap-2 mt-1">
              <input type="number" value={dailyInput} onChange={(e) => setDailyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveDaily()}
                className="w-16 px-2 py-1 rounded-lg bg-white/10 text-white text-sm text-center outline-none focus:ring-2 focus:ring-white/30" autoFocus />
              <span className="text-white/50 text-xs">쪽</span>
              <button onClick={saveDaily} className="px-2.5 py-1 bg-white text-[#111626] rounded-lg text-xs font-bold">저장</button>
            </div>
          ) : (
            <>
              <p className="text-[17px] font-extrabold tabular-nums leading-tight">
                {todayPages.toLocaleString()}<span className="text-white/45 text-[13px] font-semibold"> / {dailyGoal}쪽</span>
              </p>
              <p className="text-[11px] text-white/50 mt-0.5">
                {dailyProgress >= 1 ? '🎉 오늘 목표 달성!' : `${dailyGoal - todayPages}쪽 더 읽으면 달성`}
                <button onClick={() => setEditingDaily(true)} className="ml-2 text-white/70 font-semibold hover:text-white transition-colors">수정</button>
              </p>
            </>
          )}
        </div>
      </div>

      {/* 이번 주 독서 */}
      <div className="relative mt-4">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[13px] font-bold text-white/90">이번 주 독서</p>
          <p className="text-[11px] font-semibold text-white/60">{weekReadCount}/7일</p>
        </div>
        <div className="flex items-center justify-between">
          {weekDays.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: d.read ? 'linear-gradient(135deg,#38BDF8,#3B7DE8)' : 'rgba(255,255,255,0.07)',
                  border: d.isToday ? '2px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: d.read ? '0 3px 10px rgba(59,125,232,0.35)' : 'none',
                }}>
                {d.read ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <span className="text-white/25 text-[13px] font-bold leading-none">·</span>
                )}
              </div>
              <span className="text-[10px] font-semibold" style={{ color: d.isToday ? '#fff' : 'rgba(255,255,255,0.42)' }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 스트릭 + 페이지 요약 */}
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl py-2.5 text-center" style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <p className="text-[19px] font-extrabold leading-none">🔥 {streak}</p>
          <p className="text-white/60 text-[10px] mt-1">연속 독서</p>
        </div>
        <div className="rounded-2xl py-2.5 text-center" style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <p className="text-[19px] font-extrabold leading-none">{done.length}</p>
          <p className="text-white/60 text-[10px] mt-1">완독</p>
        </div>
        <div className="rounded-2xl py-2.5 text-center" style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <p className="text-[17px] font-extrabold leading-none tabular-nums">{totalPages.toLocaleString()}</p>
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
            <button key={b.label} onClick={() => setSelectedBadge(b)}
              className="rounded-2xl py-2.5 px-1 flex flex-col items-center gap-1 transition-all active:scale-95"
              style={{
                background: b.earned ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)',
                boxShadow: b.earned ? 'inset 0 0 0 1px rgba(255,255,255,0.25)' : 'none',
              }}>
              <span className="text-2xl leading-none" style={{ filter: b.earned ? 'none' : 'grayscale(1)', opacity: b.earned ? 1 : 0.35 }}>{b.emoji}</span>
              <span className={`text-[9.5px] font-semibold leading-tight text-center ${b.earned ? 'text-white' : 'text-white/40'}`}>{b.label}</span>
            </button>
          ))}
        </div>
      </div>

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
