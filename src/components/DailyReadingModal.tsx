import { useState } from 'react';
import { Book } from '@/types';
import { logDailyPages, getWeeklyPages, getTodayPages, markDailyPopupShown } from '@/lib/storage';

interface Props {
  readingBook?: Book;
  onClose: () => void;
}

export default function DailyReadingModal({ readingBook, onClose }: Props) {
  const weekly = getWeeklyPages();
  const maxPages = Math.max(...weekly.map((w) => w.pages), 1);
  const today = new Date().toISOString().slice(0, 10);
  const [pages, setPages] = useState(String(getTodayPages() || ''));

  function handleConfirm() {
    const n = parseInt(pages);
    if (n > 0) {
      logDailyPages(n, readingBook?.id);
    }
    markDailyPopupShown();
    onClose();
  }

  function handleSkip() {
    markDailyPopupShown();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && handleSkip()}
    >
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Book cover hero */}
        {readingBook && (
          <div className="relative h-32 overflow-hidden">
            {readingBook.coverUrl ? (
              <img
                src={readingBook.coverUrl}
                alt=""
                className="w-full h-full object-cover"
                style={{ filter: 'blur(20px)', transform: 'scale(1.2)' }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-600" />
            )}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.7))' }}
            />
            <div className="absolute inset-0 flex items-center justify-center gap-4">
              <div
                className="rounded-xl overflow-hidden flex-shrink-0"
                style={{ width: 52, height: 76, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
              >
                {readingBook.coverUrl ? (
                  <img src={readingBook.coverUrl} alt={readingBook.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                    {readingBook.title.slice(0, 2)}
                  </div>
                )}
              </div>
              <div>
                <p className="text-white font-semibold text-sm line-clamp-2 leading-snug max-w-[160px]">
                  {readingBook.title}
                </p>
                <p className="text-white/60 text-xs mt-0.5">{readingBook.author}</p>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 pt-5">
          <h2 className="text-base font-bold text-[#1D1D1F] mb-1">오늘도 즐거운 독서하셨나요?</h2>
          <p className="text-[#6E6E73] text-sm mb-5">오늘 읽은 페이지 수를 기록해보세요</p>

          {/* Page input */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-[#F5F5F7] rounded-2xl">
              <svg className="w-4 h-4 text-[#AEAEB2] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <input
                type="number"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                placeholder="0"
                min="0"
                className="flex-1 bg-transparent text-lg font-bold text-[#1D1D1F] outline-none w-full"
                style={{ fontSize: 20 }}
                autoFocus
              />
              <span className="text-[#AEAEB2] text-sm flex-shrink-0">p</span>
            </div>
          </div>

          {/* Weekly bar chart */}
          <div className="mb-6">
            <p className="text-xs font-medium text-[#6E6E73] mb-3">이번 주 독서 기록</p>
            <div className="flex items-end justify-between gap-1" style={{ height: 72 }}>
              {weekly.map((day) => {
                const isToday = day.date === today;
                const height = day.pages > 0 ? Math.max((day.pages / maxPages) * 56 + 8, 16) : 4;
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center" style={{ height: 60 }}>
                      <div
                        className="w-full rounded-lg transition-all duration-500"
                        style={{
                          height,
                          background: isToday
                            ? 'linear-gradient(180deg, #4F8EF7, #3B7DE8)'
                            : day.pages > 0
                            ? '#D1E5FF'
                            : '#F0F0F5',
                          minHeight: 4,
                        }}
                      />
                    </div>
                    {day.pages > 0 && (
                      <p className="text-[9px] font-semibold" style={{ color: isToday ? '#3B7DE8' : '#AEAEB2' }}>
                        {day.pages}
                      </p>
                    )}
                    <p
                      className="text-[10px] font-medium"
                      style={{ color: isToday ? '#3B7DE8' : '#AEAEB2' }}
                    >
                      {day.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 py-3.5 rounded-2xl bg-[#F5F5F7] text-[#6E6E73] text-sm font-medium active:opacity-70 transition-opacity"
            >
              건너뛰기
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3.5 rounded-2xl text-white text-sm font-semibold active:scale-[0.98] transition-all"
              style={{ background: 'linear-gradient(135deg, #4F8EF7, #3B7DE8)' }}
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
