import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '@/hooks/useBooks';
import { Book } from '@/types';
import { getReadingStreak } from '@/lib/storage';

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
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [goal, setGoal] = useState(12);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('12');
  const [calendarMonth, setCalendarMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

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

  const calMonthDayBooks = calendarMonth !== null
    ? buildDayBooks(yearDone, selectedYear, calendarMonth)
    : {};
  const calFirstDay = calendarMonth !== null ? new Date(selectedYear, calendarMonth, 1).getDay() : 0;
  const calTotalDays = calendarMonth !== null ? new Date(selectedYear, calendarMonth + 1, 0).getDate() : 0;

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 sm:pt-12"
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
            <button key={y} onClick={() => { setSelectedYear(y); setCalendarMonth(null); setSelectedDay(null); }}
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
            { label: '읽음',      count: done.length,    color: 'text-emerald-600', bg: 'bg-emerald-50' },
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
        {yearDone.length > 0 && (
          <div className="bg-white rounded-2xl p-5 sm:p-6 mb-4" style={cs}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#1D1D1F]">{selectedYear}년 독서 달력</h2>
              <p className="text-[10px] text-[#AEAEB2]">월을 탭해 일별 보기</p>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {MONTHS.map((m, i) => {
                const count = monthlyCounts[i];
                const intensity = count === 0 ? 0 : Math.min(count / maxMonthly, 1);
                const isSelected = calendarMonth === i;
                return (
                  <button key={m}
                    onClick={() => {
                      if (count === 0) return;
                      setCalendarMonth(calendarMonth === i ? null : i);
                      setSelectedDay(null);
                    }}
                    className="flex flex-col items-center gap-1.5 group"
                    disabled={count === 0}>
                    <div
                      className="w-full aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all"
                      style={{
                        backgroundColor: isSelected
                          ? '#1D1D1F'
                          : count > 0
                          ? `rgba(99,102,241,${0.12 + intensity * 0.78})`
                          : '#F5F5F7',
                        color: isSelected ? '#fff' : count > 0 ? (intensity > 0.45 ? '#fff' : '#4338ca') : '#D1D1D6',
                        boxShadow: isSelected ? '0 2px 12px rgba(0,0,0,0.2)' : 'none',
                        transform: isSelected ? 'scale(1.06)' : 'none',
                      }}>
                      {count > 0 ? count : ''}
                    </div>
                    <span className={`text-[10px] ${count > 0 ? 'text-[#6E6E73]' : 'text-[#D1D1D6]'}`}>{m}</span>
                  </button>
                );
              })}
            </div>

            {/* 월별 일별 달력 (인라인 확장) */}
            {calendarMonth !== null && (
              <div className="mt-5 pt-5 border-t border-[#F5F5F7]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-[#1D1D1F]">{selectedYear}년 {calendarMonth + 1}월</p>
                  <button onClick={() => { setCalendarMonth(null); setSelectedDay(null); }}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-[#F5F5F7] text-[#6E6E73] text-sm">×</button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {WEEK_DAYS.map((d, i) => (
                    <div key={d} className={`text-center text-[10px] font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-[#AEAEB2]'}`}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1">
                  {Array.from({ length: calFirstDay }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: calTotalDays }, (_, i) => i + 1).map((day) => {
                    const dayBooksArr = calMonthDayBooks[day] || [];
                    const hasBooks = dayBooksArr.length > 0;
                    const isSelected = selectedDay === day;
                    const dow = (calFirstDay + day - 1) % 7;
                    return (
                      <button key={day}
                        onClick={() => hasBooks && setSelectedDay(isSelected ? null : day)}
                        className="flex flex-col items-center py-0.5"
                        disabled={!hasBooks}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                          isSelected ? 'bg-[#1D1D1F] text-white' :
                          hasBooks ? 'bg-indigo-100 text-indigo-700' :
                          'text-[#1D1D1F]'
                        } ${dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : ''} ${isSelected ? 'text-white' : ''}`}
                          style={isSelected ? { color: '#fff' } : {}}>
                          {day}
                        </div>
                        {hasBooks && (
                          <div className="flex gap-0.5 mt-0.5">
                            {dayBooksArr.slice(0, 3).map((_, bi) => (
                              <div key={bi} className="w-1 h-1 rounded-full bg-indigo-400" />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedDay !== null && calMonthDayBooks[selectedDay] && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold text-[#6E6E73]">{calendarMonth + 1}월 {selectedDay}일 완독</p>
                    {calMonthDayBooks[selectedDay].map((book) => (
                      <Link key={book.id} to={`/book/${book.id}`}
                        className="flex items-center gap-3 bg-[#F5F5F7] rounded-xl p-3 active:opacity-70 transition-opacity">
                        <div className="w-9 rounded-lg overflow-hidden flex-shrink-0" style={{ height: 48 }}>
                          {book.coverUrl
                            ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">{book.title.slice(0,2)}</div>
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
              </div>
            )}
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
    </div>
  );
}
