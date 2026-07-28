import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { useBooks } from '@/hooks/useBooks';
import { Book } from '@/types';
import { getReadingStreak, getDailyReadings, setDailyPages, localDate } from '@/lib/storage';
import MonthlyShareCard from '@/components/MonthlyShareCard';
import GamificationCard from '@/components/GamificationCard';

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const WEEK_DAYS = ['일','월','화','수','목','금','토'];

function getYearMonth(dateStr: string): { year: number; month: number } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() };
}

function fmtTime(s: number): string | null {
  if (!s || s === 0) return null;
  if (s < 60) return `${s}초`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

export interface DayEntry { book: Book; done: boolean; pages: number }

// 그날의 독서 활동: 그날 읽은 책(일별 기록) + 그날 완독한 책을 모두 모은다.
function buildDayActivity(
  books: Book[],
  dailyReadings: { date: string; bookId?: string; pages: number }[],
  year: number,
  month: number,
): Record<number, DayEntry[]> {
  const map: Record<number, DayEntry[]> = {};
  const add = (day: number, book: Book, done: boolean, pages: number) => {
    const arr = (map[day] = map[day] || []);
    const found = arr.find((e) => e.book.id === book.id);
    if (found) { if (done) found.done = true; found.pages += pages; }
    else arr.push({ book, done, pages });
  };
  // 읽는중 등 — 그날 읽은 책 (일별 기록 기준, 페이지 포함)
  dailyReadings.forEach((r) => {
    if (!r.bookId) return;
    const [y, m, dd] = r.date.split('-').map(Number);
    if (y === year && m - 1 === month) {
      const book = books.find((b) => b.id === r.bookId);
      if (book) add(dd, book, false, r.pages);
    }
  });
  // 완독한 책 (완독일 기준)
  books.forEach((b) => {
    if (b.status !== 'done' || !b.endDate) return;
    const d = new Date(b.endDate);
    if (d.getFullYear() === year && d.getMonth() === month) add(d.getDate(), b, true, 0);
  });
  // 완독을 앞에 오도록 정렬 (대표 표지)
  Object.values(map).forEach((arr) => arr.sort((a, b) => Number(b.done) - Number(a.done)));
  return map;
}

export default function StatsPage() {
  const { books, loaded } = useBooks();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [goal, setGoal] = useState(12);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('12');
  const [monthlyGoal, setMonthlyGoal] = useState(2);
  const [editingMonthlyGoal, setEditingMonthlyGoal] = useState(false);
  const [monthlyGoalInput, setMonthlyGoalInput] = useState('2');
  const [goalView, setGoalView] = useState<'year' | 'month'>('year');
  const [pageView, setPageView] = useState<'year' | 'month'>('year');
  const [pagesExpanded, setPagesExpanded] = useState(false);
  const [monthlyMetric, setMonthlyMetric] = useState<'count' | 'pages'>('count');
  const [dailyRange, setDailyRange] = useState(14);
  const [gameMode, setGameMode] = useState(() => {
    try { return localStorage.getItem('game-mode') !== '0'; } catch { return true; }
  });
  function toggleGameMode() {
    setGameMode((v) => {
      const n = !v;
      try { localStorage.setItem('game-mode', n ? '1' : '0'); } catch { /* noop */ }
      return n;
    });
  }
  const [calDisplayYear, setCalDisplayYear] = useState(currentYear);
  const [calDisplayMonth, setCalDisplayMonth] = useState(currentMonth);
  const [calSelectedDay, setCalSelectedDay] = useState<number | null>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentYear);
  const [showShareCard, setShowShareCard] = useState(false);
  const [savingCal, setSavingCal] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);
  const [isDailyEditing, setIsDailyEditing] = useState(false);
  const [editingDayDate, setEditingDayDate] = useState<string | null>(null);
  const [editDayInput, setEditDayInput] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('reading-goal');
    if (saved) { setGoal(parseInt(saved)); setGoalInput(saved); }
    const savedM = localStorage.getItem('reading-goal-monthly');
    if (savedM) { setMonthlyGoal(parseInt(savedM)); setMonthlyGoalInput(savedM); }
  }, []);

  function saveGoal() {
    const n = Math.max(1, Math.min(999, parseInt(goalInput) || 12));
    setGoal(n); setGoalInput(String(n));
    localStorage.setItem('reading-goal', String(n));
    setEditingGoal(false);
  }

  function saveMonthlyGoal() {
    const n = Math.max(1, Math.min(99, parseInt(monthlyGoalInput) || 2));
    setMonthlyGoal(n); setMonthlyGoalInput(String(n));
    localStorage.setItem('reading-goal-monthly', String(n));
    setEditingMonthlyGoal(false);
  }

  function prevCalMonth() {
    setCalSelectedDay(null);
    if (calDisplayMonth === 0) { setCalDisplayMonth(11); setCalDisplayYear((y) => y - 1); }
    else setCalDisplayMonth((m) => m - 1);
  }
  function nextCalMonth() {
    setCalSelectedDay(null);
    if (calDisplayMonth === 11) { setCalDisplayMonth(0); setCalDisplayYear((y) => y + 1); }
    else setCalDisplayMonth((m) => m + 1);
  }
  function openMonthPicker() {
    setPickerYear(calDisplayYear);
    setShowMonthPicker((v) => !v);
  }
  function goToMonth(y: number, m: number) {
    setCalDisplayYear(y);
    setCalDisplayMonth(m);
    setCalSelectedDay(null);
    setShowMonthPicker(false);
  }

  function saveDayEdit() {
    if (!editingDayDate) return;
    const pages = Math.max(0, parseInt(editDayInput) || 0);
    setDailyPages(editingDayDate, pages);
    setEditingDayDate(null);
    setEditDayInput('');
  }

  async function handleSaveCalImage() {
    if (!calRef.current) return;
    setSavingCal(true);
    try {
      const dataUrl = await toPng(calRef.current, { pixelRatio: 3, cacheBust: true });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `독서달력_${calDisplayYear}.${String(calDisplayMonth + 1).padStart(2, '0')}.png`;
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingCal(false);
    }
  }

  if (!loaded) return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#1D1D1F] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const done = books.filter((b) => b.status === 'done');
  const reading = books.filter((b) => b.status === 'reading');
  const want = books.filter((b) => b.status === 'want');
  const stopped = books.filter((b) => b.status === 'stopped');
  const streak = getReadingStreak();

  // 완독일(endDate)이 없으면 추가일(createdAt)을 기준으로 연/월을 판단 → 읽음 처리가 목표에 반영됨
  const doneYM = (b: Book) => getYearMonth(b.endDate) ?? getYearMonth(b.createdAt);

  const years = Array.from(new Set(done.map((b) => doneYM(b)?.year).filter(Boolean) as number[])).sort((a, b) => b - a);
  if (!years.includes(currentYear)) years.unshift(currentYear);

  const yearDone = done.filter((b) => doneYM(b)?.year === selectedYear);
  // 읽은 페이지 — 완독 책의 페이지 + 읽는중 책의 진행 페이지(현재 연도)
  const inMonthScope = pageView === 'month' && selectedYear === currentYear;
  const pageEntries: { book: Book; pages: number; done: boolean }[] = [];
  (inMonthScope ? yearDone.filter((b) => doneYM(b)?.month === currentMonth) : yearDone)
    .filter((b) => (b.pages ?? 0) > 0)
    .forEach((b) => pageEntries.push({ book: b, pages: b.pages ?? 0, done: true }));
  if (selectedYear === currentYear) {
    reading.filter((b) => (b.currentPage ?? 0) > 0)
      .forEach((b) => pageEntries.push({ book: b, pages: b.currentPage ?? 0, done: false }));
  }
  pageEntries.sort((a, b) => b.pages - a.pages);
  const pageScopeTotal = pageEntries.reduce((s, e) => s + e.pages, 0);
  const pageScopeMax = Math.max(...pageEntries.map((e) => e.pages), 1);
  const totalPagesThisYear = pageScopeTotal;

  const monthlyCounts = Array(12).fill(0);
  const monthlyPages = Array(12).fill(0);
  yearDone.forEach((b) => {
    const ym = doneYM(b);
    if (ym) {
      monthlyCounts[ym.month]++;
      if (b.pages) monthlyPages[ym.month] += b.pages;
    }
  });
  const maxMonthly = Math.max(...monthlyCounts, 1);
  const maxPages = Math.max(...monthlyPages, 1);
  const hasPageData = monthlyPages.some((p) => p > 0);

  const goalProgress = selectedYear === currentYear ? Math.min(yearDone.length / goal, 1) : null;
  // 이번 달 완독 권수 + 월 목표 진행률 (올해 볼 때만)
  const thisMonthDone = yearDone.filter((b) => doneYM(b)?.month === currentMonth).length;
  const monthlyProgress = selectedYear === currentYear ? Math.min(thisMonthDone / monthlyGoal, 1) : null;
  const rated = done.filter((b) => b.rating > 0);
  const avgRating = rated.length > 0 ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : null;
  const totalReadingTime = books.reduce((acc, b) => acc + (b.totalReadingTime ?? 0), 0);
  const recent = [...done].sort((a, b) => (b.endDate || b.createdAt).localeCompare(a.endDate || a.createdAt)).slice(0, 5);
  const cs = { boxShadow: '0 2px 16px rgba(0,0,0,0.06)' };

  const dailyReadings = getDailyReadings();
  const calDayBooks = buildDayActivity(books, dailyReadings, calDisplayYear, calDisplayMonth);
  const calFirstDay = new Date(calDisplayYear, calDisplayMonth, 1).getDay();
  const calTotalDays = new Date(calDisplayYear, calDisplayMonth + 1, 0).getDate();
  // 헤더 배지: 이 달 완독 권수 / 활동한 날 수
  const calMonthDoneCount = Object.values(calDayBooks).flat().filter((e) => e.done).length;
  const calMonthActiveDays = Object.keys(calDayBooks).length;

  // 완독 책의 '미기록' 페이지를 완독일에 자동 집계 (완독 = 읽은 페이지로 반영)
  const completionByDate: Record<string, number> = {};
  books.forEach((b) => {
    if (b.status !== 'done' || !b.endDate) return;
    const logged = dailyReadings.filter((r) => r.bookId === b.id).reduce((s, r) => s + r.pages, 0);
    const remainder = Math.max((b.pages ?? 0) - logged, 0);
    if (remainder > 0) {
      const key = b.endDate.slice(0, 10);
      completionByDate[key] = (completionByDate[key] ?? 0) + remainder;
    }
  });

  // 일별 페이지 (최근 N일) — 북베어 스타일 막대 차트
  const dailyChart = (() => {
    const out: { date: string; pages: number; label: string; isToday: boolean; book?: Book }[] = [];
    const todayStr = localDate();
    for (let i = dailyRange - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = localDate(d);
      const dayReadings = dailyReadings.filter((r) => r.date === dateStr);
      const dayPages = dayReadings.reduce((s, r) => s + r.pages, 0) + (completionByDate[dateStr] ?? 0);
      const label = i === 0 ? '오늘' : `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
      const entry = dayReadings[0];
      const book = entry?.bookId ? books.find((b) => b.id === entry.bookId) : undefined;
      out.push({ date: dateStr, pages: dayPages, label, isToday: dateStr === todayStr, book });
    }
    return out;
  })();
  const maxDaily = Math.max(...dailyChart.map((d) => d.pages), 1);
  const hasDailyData = dailyChart.some((d) => d.pages > 0);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-pt"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 48px)' }}>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors flex-shrink-0"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}>
            <svg className="w-5 h-5 sm:w-4 sm:h-4 text-[#1D1D1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">독서 통계</h1>
        </div>

        {/* 연도 선택 */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {years.map((y) => (
            <button key={y} onClick={() => { setSelectedYear(y); setCalDisplayYear(y); setCalSelectedDay(null); }}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedYear === y ? 'bg-[#1D1D1F] text-white' : 'bg-white text-[#6E6E73] hover:bg-gray-50'}`}
              style={selectedYear !== y ? { boxShadow: '0 1px 6px rgba(0,0,0,0.06)' } : {}}>
              {y}년
            </button>
          ))}
        </div>

        {/* 연도 요약 카드 */}
        <div className="bg-[#1D1D1F] rounded-3xl p-6 mb-4 text-white" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.14)' }}>
          {/* 연간 / 월별 전환 */}
          {selectedYear === currentYear && (
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/10 mb-5">
              {([['year', '연간'], ['month', '월별']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setGoalView(v)}
                  className="px-5 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{ background: goalView === v ? '#fff' : 'transparent', color: goalView === v ? '#1D1D1F' : 'rgba(255,255,255,0.55)' }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {(() => {
            const isMonthGoal = selectedYear === currentYear && goalView === 'month';
            const showGoal = selectedYear === currentYear;
            const gCount = isMonthGoal ? thisMonthDone : yearDone.length;
            const gGoal = isMonthGoal ? monthlyGoal : goal;
            const gProgress = isMonthGoal ? (monthlyProgress ?? 0) : (goalProgress ?? 0);
            const gRemaining = gGoal - gCount;
            const editing = isMonthGoal ? editingMonthlyGoal : editingGoal;
            const pct = Math.round(gProgress * 100);
            const R = 34, C = 2 * Math.PI * R;
            return (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-white/60 mb-1.5">{isMonthGoal ? `${currentMonth + 1}월 완독` : `${selectedYear}년 완독`}</p>
                  <p className="text-[44px] font-bold tracking-tight leading-none">
                    {gCount}
                    {showGoal && <span className="text-2xl text-white/45 font-semibold"> / {gGoal}권</span>}
                    {!showGoal && <span className="text-2xl text-white/45 font-semibold"> 권</span>}
                  </p>
                  {showGoal && (editing ? (
                    <div className="flex items-center gap-2 mt-3.5">
                      <input type="number" value={isMonthGoal ? monthlyGoalInput : goalInput}
                        onChange={(e) => isMonthGoal ? setMonthlyGoalInput(e.target.value) : setGoalInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (isMonthGoal ? saveMonthlyGoal() : saveGoal())}
                        className="w-16 px-2 py-1 rounded-lg bg-white/10 text-white text-sm text-center outline-none focus:ring-2 focus:ring-white/30" autoFocus />
                      <button onClick={() => isMonthGoal ? saveMonthlyGoal() : saveGoal()} className="px-3 py-1 bg-white text-[#1D1D1F] rounded-lg text-xs font-semibold">저장</button>
                    </div>
                  ) : (
                    <p className="text-white/45 text-xs mt-3 leading-relaxed">
                      {gRemaining > 0 ? `${gRemaining}권 더 읽으면 달성` : '🎉 목표 달성!'}
                      <button onClick={() => isMonthGoal ? setEditingMonthlyGoal(true) : setEditingGoal(true)}
                        className="ml-2 text-white/70 font-semibold hover:text-white transition-colors">목표 수정</button>
                    </p>
                  ))}
                </div>
                {/* 원형 진행 링 */}
                {showGoal && (
                  <div className="relative flex-shrink-0" style={{ width: 84, height: 84 }}>
                    <svg width={84} height={84}>
                      <circle cx={42} cy={42} r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={7} />
                      <circle cx={42} cy={42} r={R} fill="none" stroke={gProgress >= 1 ? '#34D399' : '#4F8EF7'} strokeWidth={7} strokeLinecap="round"
                        strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(gProgress, 1))} transform="rotate(-90 42 42)"
                        style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold tabular-nums">{pct}%</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          {streak >= 1 && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <p className="text-white/60 text-xs">{streak}일 연속 독서 중</p>
            </div>
          )}
        </div>

        {/* 게임 모드 토글 */}
        {books.length > 0 && (
          <div className="bg-white rounded-2xl px-4 py-3 mb-4 flex items-center justify-between" style={cs}>
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🎮</span>
              <div>
                <p className="text-sm font-semibold text-[#1D1D1F]">게임 모드</p>
                <p className="text-[11px] text-[#AEAEB2]">레벨 · 연속 독서 · 업적으로 더 재미있게</p>
              </div>
            </div>
            <button onClick={toggleGameMode} role="switch" aria-checked={gameMode} title="게임 모드"
              className="relative w-[52px] h-8 rounded-full transition-colors flex-shrink-0"
              style={{ background: gameMode ? '#34C759' : '#E5E5EA' }}>
              <span className="absolute top-1 w-6 h-6 rounded-full bg-white transition-all" style={{ left: gameMode ? 24 : 4, boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
            </button>
          </div>
        )}

        {/* 게이미피케이션 — 게임 모드 ON일 때만 */}
        {books.length > 0 && gameMode && (
          <GamificationCard books={books} dailyReadings={dailyReadings} streak={streak} />
        )}

        {/* 상태별 현황 — 유리 카드 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: '완독',      count: done.length,    accent: '#10B981' },
            { label: '읽는중',   count: reading.length, accent: '#3B7DE8' },
            { label: '읽을 예정', count: want.length,    accent: '#8B5CF6' },
            { label: '중단',      count: stopped.length, accent: '#9CA3AF' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl p-3 text-center"
              style={{
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 4px 14px rgba(80,90,130,0.10)',
              }}>
              <p className="text-2xl font-extrabold" style={{ color: item.accent }}>{item.count}</p>
              <p className="text-[10px] text-[#6E6E73] mt-0.5 leading-tight font-medium">{item.label}</p>
            </div>
          ))}
        </div>

        {/* 읽은 페이지 — 연간/월별 + 책별 분해 */}
        {totalPagesThisYear > 0 && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 mb-4" style={cs}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-[#6E6E73]">읽은 페이지</p>
              {selectedYear === currentYear && (
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-[#F5F5F7]">
                  {([['year', '연간'], ['month', '월별']] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setPageView(v)}
                      className="px-3 py-1 rounded-full text-[11px] font-bold transition-all"
                      style={{ background: pageView === v ? '#fff' : 'transparent', color: pageView === v ? '#1D1D1F' : '#AEAEB2', boxShadow: pageView === v ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold text-[#1D1D1F] tracking-tight tabular-nums">
                {pageScopeTotal.toLocaleString()}<span className="text-sm font-normal text-[#6E6E73] ml-1">쪽</span>
              </p>
              <div className="w-10 h-10 rounded-full bg-[#EAF2FE] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#3B7DE8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>

            {pageEntries.length > 0 ? (
              <>
                <button onClick={() => setPagesExpanded((v) => !v)}
                  className="mt-3 w-full flex items-center justify-center gap-1 text-[12px] text-[#3B7DE8] font-semibold py-1.5 active:opacity-60 transition-opacity">
                  {pagesExpanded ? '접기' : `어떤 책을 읽었는지 보기 (${pageEntries.length}권)`}
                  <svg className={`w-3.5 h-3.5 transition-transform ${pagesExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {pagesExpanded && (
                  <div className="mt-1 pt-3 border-t border-[#F5F5F7] space-y-3">
                    {pageEntries.map(({ book, pages, done: isDone }) => (
                      <Link key={book.id} to={`/book/${book.id}`} className="block active:opacity-70 transition-opacity">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <span className="text-[12.5px] font-medium text-[#1D1D1F] truncate flex items-center gap-1.5">
                            {book.title}
                            {!isDone && <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full flex-shrink-0">읽는중</span>}
                          </span>
                          <span className="text-[12px] font-bold text-[#3B7DE8] flex-shrink-0 tabular-nums">{pages.toLocaleString()}쪽</span>
                        </div>
                        <div className="h-2 bg-[#F0F0F5] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.max((pages / pageScopeMax) * 100, 4)}%`, background: isDone ? 'linear-gradient(90deg,#4F8EF7,#3B7DE8)' : 'linear-gradient(90deg,#93C5FD,#60A5FA)' }} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 text-center text-[11px] text-[#AEAEB2]">아직 읽은 페이지가 없어요</p>
            )}
          </div>
        )}

        {/* 평균 별점 + 총 독서 시간 */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {avgRating && (
            <div className="bg-white rounded-2xl p-4 flex flex-col justify-between" style={cs}>
              <p className="text-xs text-[#6E6E73] mb-0.5">평균 별점</p>
              <p className="text-2xl font-bold text-[#1D1D1F]">{avgRating}</p>
              <div className="flex gap-0.5 mt-1">
                {[1,2,3,4,5].map((s) => (
                  <span key={s} className={`text-base ${parseFloat(avgRating) >= s ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                ))}
              </div>
            </div>
          )}
          {fmtTime(totalReadingTime) && (
            <div className="rounded-2xl p-4 flex flex-col justify-between"
              style={{ background: 'linear-gradient(135deg, #0C0C18 0%, #1a1040 100%)', ...cs }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-white/50">총 독서 시간</p>
              </div>
              <p className="text-xl font-bold text-white leading-tight">{fmtTime(totalReadingTime)}</p>
            </div>
          )}
        </div>

        {/* ── 매일 얼마나 읽었는지 ── */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 mb-4" style={cs}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-[#1D1D1F]">매일 얼마나 읽었는지</h2>
            <div className="flex items-center gap-2">
              {!isDailyEditing && (
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-[#F5F5F7]">
                  {[14, 30, 60].map((n) => (
                    <button key={n} onClick={() => { setDailyRange(n); setEditingDayDate(null); }}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
                      style={{ background: dailyRange === n ? '#fff' : 'transparent', color: dailyRange === n ? '#1D1D1F' : '#AEAEB2', boxShadow: dailyRange === n ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
                      {n}일
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => { setIsDailyEditing((v) => !v); setEditingDayDate(null); }}
                className={`flex items-center justify-center transition-colors ${
                  isDailyEditing
                    ? 'px-2.5 py-1 text-[10px] font-semibold text-indigo-500 bg-indigo-50 rounded-full'
                    : 'w-7 h-7 text-[#AEAEB2] hover:bg-[#F5F5F7] rounded-full'
                }`}
              >
                {isDailyEditing ? '완료' : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <p className="text-[11px] mb-5" style={{ color: isDailyEditing ? '#818CF8' : '#AEAEB2' }}>
            {isDailyEditing ? '날짜를 탭해서 기록을 수정할 수 있어요' : '하루하루 읽은 페이지를 한눈에 볼 수 있어요'}
          </p>
          {hasDailyData || isDailyEditing ? (
            <div className="flex items-end justify-between overflow-x-auto" style={{ height: 140, gap: dailyRange <= 14 ? 6 : dailyRange <= 30 ? 3 : 1.5 }}>
              {dailyChart.map((d, i) => {
                const h = d.pages > 0 ? Math.max((d.pages / maxDaily) * 96 + 14, 18) : 4;
                const showNum = dailyRange <= 14;
                const barMax = dailyRange <= 14 ? 26 : dailyRange <= 30 ? 14 : 8;
                const labelStep = dailyRange <= 14 ? 1 : dailyRange <= 30 ? 5 : 10;
                const showLabel = d.isToday || i % labelStep === 0;
                const isEditSelected = isDailyEditing && editingDayDate === d.date;
                return (
                  <button
                    key={d.date}
                    className={`flex-1 flex flex-col items-center gap-2 outline-none min-w-0 ${isDailyEditing ? 'cursor-pointer' : 'cursor-default'}`}
                    title={`${d.label} · ${d.pages}p${d.book ? ` (${d.book.title})` : ''}`}
                    disabled={!isDailyEditing}
                    onClick={() => {
                      setEditingDayDate(d.date);
                      setEditDayInput(String(d.pages || ''));
                    }}
                  >
                    <div className="w-full flex flex-col items-center justify-end" style={{ height: 118 }}>
                      {showNum && d.pages > 0 && (
                        <span className="text-[11px] font-bold mb-1 leading-none transition-colors"
                          style={{ color: isEditSelected ? '#6366F1' : d.isToday ? '#3B7DE8' : '#6E6E73' }}>
                          {d.pages}p
                        </span>
                      )}
                      <div
                        className="w-full rounded-lg transition-all duration-500"
                        style={{
                          height: h,
                          background: isEditSelected
                            ? 'linear-gradient(180deg, #818CF8, #6366F1)'
                            : d.isToday
                            ? 'linear-gradient(180deg, #4F8EF7, #3B7DE8)'
                            : d.pages > 0
                            ? '#C9DFFB'
                            : '#F0F0F5',
                          minHeight: 4,
                          maxWidth: barMax,
                          boxShadow: isEditSelected
                            ? '0 4px 12px rgba(99,102,241,0.3)'
                            : d.isToday ? '0 4px 12px rgba(59,125,232,0.25)' : 'none',
                        }}
                      />
                    </div>
                    <p className="text-[9.5px] font-semibold leading-tight whitespace-nowrap"
                      style={{ color: isEditSelected ? '#6366F1' : d.isToday ? '#3B7DE8' : '#AEAEB2', visibility: showLabel ? 'visible' : 'hidden' }}>
                      {d.isToday ? '오늘' : d.label}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-[#AEAEB2] text-xs py-8">아직 기록된 독서 데이터가 없어요</p>
          )}
          {isDailyEditing && editingDayDate && (
            <div className="mt-4 pt-4 border-t border-[#F5F5F7]">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-[#6E6E73] flex-shrink-0 w-12 text-center">
                  {dailyChart.find((d) => d.date === editingDayDate)?.label}
                </p>
                <div className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-[#F5F5F7] rounded-xl">
                  <input
                    type="number"
                    value={editDayInput}
                    onChange={(e) => setEditDayInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveDayEdit()}
                    placeholder="0"
                    min="0"
                    className="flex-1 bg-transparent text-sm font-bold text-[#1D1D1F] outline-none"
                    autoFocus
                  />
                  <span className="text-[#AEAEB2] text-xs flex-shrink-0">p</span>
                </div>
                <button
                  onClick={saveDayEdit}
                  className="px-3 py-2 bg-[#1D1D1F] text-white text-xs font-semibold rounded-xl flex-shrink-0"
                >
                  저장
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 독서 달력 ── */}
        <div className="bg-white rounded-3xl p-3.5 sm:p-5 mb-4" style={cs}>
          {/* Header — 큰 월/년(탭하면 년/월 선택) + 좌우 네비 */}
          <div className="relative mb-3 px-1">
            <div className="flex items-center justify-between">
              <button onClick={openMonthPicker}
                className="flex items-center gap-2 -ml-1 pl-1 pr-2 py-1 rounded-xl hover:bg-[#F5F5F7] active:bg-gray-100 transition-colors">
                <span className="text-xl font-bold text-[#1D1D1F] tracking-tight">
                  {calDisplayYear}.{String(calDisplayMonth + 1).padStart(2, '0')}
                </span>
                <svg className={`w-4 h-4 text-[#AEAEB2] transition-transform ${showMonthPicker ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {calMonthDoneCount > 0 && (
                  <span className="text-[11px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{calMonthDoneCount}권 완독</span>
                )}
                {calMonthDoneCount === 0 && calMonthActiveDays > 0 && (
                  <span className="text-[11px] font-semibold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">{calMonthActiveDays}일 독서</span>
                )}
              </button>
              <div className="flex items-center gap-1">
                <button onClick={prevCalMonth}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-[#6E6E73] hover:bg-[#F5F5F7] active:bg-gray-100 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button onClick={nextCalMonth}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-[#6E6E73] hover:bg-[#F5F5F7] active:bg-gray-100 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 년/월 선택 패널 */}
            {showMonthPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMonthPicker(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 w-[280px] max-w-[calc(100vw-40px)] bg-white rounded-2xl p-3"
                  style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.16)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  {/* 연도 선택 */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <button onClick={() => setPickerYear((y) => y - 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="text-base font-bold text-[#1D1D1F]">{pickerYear}년</span>
                    <button onClick={() => setPickerYear((y) => y + 1)}
                      disabled={pickerYear >= currentYear}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors disabled:opacity-30">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                  {/* 월 그리드 */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {MONTHS.map((label, m) => {
                      const isCur = pickerYear === calDisplayYear && m === calDisplayMonth;
                      const isFuture = pickerYear > currentYear || (pickerYear === currentYear && m > currentMonth);
                      return (
                        <button key={m} onClick={() => goToMonth(pickerYear, m)} disabled={isFuture}
                          className={`py-2 rounded-xl text-[13px] font-semibold transition-colors ${
                            isCur ? 'bg-[#1D1D1F] text-white' : isFuture ? 'text-[#D1D1D6]' : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                          }`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => goToMonth(currentYear, currentMonth)}
                    className="w-full mt-2 py-2 rounded-xl text-[12px] font-semibold text-indigo-500 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                    오늘로 이동
                  </button>
                </div>
              </>
            )}
          </div>

          <div ref={calRef} className="bg-white rounded-xl">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1.5">
              {WEEK_DAYS.map((d, i) => (
                <div key={d} className={`text-center text-[11px] font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-[#AEAEB2]'}`}>{d}</div>
              ))}
            </div>

            {/* Calendar grid — 일자 위, 표지 아래 (북베어 스타일) */}
            <div className="grid grid-cols-7 gap-x-1 sm:gap-x-1.5 gap-y-1.5 pb-1">
              {Array.from({ length: calFirstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: calTotalDays }, (_, i) => i + 1).map((day) => {
                const dayBooksArr = calDayBooks[day] || [];
                const hasBooks = dayBooksArr.length > 0;
                const isSelected = calSelectedDay === day;
                const dow = (calFirstDay + day - 1) % 7;
                const stack = dayBooksArr.slice(0, 3);
                // 여러 권이면 마우스 올렸을 때 부채꼴로 펼쳐 각 표지를 개별 클릭 가능하게
                const expanded = hoverDay === day && stack.length > 1;
                const POS = expanded
                  ? [{ rotate: 0, tx: 0, z: 30 }, { rotate: -10, tx: -64, z: 20 }, { rotate: 10, tx: 64, z: 10 }]
                  : [{ rotate: 0, tx: 0, z: 30 }, { rotate: -9, tx: -18, z: 20 }, { rotate: 9, tx: 18, z: 10 }];
                return (
                  <div
                    key={day}
                    className="relative flex flex-col items-center gap-1"
                    style={{ zIndex: expanded ? 50 : undefined }}
                    onMouseEnter={() => hasBooks && setHoverDay(day)}
                    onMouseLeave={() => setHoverDay(null)}
                  >
                    {/* Date number — 탭하면 아래 목록 표시 */}
                    <button
                      onClick={() => hasBooks && setCalSelectedDay(isSelected ? null : day)}
                      disabled={!hasBooks}
                      className="text-[11px] leading-none outline-none"
                      style={{
                        color: isSelected
                          ? '#6366f1'
                          : dow === 0 ? '#f87171' : dow === 6 ? '#60a5fa' : hasBooks ? '#1D1D1F' : '#AEAEB2',
                        fontWeight: hasBooks || isSelected ? 700 : 500,
                      }}
                    >
                      {day}
                    </button>

                    {/* 표지 스택 — 각 표지는 개별 링크, 호버 시 펼쳐짐 */}
                    <div className="relative w-full flex items-center justify-center" style={{ aspectRatio: '2 / 3' }}>
                      {!hasBooks && <div className="w-[82%] h-full rounded-md" />}
                      {stack.map((entry, i) => {
                        const p = POS[i];
                        return (
                          <button
                            key={entry.book.id}
                            type="button"
                            onClick={() => setCalSelectedDay(isSelected ? null : day)}
                            title={entry.book.title}
                            className="absolute rounded-md overflow-hidden"
                            style={{
                              width: '82%',
                              aspectRatio: '2 / 3',
                              transform: `translateX(${p.tx}%) rotate(${p.rotate}deg)`,
                              zIndex: p.z,
                              background: entry.book.coverUrl ? '#fff' : 'linear-gradient(135deg, #818CF8, #C084FC)',
                              boxShadow: expanded ? '0 8px 18px rgba(0,0,0,0.24)' : '0 2px 8px rgba(0,0,0,0.16)',
                              border: '1.5px solid #fff',
                              outline: isSelected && i === 0 ? '2px solid #6366f1' : 'none',
                              outlineOffset: 2,
                              transition: 'transform 0.22s ease, box-shadow 0.22s ease',
                            }}
                          >
                            {entry.book.coverUrl ? (
                              <img src={entry.book.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">{entry.book.title.slice(0, 1)}</span>
                              </div>
                            )}
                            {i === 0 && entry.done && (
                              <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center border border-white">
                                <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" /></svg>
                              </div>
                            )}
                          </button>
                        );
                      })}
                      {dayBooksArr.length > 1 && !expanded && (
                        <div className="absolute -top-1 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#1D1D1F] flex items-center justify-center border-2 border-white" style={{ zIndex: 40 }}>
                          <span className="text-white text-[8px] font-bold leading-none">{dayBooksArr.length}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 저장 / 공유 — 캘린더 하단에 절제된 액션 영역 */}
          <div className="mt-4 pt-4 border-t border-[#F5F5F7] flex items-center gap-2">
            <button
              onClick={handleSaveCalImage}
              disabled={savingCal || calMonthDoneCount === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] text-xs font-medium hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {savingCal ? '저장 중' : '이미지로 저장'}
            </button>
            <button
              onClick={() => setShowShareCard(true)}
              disabled={calMonthDoneCount === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] text-xs font-medium hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              공유 카드
            </button>
          </div>

          {/* Selected day books */}
          {calSelectedDay !== null && calDayBooks[calSelectedDay] && (() => {
            // 완독 표시 대신 그날 읽은 쪽수 (기록 없으면 완독 책은 전체 쪽으로 집계)
            const entries = calDayBooks[calSelectedDay].map((e) => ({
              book: e.book,
              shown: e.pages > 0 ? e.pages : (e.done ? (e.book.pages ?? 0) : 0),
            }));
            const dayTotalPages = entries.reduce((s, e) => s + e.shown, 0);
            return (
            <div className="mt-4 pt-4 border-t border-[#F5F5F7] space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#6E6E73]">{calDisplayMonth + 1}월 {calSelectedDay}일 · 책 {entries.length}권</p>
                {dayTotalPages > 0 && (
                  <p className="text-xs font-bold text-[#3B7DE8]">이 날 {dayTotalPages.toLocaleString()}쪽</p>
                )}
              </div>
              {entries.map(({ book, shown }) => (
                <Link key={book.id} to={`/book/${book.id}`}
                  className="flex items-center gap-3 bg-[#F5F5F7] rounded-xl p-3 active:opacity-70 transition-opacity">
                  <div className="w-9 rounded-lg overflow-hidden flex-shrink-0" style={{ height: 48 }}>
                    {book.coverUrl
                      ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">{book.title.slice(0, 2)}</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1D1D1F] truncate">{book.title}</p>
                    <p className="text-xs text-[#6E6E73] truncate">{book.author}</p>
                  </div>
                  {shown > 0 && (
                    <span className="flex-shrink-0 text-[12px] font-bold text-[#3B7DE8] tabular-nums">{shown.toLocaleString()}쪽</span>
                  )}
                </Link>
              ))}
            </div>
            );
          })()}

          {calMonthActiveDays === 0 && (
            <p className="text-center text-[#AEAEB2] text-xs py-4">이 달에 읽은 기록이 없어요</p>
          )}
        </div>


        {/* ── 월별 독서 차트 (완독 권수 / 읽은 페이지 토글) ── */}
        {(yearDone.length > 0 || hasPageData) && (() => {
          const data = monthlyMetric === 'pages' ? monthlyPages : monthlyCounts;
          const maxM = Math.max(...data, 1);
          const barBg = monthlyMetric === 'pages'
            ? 'linear-gradient(180deg, #1D1D1F, #3A3A3C)'
            : 'linear-gradient(180deg, #5B8BF2, #3B7DE8)';
          return (
            <div className="bg-white rounded-2xl p-5 sm:p-6 mb-4" style={cs}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-[#1D1D1F]">월별 독서</h2>
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-[#F5F5F7]">
                  {([['count', '완독 권수'], ['pages', '읽은 페이지']] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setMonthlyMetric(v)}
                      className="px-3 py-1 rounded-full text-[11px] font-bold transition-all"
                      style={{ background: monthlyMetric === v ? '#fff' : 'transparent', color: monthlyMetric === v ? '#1D1D1F' : '#AEAEB2', boxShadow: monthlyMetric === v ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-end justify-between gap-1" style={{ height: 130 }}>
                {data.map((v, i) => {
                  const h = v > 0 ? Math.max((v / maxM) * 88 + 10, 14) : 3;
                  const isCur = i === currentMonth && selectedYear === currentYear;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="w-full flex flex-col items-center justify-end" style={{ height: 104 }}>
                        {v > 0 && <span className="text-[9px] font-bold mb-0.5 leading-none" style={{ color: isCur ? '#3B7DE8' : '#6E6E73' }}>{v}</span>}
                        <div className="w-full rounded-md transition-all duration-500"
                          style={{ height: h, maxWidth: 22, background: v > 0 ? barBg : '#F0F0F5', opacity: v > 0 ? 1 : 1 }} />
                      </div>
                      <span className="text-[9px] font-medium" style={{ color: isCur ? '#3B7DE8' : '#AEAEB2' }}>{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── 최근 읽은 책 ── */}
        {recent.length > 0 && (
          <div className="bg-white rounded-2xl p-5 sm:p-6" style={cs}>
            <h2 className="text-sm font-semibold text-[#1D1D1F] mb-4">최근 읽은 책</h2>
            <div className="space-y-3">
              {recent.map((book) => (
                <Link key={book.id} to={`/book/${book.id}`}
                  className="flex items-center gap-3 active:opacity-60 transition-opacity">
                  <div className="w-10 h-14 rounded-lg overflow-hidden flex-shrink-0">
                    {book.coverUrl
                      ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-[#F5F5F7] flex items-center justify-center text-xs font-bold text-[#6E6E73]">{book.title.slice(0,2)}</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1D1D1F] truncate">{book.title}</p>
                    <p className="text-xs text-[#6E6E73] truncate">{book.author}</p>
                  </div>
                  {book.rating > 0 && (
                    <span className="text-amber-400 text-sm flex-shrink-0">{'★'.repeat(book.rating)}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {books.length === 0 && (
          <div className="text-center py-20 text-[#6E6E73] text-sm">아직 기록된 책이 없어요</div>
        )}
      </div>

      {/* 월별 공유 카드 모달 */}
      {showShareCard && (
        <MonthlyShareCard
          books={done}
          year={calDisplayYear}
          month={calDisplayMonth}
          onClose={() => setShowShareCard(false)}
        />
      )}
    </div>
  );
}
