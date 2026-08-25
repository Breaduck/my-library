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

  // ── 업적 계산용 집계 ──────────────────────────────────────────
  const doneCount = done.length;
  const reviewsCount = books.filter((b) => (b.review ?? '').trim().length > 0).length;
  const quotesCount = books.reduce((s, b) => s + (b.quotes?.length ?? 0), 0);
  const postitsCount = books.reduce((s, b) => s + (b.postits?.length ?? 0), 0);
  const fiveStarCount = done.filter((b) => b.rating >= 5).length;
  const genreCount = new Set(books.filter((b) => (b.genre ?? '').trim()).map((b) => b.genre)).size;
  const readingHours = books.reduce((s, b) => s + (b.totalReadingTime ?? 0), 0) / 3600;
  const brickBook = done.some((b) => (b.pages ?? 0) >= 500);
  const hugeBrick = done.some((b) => (b.pages ?? 0) >= 800);
  const readDays = new Set(dailyReadings.map((r) => r.date)).size;
  const wantCount = books.filter((b) => b.status === 'want').length;
  const readingCount = books.filter((b) => b.status === 'reading').length;

  // 업적 배지 (~50종) — tone: 메달 링 색. earned=획득 조건
  const badges = [
    // ── 완독 여정 ──
    { emoji: '🎬', label: '첫 걸음',    desc: '첫 책 완독',    tone: 'gold',   blurb: '첫 책을 끝까지 읽어냈어요. 모든 여정의 시작!',          earned: doneCount >= 1 },
    { emoji: '📗', label: '세 권째',    desc: '3권 완독',      tone: 'green',  blurb: '벌써 세 권! 책장이 채워지기 시작했어요.',              earned: doneCount >= 3 },
    { emoji: '📚', label: '다섯 권',    desc: '5권 완독',      tone: 'green',  blurb: '다섯 권 완독. 꾸준함이 눈에 보여요.',                  earned: doneCount >= 5 },
    { emoji: '🗂️', label: '책장 채우기', desc: '10권 완독',     tone: 'blue',   blurb: '10권을 완독했어요. 나만의 서재가 자라나요.',           earned: doneCount >= 10 },
    { emoji: '🏅', label: '스무 권',    desc: '20권 완독',     tone: 'amber',  blurb: '20권 돌파! 이제 독서가 취미를 넘어섰어요.',            earned: doneCount >= 20 },
    { emoji: '🏆', label: '다독가',     desc: '25권 완독',     tone: 'gold',   blurb: '25권 완독! 소문난 다독가로 등극.',                    earned: doneCount >= 25 },
    { emoji: '🎖️', label: '서른다섯',   desc: '35권 완독',     tone: 'amber',  blurb: '35권. 책과 함께한 시간이 켜켜이 쌓였어요.',            earned: doneCount >= 35 },
    { emoji: '💎', label: '다독왕',     desc: '50권 완독',     tone: 'cyan',   blurb: '50권 완독. 진정한 다독왕의 반열에.',                  earned: doneCount >= 50 },
    { emoji: '👑', label: '독서 군주',   desc: '75권 완독',     tone: 'purple', blurb: '75권! 웬만한 책은 다 읽어본 경지.',                   earned: doneCount >= 75 },
    { emoji: '🌌', label: '백 권의 우주', desc: '100권 완독',    tone: 'indigo', blurb: '100권 완독. 책으로 하나의 우주를 지었어요.',          earned: doneCount >= 100 },

    // ── 연속 독서(스트릭) ──
    { emoji: '🌱', label: '이틀째',     desc: '2일 연속 독서',  tone: 'green',  blurb: '이틀 연속! 습관의 씨앗이 트고 있어요.',                earned: streak >= 2 },
    { emoji: '🔥', label: '3일 연속',    desc: '3일 연속 독서',  tone: 'flame',  blurb: '3일 내리 책을 폈어요. 불이 붙었어요.',                earned: streak >= 3 },
    { emoji: '⚡', label: '일주일',     desc: '7일 연속 독서',  tone: 'flame',  blurb: '일주일 내내 독서! 멈출 수 없는 흐름.',                earned: streak >= 7 },
    { emoji: '🌠', label: '보름',       desc: '14일 연속 독서', tone: 'amber',  blurb: '14일 연속. 독서가 하루의 리듬이 됐어요.',              earned: streak >= 14 },
    { emoji: '🌟', label: '한 달 연속',  desc: '30일 연속 독서', tone: 'amber',  blurb: '30일 연속! 독서가 삶의 일부가 되었어요.',              earned: streak >= 30 },
    { emoji: '☄️', label: '쉰 날',      desc: '50일 연속 독서', tone: 'purple', blurb: '50일 연속. 웬만해선 안 끊기는 강철 습관.',            earned: streak >= 50 },
    { emoji: '🪐', label: '백일 정진',   desc: '100일 연속 독서', tone: 'indigo', blurb: '100일 연속! 경이로운 꾸준함이에요.',                  earned: streak >= 100 },

    // ── 주간 습관 ──
    { emoji: '✨', label: '완벽한 한 주', desc: '이번 주 7일 독서', tone: 'purple', blurb: '이번 주 7일 모두 책을 폈어요. 완벽한 한 주!',          earned: perfectWeek },
    { emoji: '📅', label: '성실한 주',   desc: '한 주 5일 독서',  tone: 'blue',   blurb: '이번 주 닷새나 읽었어요. 훌륭한 페이스!',              earned: weekReadCount >= 5 },
    { emoji: '🗓️', label: '한 달 개근',  desc: '누적 30일 독서', tone: 'green',  blurb: '기록한 독서일이 30일! 성실함의 증거예요.',             earned: readDays >= 30 },
    { emoji: '📆', label: '백일의 기록',  desc: '누적 100일 독서', tone: 'cyan',   blurb: '독서한 날이 100일. 시간이 만든 두께.',                earned: readDays >= 100 },

    // ── 누적 페이지 ──
    { emoji: '📄', label: '오백 쪽',    desc: '누적 500쪽',    tone: 'green',  blurb: '누적 500쪽. 손끝에 페이지가 익어가요.',               earned: totalPages >= 500 },
    { emoji: '📜', label: '천 페이지',   desc: '누적 1,000쪽',  tone: 'blue',   blurb: '누적 1,000쪽 돌파! 종이의 무게가 느껴지나요?',         earned: totalPages >= 1000 },
    { emoji: '📰', label: '삼천 쪽',    desc: '누적 3,000쪽',  tone: 'blue',   blurb: '누적 3,000쪽. 문장 사이를 부지런히 걸어왔어요.',       earned: totalPages >= 3000 },
    { emoji: '🌊', label: '오천 페이지', desc: '누적 5,000쪽',  tone: 'cyan',   blurb: '누적 5,000쪽. 페이지의 바다를 헤엄쳤어요.',            earned: totalPages >= 5000 },
    { emoji: '🌙', label: '만 페이지',   desc: '누적 10,000쪽', tone: 'indigo', blurb: '누적 10,000쪽. 밤을 잊고 읽어 내려간 독서가.',        earned: totalPages >= 10000 },
    { emoji: '🏔️', label: '이만 페이지', desc: '누적 20,000쪽', tone: 'purple', blurb: '누적 20,000쪽. 종이의 산맥을 넘었어요.',              earned: totalPages >= 20000 },

    // ── 타이머(집중 독서 시간) ──
    { emoji: '⏱️', label: '첫 한 시간',  desc: '타이머 1시간',   tone: 'blue',   blurb: '타이머로 1시간을 채웠어요. 몰입의 첫 맛.',            earned: readingHours >= 1 },
    { emoji: '⏳', label: '다섯 시간',   desc: '타이머 5시간',   tone: 'cyan',   blurb: '집중 독서 5시간. 시간을 잊는 재미를 알았어요.',         earned: readingHours >= 5 },
    { emoji: '🕰️', label: '열 시간',    desc: '타이머 10시간',  tone: 'amber',  blurb: '누적 10시간 몰입. 깊이 빠져드는 힘.',                 earned: readingHours >= 10 },
    { emoji: '🌗', label: '스물다섯 시간', desc: '타이머 25시간', tone: 'purple', blurb: '25시간을 책과 함께. 대단한 집중력이에요.',            earned: readingHours >= 25 },
    { emoji: '🌘', label: '쉰 시간',    desc: '타이머 50시간',  tone: 'indigo', blurb: '누적 50시간 몰입 독서. 경지에 올랐어요.',             earned: readingHours >= 50 },
    { emoji: '🌑', label: '백 시간의 몰입', desc: '타이머 100시간', tone: 'indigo', blurb: '100시간! 시간으로 증명한 독서 사랑.',                 earned: readingHours >= 100 },

    // ── 별점 · 리뷰 ──
    { emoji: '⭐', label: '첫 별점',    desc: '별점 남기기',    tone: 'amber',  blurb: '첫 별점을 남겼어요. 취향이 기록되기 시작.',            earned: rated.length >= 1 },
    { emoji: '🌟', label: '별점 수집가', desc: '별점 10권',     tone: 'amber',  blurb: '10권에 별점을. 나만의 평가 기준이 생겼어요.',          earned: rated.length >= 10 },
    { emoji: '💫', label: '별점 마스터', desc: '별점 25권',     tone: 'gold',   blurb: '25권 별점! 웬만한 평론가 부럽지 않아요.',             earned: rated.length >= 25 },
    { emoji: '🏵️', label: '인생책',     desc: '5점 만점 1권',  tone: 'gold',   blurb: '별 다섯을 준 인생책을 만났어요.',                     earned: fiveStarCount >= 1 },
    { emoji: '💛', label: '최애 컬렉션', desc: '5점 만점 5권',  tone: 'gold',   blurb: '만점 책이 다섯 권. 취향이 확고해요.',                 earned: fiveStarCount >= 5 },
    { emoji: '✍️', label: '첫 리뷰',    desc: '감상평 작성',    tone: 'blue',   blurb: '첫 감상평을 남겼어요. 생각을 글로 붙잡았어요.',         earned: reviewsCount >= 1 },
    { emoji: '📝', label: '리뷰어',     desc: '감상평 10편',    tone: 'blue',   blurb: '감상평 10편! 읽고 쓰는 사람이 됐어요.',               earned: reviewsCount >= 10 },
    { emoji: '🖋️', label: '기록가',     desc: '감상평 25편',    tone: 'indigo', blurb: '25편의 감상평. 당신의 독서는 곧 아카이브.',           earned: reviewsCount >= 25 },

    // ── 문장 수집 · 메모 ──
    { emoji: '💬', label: '첫 문장',    desc: '인상 문장 저장',  tone: 'cyan',   blurb: '마음에 남은 문장을 처음 담았어요.',                   earned: quotesCount >= 1 },
    { emoji: '📌', label: '문장 수집가', desc: '문장 10개',     tone: 'cyan',   blurb: '문장 10개 수집. 밑줄의 즐거움을 알았어요.',            earned: quotesCount >= 10 },
    { emoji: '🗃️', label: '문장 창고',   desc: '문장 50개',     tone: 'purple', blurb: '문장 50개! 나만의 명문장 보관소가 생겼어요.',         earned: quotesCount >= 50 },
    { emoji: '🗒️', label: '메모광',     desc: '포스트잇 10개',  tone: 'amber',  blurb: '포스트잇 10장. 여백까지 알뜰히 쓰는 독서가.',          earned: postitsCount >= 10 },

    // ── 다양성 · 특별 ──
    { emoji: '🎭', label: '장르 탐험가', desc: '3개 장르',      tone: 'purple', blurb: '세 가지 장르를 넘나들었어요. 편식 없는 독서.',         earned: genreCount >= 3 },
    { emoji: '🧭', label: '전방위 독서', desc: '5개 장르',      tone: 'indigo', blurb: '다섯 장르 정복. 어디로든 떠나는 독서가.',             earned: genreCount >= 5 },
    { emoji: '🧱', label: '벽돌책',     desc: '500쪽 책 완독',  tone: 'gold',   blurb: '500쪽 넘는 책을 끝냈어요. 두께에 굴하지 않아요.',       earned: brickBook },
    { emoji: '🏗️', label: '대작 정복',   desc: '800쪽 책 완독',  tone: 'amber',  blurb: '800쪽 대작을 완독! 존경스러운 끈기.',                 earned: hugeBrick },
    { emoji: '📖', label: '동시 독서',   desc: '3권 동시에 읽기', tone: 'blue',   blurb: '세 권을 동시에! 상황 따라 골라 읽는 재미.',            earned: readingCount >= 3 },
    { emoji: '🛒', label: '읽고 싶은 게 많아', desc: '읽을 예정 10권', tone: 'green', blurb: '위시리스트 10권. 설렘이 쌓여가요.',                   earned: wantCount >= 10 },
  ];
  type Badge = typeof badges[number];
  const earnedCount = badges.filter((b) => b.earned).length;
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [showLevels, setShowLevels] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);

  // 미리보기: 획득한 배지를 앞에, 그다음 잠긴 배지 순으로 최대 7개 + '더보기' 타일
  const orderedBadges = [...badges].sort((a, b) => Number(b.earned) - Number(a.earned));
  const previewBadges = orderedBadges.slice(0, 7);

  const badgeButton = (b: Badge) => (
    <button key={b.label} onClick={() => setSelectedBadge(b)}
      className="flex flex-col items-center gap-1.5 transition-transform active:scale-90">
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
  );

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

      {/* 레벨 헤더 — 누르면 전체 등급표 */}
      <button onClick={() => setShowLevels(true)}
        className="relative flex items-center gap-3.5 w-full text-left active:scale-[0.99] transition-transform">
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
        <span className="flex-shrink-0 flex items-center gap-0.5 text-[11px] font-semibold text-[#8E8E93]">
          등급표
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </span>
      </button>

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

      {/* 업적 배지 — 미리보기 7개 + 더보기(전체 모달) */}
      <div className="relative mt-5">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[13px] font-bold text-[#1D1D1F]">업적</p>
          <button onClick={() => setShowAllBadges(true)} className="text-[11px] font-semibold text-[#3B7DE8] active:opacity-60 transition-opacity">
            {earnedCount}/{badges.length} · 전체보기
          </button>
        </div>
        <div className="grid grid-cols-4 gap-y-3 gap-x-2">
          {previewBadges.map((b) => badgeButton(b))}
          {/* 더보기 타일 */}
          <button onClick={() => setShowAllBadges(true)}
            className="flex flex-col items-center gap-1.5 transition-transform active:scale-90">
            <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.6)', border: '1px dashed rgba(0,0,0,0.18)' }}>
              <span className="text-[18px] font-bold text-[#8E8E93] leading-none">+{badges.length - previewBadges.length}</span>
            </div>
            <span className="text-[9.5px] font-semibold leading-tight text-center text-[#6E6E73]">더보기</span>
          </button>
        </div>
      </div>

      {/* 전체 업적 모달 */}
      {showAllBadges && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={(e) => e.target === e.currentTarget && setShowAllBadges(false)}>
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
            style={{ maxHeight: '85vh', boxShadow: '0 24px 64px rgba(0,0,0,0.28)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" />
            <div className="px-6 pt-3 pb-3 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-[17px] font-extrabold text-[#1D1D1F] tracking-tight">전체 업적</h3>
                <p className="text-[12px] text-[#8E8E93] mt-0.5">{earnedCount}개 획득 · 전체 {badges.length}개</p>
              </div>
              <button onClick={() => setShowAllBadges(false)} aria-label="닫기"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F5F5F7] text-[#6E6E73] hover:bg-gray-200 transition-colors flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* 진행 바 */}
            <div className="px-6 pb-3 flex-shrink-0">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((earnedCount / badges.length) * 100)}%`, background: 'linear-gradient(90deg,#FBBF24,#F59E0B)' }} />
              </div>
            </div>
            <div className="px-4 pb-4 overflow-y-auto">
              <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                {badges.map((b) => badgeButton(b))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 전체 등급표 — 내 현재 단계 + 앞으로 남은 등급 */}
      {showLevels && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={(e) => e.target === e.currentTarget && setShowLevels(false)}>
          <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
            style={{ maxHeight: '82vh', boxShadow: '0 24px 64px rgba(0,0,0,0.28)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" />
            <div className="px-6 pt-3 pb-3 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-[17px] font-extrabold text-[#1D1D1F] tracking-tight">독서 등급표</h3>
                <p className="text-[12px] text-[#8E8E93] mt-0.5">전체 {LEVELS.length}단계 · 현재 LV.{levelIdx + 1} {level.title}</p>
              </div>
              <button onClick={() => setShowLevels(false)} aria-label="닫기"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F5F5F7] text-[#6E6E73] hover:bg-gray-200 transition-colors flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-4 pb-4 overflow-y-auto">
              {LEVELS.map((lv, i) => {
                const isCurrent = i === levelIdx;
                const achieved = i < levelIdx;
                const nextLv = LEVELS[i + 1];
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl mb-1.5"
                    style={{
                      background: isCurrent ? 'linear-gradient(135deg, rgba(129,140,248,0.16), rgba(56,189,248,0.12))' : 'transparent',
                      border: isCurrent ? '1px solid rgba(129,140,248,0.4)' : '1px solid transparent',
                    }}>
                    {/* 엠블럼 */}
                    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 relative"
                      style={{
                        background: achieved || isCurrent ? 'radial-gradient(circle at 30% 25%, #FDE68A, #F59E0B)' : '#EEEEF2',
                        boxShadow: isCurrent ? '0 4px 14px rgba(245,158,11,0.4)' : 'none',
                      }}>
                      <span className="text-[22px] leading-none" style={{ filter: achieved || isCurrent ? 'none' : 'grayscale(1)', opacity: achieved || isCurrent ? 1 : 0.45 }}>{lv.emoji}</span>
                      {achieved && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                          <svg className="w-2.5 h-2.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" /></svg>
                        </span>
                      )}
                    </div>
                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold tracking-wide ${isCurrent ? 'text-[#6366F1]' : 'text-[#AEAEB2]'}`}>LV.{i + 1}</span>
                        <p className={`text-[14px] font-bold truncate ${achieved || isCurrent ? 'text-[#1D1D1F]' : 'text-[#AEAEB2]'}`}>{lv.title}</p>
                      </div>
                      <p className="text-[11px] text-[#8E8E93] mt-0.5 tabular-nums">
                        {nextLv ? `${lv.xp.toLocaleString()} ~ ${(nextLv.xp - 1).toLocaleString()} XP` : `${lv.xp.toLocaleString()} XP +`}
                      </p>
                    </div>
                    {/* 우측 상태 */}
                    <div className="flex-shrink-0 text-right">
                      {isCurrent ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#818CF8,#38BDF8)' }}>현재</span>
                      ) : achieved ? (
                        <span className="text-[10px] font-semibold text-emerald-500">달성</span>
                      ) : (
                        <span className="text-[10px] font-semibold text-[#C7C7CC] tabular-nums">-{(lv.xp - xp).toLocaleString()} XP</span>
                      )}
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-[#AEAEB2] text-center mt-2 leading-relaxed px-4">
                XP는 읽은 페이지 1쪽 = 1XP, 완독 1권 = 100XP로 쌓여요.
              </p>
            </div>
          </div>
        </div>
      )}

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
