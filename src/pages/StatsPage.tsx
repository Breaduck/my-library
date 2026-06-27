import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { useBooks } from '@/hooks/useBooks';
import { Book } from '@/types';
import { getReadingStreak, getDailyReadings } from '@/lib/storage';
import MonthlyShareCard from '@/components/MonthlyShareCard';

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

function buildDayBooks(books: Book[], year: number, month: number): Record<number, Book[]> {
  const map: Record<number, Book[]> = {};
  books.forEach((b) => {
    if (!b.endDate) return;
    const d = new Date(b.endDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      (map[day] = map[day] || []).push(b);
    }
  });
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
  const [calDisplayYear, setCalDisplayYear] = useState(currentYear);
  const [calDisplayMonth, setCalDisplayMonth] = useState(currentMonth);
  const [calSelectedDay, setCalSelectedDay] = useState<number | null>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [savingCal, setSavingCal] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('reading-goal');
    if (saved) { setGoal(parseInt(saved)); setGoalInput(saved); }
  }, []);

  function saveGoal() {
    const n = Math.max(1, Math.min(999, parseInt(goalInput) || 12));
    setGoal(n); setGoalInput(String(n));
    localStorage.setItem('reading-goal', String(n));
    setEditingGoal(false);
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

  const years = Array.from(new Set(done.map((b) => getYearMonth(b.endDate)?.year).filter(Boolean) as number[])).sort((a, b) => b - a);
  if (!years.includes(currentYear)) years.unshift(currentYear);

  const yearDone = done.filter((b) => getYearMonth(b.endDate)?.year === selectedYear);
  const totalPagesThisYear = yearDone.filter(b => b.pages).reduce((acc, b) => acc + (b.pages ?? 0), 0);

  const monthlyCounts = Array(12).fill(0);
  const monthlyPages = Array(12).fill(0);
  yearDone.forEach((b) => {
    const ym = getYearMonth(b.endDate);
    if (ym) {
      monthlyCounts[ym.month]++;
      if (b.pages) monthlyPages[ym.month] += b.pages;
    }
  });
  const maxMonthly = Math.max(...monthlyCounts, 1);
  const maxPages = Math.max(...monthlyPages, 1);
  const hasPageData = monthlyPages.some((p) => p > 0);

  const goalProgress = selectedYear === currentYear ? Math.min(yearDone.length / goal, 1) : null;
  const rated = done.filter((b) => b.rating > 0);
  const avgRating = rated.length > 0 ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : null;
  const totalReadingTime = books.reduce((acc, b) => acc + (b.totalReadingTime ?? 0), 0);
  const recent = [...done].sort((a, b) => (b.endDate || b.createdAt).localeCompare(a.endDate || a.createdAt)).slice(0, 5);
  const cs = { boxShadow: '0 2px 16px rgba(0,0,0,0.06)' };

  const calDayBooks = buildDayBooks(done, calDisplayYear, calDisplayMonth);
  const calFirstDay = new Date(calDisplayYear, calDisplayMonth, 1).getDay();
  const calTotalDays = new Date(calDisplayYear, calDisplayMonth + 1, 0).getDate();
  const calMonthDoneCount = Object.values(calDayBooks).flat().length;

  // 일별 페이지 (최근 14일) — 북베어 스타일 막대 차트
  const dailyReadings = getDailyReadings();
  const dailyChart = (() => {
    const out: { date: string; pages: number; label: string; isToday: boolean; book?: Book }[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const entry = dailyReadings.find((r) => r.date === dateStr);
      const label = i === 0 ? '오늘' : `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
      const book = entry?.bookId ? books.find((b) => b.id === entry.bookId) : undefined;
      out.push({ date: dateStr, pages: entry?.pages ?? 0, label, isToday: dateStr === todayStr, book });
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
            <button key={y} onClick={() => { setSelectedYear(y); setCalSelectedDay(null); }}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedYear === y ? 'bg-[#1D1D1F] text-white' : 'bg-white text-[#6E6E73] hover:bg-gray-50'}`}
              style={selectedYear !== y ? { boxShadow: '0 1px 6px rgba(0,0,0,0.06)' } : {}}>
              {y}년
            </button>
          ))}
        </div>

        {/* 연도 요약 카드 */}
        <div className="bg-[#1D1D1F] rounded-3xl p-6 mb-4 text-white" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.14)' }}>
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-sm text-white/60 mb-1">{selectedYear}년 완독</p>
              <p className="text-5xl font-bold tracking-tight">{yearDone.length}</p>
              <p className="text-white/60 text-sm mt-0.5">권</p>
            </div>
            {selectedYear === currentYear && (
              <div className="text-right">
                {editingGoal ? (
                  <div className="flex items-center gap-2">
                    <input type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveGoal()}
                      className="w-20 px-3 py-1.5 rounded-xl bg-white/10 text-white text-sm text-center outline-none focus:ring-2 focus:ring-white/30"
                      autoFocus />
                    <button onClick={saveGoal} className="px-3 py-1.5 bg-white text-[#1D1D1F] rounded-xl text-xs font-semibold">저장</button>
                  </div>
                ) : (
                  <button onClick={() => setEditingGoal(true)} className="text-right active:opacity-60 transition-opacity">
                    <p className="text-white/50 text-xs">목표</p>
                    <p className="text-white font-bold text-xl">{goal}권</p>
                    <p className="text-white/40 text-xs mt-0.5">탭해서 수정</p>
                  </button>
                )}
              </div>
            )}
          </div>
          {goalProgress !== null && (
            <div>
              <div className="flex justify-between text-xs text-white/50 mb-1.5">
                <span>{yearDone.length}권 완료</span>
                <span>{Math.round(goalProgress * 100)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${goalProgress * 100}%` }} />
              </div>
              <p className="text-white/40 text-xs mt-1.5">
                {goal - yearDone.length > 0 ? `목표까지 ${goal - yearDone.length}권 남았어요` : '🎉 목표 달성!'}
              </p>
            </div>
          )}
          {streak >= 1 && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <p className="text-white/60 text-xs">{streak}일 연속 독서 중</p>
            </div>
          )}
        </div>

        {/* 상태별 현황 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: '완독',      count: done.length,    color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '읽는 중',   count: reading.length, color: 'text-blue-600',    bg: 'bg-blue-50' },
            { label: '읽을 예정', count: want.length,    color: 'text-purple-600',  bg: 'bg-purple-50' },
            { label: '중단',      count: stopped.length, color: 'text-gray-500',    bg: 'bg-gray-100' },
          ].map((item) => (
            <div key={item.label} className={`${item.bg} rounded-2xl p-3 text-center`}>
              <p className={`text-xl font-bold ${item.color}`}>{item.count}</p>
              <p className="text-[10px] text-[#6E6E73] mt-0.5 leading-tight">{item.label}</p>
            </div>
          ))}
        </div>

        {/* 올해 읽은 페이지 */}
        {totalPagesThisYear > 0 && (
          <div className="bg-white rounded-2xl p-4 mb-4 flex items-center justify-between" style={cs}>
            <div>
              <p className="text-xs text-[#6E6E73]">{selectedYear}년 읽은 페이지</p>
              <p className="text-2xl font-bold text-[#1D1D1F] mt-0.5">{totalPagesThisYear.toLocaleString()}<span className="text-sm font-normal text-[#6E6E73] ml-1">쪽</span></p>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
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

        {/* ── 독서 달력 ── */}
        <div className="bg-white rounded-3xl p-3.5 sm:p-5 mb-4" style={cs}>
          {/* Header — 큰 월/년 + 좌우 네비 */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2.5">
              <span className="text-xl font-bold text-[#1D1D1F] tracking-tight">
                {calDisplayYear}.{String(calDisplayMonth + 1).padStart(2, '0')}
              </span>
              {calMonthDoneCount > 0 && (
                <span className="text-[11px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {calMonthDoneCount}권
                </span>
              )}
            </div>
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
                const coverBook = dayBooksArr.find((b) => b.coverUrl);
                return (
                  <button
                    key={day}
                    onClick={() => hasBooks && setCalSelectedDay(isSelected ? null : day)}
                    className="flex flex-col items-center gap-1 outline-none"
                    disabled={!hasBooks}
                  >
                    {/* Date number ABOVE */}
                    <span
                      className="text-[11px] leading-none"
                      style={{
                        color: isSelected
                          ? '#6366f1'
                          : dow === 0 ? '#f87171' : dow === 6 ? '#60a5fa' : hasBooks ? '#1D1D1F' : '#AEAEB2',
                        fontWeight: hasBooks || isSelected ? 700 : 500,
                      }}
                    >
                      {day}
                    </span>

                    {/* Cover thumbnail — 약간 좁게 */}
                    <div
                      className="rounded-md overflow-hidden relative"
                      style={{
                        width: '82%',
                        aspectRatio: '2 / 3',
                        background: hasBooks
                          ? coverBook ? 'transparent' : 'linear-gradient(135deg, #818CF8, #C084FC)'
                          : 'transparent',
                        boxShadow: hasBooks ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
                        outline: isSelected ? '2px solid #6366f1' : 'none',
                        outlineOffset: 2,
                      }}
                    >
                      {coverBook && (
                        <img src={coverBook.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      )}
                      {hasBooks && !coverBook && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {dayBooksArr[0].title.slice(0, 1)}
                          </span>
                        </div>
                      )}
                      {hasBooks && dayBooksArr.length > 1 && (
                        <div className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#1D1D1F] flex items-center justify-center border-2 border-white">
                          <span className="text-white text-[8px] font-bold leading-none">+{dayBooksArr.length - 1}</span>
                        </div>
                      )}
                    </div>
                  </button>
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
          {calSelectedDay !== null && calDayBooks[calSelectedDay] && (
            <div className="mt-4 pt-4 border-t border-[#F5F5F7] space-y-2">
              <p className="text-xs font-semibold text-[#6E6E73]">{calDisplayMonth + 1}월 {calSelectedDay}일 완독</p>
              {calDayBooks[calSelectedDay].map((book) => (
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
                  {book.rating > 0 && <span className="text-amber-400 text-sm flex-shrink-0">{'★'.repeat(book.rating)}</span>}
                </Link>
              ))}
            </div>
          )}

          {calMonthDoneCount === 0 && (
            <p className="text-center text-[#AEAEB2] text-xs py-4">이 달에 완독한 책이 없어요</p>
          )}
        </div>

        {/* ── 매일 얼마나 읽었는지 (북베어 스타일) ── */}
        {hasDailyData && (
          <div className="bg-white rounded-2xl p-5 sm:p-6 mb-4" style={cs}>
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-sm font-semibold text-[#1D1D1F]">매일 얼마나 읽었는지</h2>
              <p className="text-[10px] text-[#AEAEB2]">최근 14일</p>
            </div>
            <p className="text-[11px] text-[#AEAEB2] mb-4">막대에 마우스를 올리면 책의 진행률이 보여요</p>
            <div className="flex items-end justify-between gap-1" style={{ height: 110 }}>
              {dailyChart.map((d) => {
                const h = d.pages > 0 ? Math.max((d.pages / maxDaily) * 80 + 10, 14) : 4;
                const pctOfBook = d.book?.pages && d.book.pages > 0
                  ? Math.round((d.pages / d.book.pages) * 100)
                  : null;
                const tip = d.pages > 0
                  ? d.book
                    ? `${d.label} · ${d.pages}p${pctOfBook !== null ? ` (${d.book.title}의 ${pctOfBook}%)` : ` (${d.book.title})`}`
                    : `${d.label} · ${d.pages}p`
                  : `${d.label} · 기록 없음`;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group" title={tip}>
                    <div className="w-full flex flex-col items-center justify-end" style={{ height: 92 }}>
                      {d.pages > 0 && (
                        <span className="text-[9px] font-semibold mb-0.5 transition-colors"
                          style={{ color: d.isToday ? '#3B7DE8' : '#86848A' }}>
                          {d.pages}p
                        </span>
                      )}
                      <div
                        className="w-full rounded-lg transition-all duration-500 group-hover:opacity-80"
                        style={{
                          height: h,
                          background: d.isToday
                            ? 'linear-gradient(180deg, #4F8EF7, #3B7DE8)'
                            : d.pages > 0
                            ? '#D1E5FF'
                            : '#F0F0F5',
                          minHeight: 4,
                          maxWidth: 24,
                        }}
                      />
                    </div>
                    <p className="text-[9px] font-medium leading-tight" style={{ color: d.isToday ? '#3B7DE8' : '#AEAEB2' }}>
                      {d.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 월별 완독 차트 ── */}
        {yearDone.length > 0 && (
          <div className="bg-white rounded-2xl p-5 sm:p-6 mb-4" style={cs}>
            <h2 className="text-sm font-semibold text-[#1D1D1F] mb-5">월별 완독 권수</h2>
            <div className="space-y-2.5">
              {monthlyCounts.map((count, i) => count > 0 && (
                <div key={i} className="flex items-center gap-3">
                  <p className="text-xs text-[#6E6E73] w-8 flex-shrink-0 text-right">{i + 1}월</p>
                  <div className="flex-1 bg-[#F5F5F7] rounded-full h-6 overflow-hidden">
                    <div className="h-full rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                      style={{
                        width: `${Math.max((count / maxMonthly) * 100, 12)}%`,
                        background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                      }}>
                      <span className="text-white text-xs font-semibold">{count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 월별 페이지 차트 ── */}
        {hasPageData && (
          <div className="bg-white rounded-2xl p-5 sm:p-6 mb-4" style={cs}>
            <h2 className="text-sm font-semibold text-[#1D1D1F] mb-5">월별 독서 페이지</h2>
            <div className="space-y-2.5">
              {monthlyPages.map((pages, i) => pages > 0 && (
                <div key={i} className="flex items-center gap-3">
                  <p className="text-xs text-[#6E6E73] w-8 flex-shrink-0 text-right">{i + 1}월</p>
                  <div className="flex-1 bg-[#F5F5F7] rounded-full h-6 overflow-hidden">
                    <div className="h-full rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                      style={{
                        width: `${Math.max((pages / maxPages) * 100, 12)}%`,
                        background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                      }}>
                      <span className="text-white text-xs font-semibold">{pages}p</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
