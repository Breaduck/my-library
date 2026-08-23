import { useState } from 'react';
import { Book } from '@/types';
import { useBooks } from '@/hooks/useBooks';
import { addDailyPages, subtractDailyPages, logDailyPages, getWeeklyPages, getTodayPages, markDailyPopupShown, localDate } from '@/lib/storage';

interface Props {
  readingBook?: Book;
  onClose: () => void;
  // 오늘 기록으로 총 페이지에 도달해 '읽는중' → '완독'으로 자동 전환됐을 때 호출 (축하 UI 등에 사용)
  onFinished?: (book: Book) => void;
}

export default function DailyReadingModal({ readingBook, onClose, onFinished }: Props) {
  const { updateBook } = useBooks();
  const weekly = getWeeklyPages();
  const maxPages = Math.max(...weekly.map((w) => w.pages), 1);
  const today = localDate();

  const hasBookPages = !!(readingBook && readingBook.pages && readingBook.pages > 0);
  const totalPages = readingBook?.pages ?? 0;
  const currentPage = readingBook?.currentPage ?? 0;

  // When the book has a known page count, input is cumulative "current page".
  // Otherwise it's a free-form "today's pages" number.
  const [input, setInput] = useState<string>(() => {
    if (hasBookPages) return String(currentPage || '');
    return String(getTodayPages() || '');
  });

  const parsedInput = parseInt(input || '0', 10) || 0;
  const previewPct = hasBookPages
    ? Math.max(0, Math.min(100, Math.round((parsedInput / totalPages) * 100)))
    : null;

  function handleConfirm() {
    if (hasBookPages && readingBook) {
      const newCurrent = Math.max(0, Math.min(parsedInput, totalPages));
      const delta = newCurrent - currentPage;
      if (delta > 0) addDailyPages(delta, readingBook.id);
      else if (delta < 0) subtractDailyPages(-delta, readingBook.id); // 잘못 입력했던 만큼 오늘 기록에서 되돌림
      // 총 페이지에 도달하면 '읽는중'에 머물러 있지 말고 자동으로 완독 처리
      const justFinished = newCurrent >= totalPages && readingBook.status !== 'done';
      if (newCurrent !== currentPage || justFinished) {
        updateBook(readingBook.id, {
          currentPage: newCurrent,
          ...(justFinished ? { status: 'done', endDate: readingBook.endDate || localDate() } : {}),
        });
      }
      markDailyPopupShown();
      onClose();
      if (justFinished) onFinished?.(readingBook);
      return;
    } else if (parsedInput > 0) {
      logDailyPages(parsedInput, readingBook?.id);
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
          <h2 className="text-base font-bold text-[#1D1D1F] mb-1">
            {hasBookPages ? '어디까지 읽으셨나요?' : '오늘도 즐거운 독서하셨나요?'}
          </h2>
          <p className="text-[#6E6E73] text-sm mb-5">
            {hasBookPages
              ? `현재 페이지를 입력하면 진행률이 갱신돼요 · 총 ${totalPages}쪽`
              : '오늘 읽은 페이지 수를 기록해보세요'}
          </p>

          {/* Page input */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-[#F5F5F7] rounded-2xl">
              <svg className="w-4 h-4 text-[#AEAEB2] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <input
                type="number"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="0"
                min="0"
                max={hasBookPages ? totalPages : undefined}
                className="flex-1 bg-transparent text-lg font-bold text-[#1D1D1F] outline-none w-full"
                style={{ fontSize: 20 }}
                autoFocus
              />
              <span className="text-[#AEAEB2] text-sm flex-shrink-0">
                {hasBookPages ? `/ ${totalPages}p` : 'p'}
              </span>
            </div>
          </div>

          {/* Live progress preview */}
          {previewPct !== null && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-[#86848A]">
                  {parsedInput > currentPage
                    ? <>오늘 <span className="font-semibold text-[#1D1D1F]">+{Math.max(0, parsedInput - currentPage)}쪽</span> 더 읽었어요</>
                    : <>현재 진행률</>}
                </span>
                <span className="text-[12px] font-bold text-[#1D1D1F]">{previewPct}%</span>
              </div>
              <div className="h-2 bg-[#F0F0F5] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${previewPct}%`, background: 'linear-gradient(90deg, #4F8EF7, #3B7DE8)' }} />
              </div>
            </div>
          )}

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
                      {isToday ? '오늘' : day.label}
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
