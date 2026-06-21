import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Book } from '@/types';

interface Props {
  books: Book[];
  year: number;
  month: number;
  onClose: () => void;
}

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export default function MonthlyShareCard({ books, year, month, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const dayBooks: Record<number, Book> = {};
  books.forEach((b) => {
    if (!b.endDate) return;
    const d = new Date(b.endDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      dayBooks[d.getDate()] = b;
    }
  });

  const count = Object.keys(dayBooks).length;

  async function handleSave() {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `나의서재_${year}년${month + 1}월.png`;
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('링크가 복사되었어요');
    } catch {}
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full sm:max-w-sm"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        {/* The shareable card */}
        <div
          ref={cardRef}
          className="mx-4 rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #1a1035 0%, #0d0d1a 100%)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div className="px-6 pt-7 pb-5">
            <p className="text-white/50 text-xs font-medium tracking-widest uppercase mb-2">
              {year}년 {MONTH_NAMES[month]}
            </p>
            <h2 className="text-white text-xl font-bold leading-snug">
              {MONTH_NAMES[month]}에{' '}
              <span
                className="font-black"
                style={{
                  background: 'linear-gradient(90deg, #a78bfa, #60a5fa)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {count}권
              </span>{' '}
              완독했어요!
            </h2>
          </div>

          {/* Calendar */}
          <div className="px-4 pb-5">
            <div className="bg-white/5 rounded-2xl p-4">
              {/* Week day headers */}
              <div className="grid grid-cols-7 mb-2">
                {WEEK_DAYS.map((d, i) => (
                  <div
                    key={d}
                    className="text-center text-[9px] font-medium py-1"
                    style={{ color: i === 0 ? '#f87171' : i === 6 ? '#60a5fa' : 'rgba(255,255,255,0.3)' }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-y-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                  const book = dayBooks[day];
                  const dow = (firstDay + day - 1) % 7;
                  return (
                    <div key={day} className="flex flex-col items-center gap-0.5">
                      {book ? (
                        <div
                          className="w-7 h-7 rounded-lg overflow-hidden"
                          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
                        >
                          {book.coverUrl ? (
                            <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center text-white text-[8px] font-bold"
                              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                            >
                              {book.title.slice(0, 1)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-medium"
                          style={{
                            color: dow === 0 ? 'rgba(248,113,113,0.7)' : dow === 6 ? 'rgba(96,165,250,0.7)' : 'rgba(255,255,255,0.35)',
                          }}
                        >
                          {day}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer branding */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                </svg>
              </div>
              <span className="text-white/60 text-xs font-medium">나의 서재</span>
            </div>
            <p className="text-white/30 text-[10px]">{year}.{String(month + 1).padStart(2, '0')}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white text-[#1D1D1F] text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {saving ? '저장 중...' : '이미지 저장'}
          </button>
          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/10 text-white text-sm font-medium border border-white/10 active:scale-[0.98] transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            링크 복사
          </button>
        </div>
        <button
          onClick={onClose}
          className="mx-4 mt-2 w-[calc(100%-32px)] py-3 rounded-2xl text-white/50 text-sm text-center active:opacity-70 transition-opacity"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
