import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Book } from '@/types';

interface Props {
  books: Book[]; // 해당 연도 완독 책
  year: number;
  totalReadingTime: number; // seconds
  onClose: () => void;
}

function fmtTime(s: number): string | null {
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}시간${m > 0 ? ` ${m}분` : ''}`;
  if (m > 0) return `${m}분`;
  return null;
}

export default function YearlyReportCard({ books, year, totalReadingTime, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const totalPages = books.reduce((s, b) => s + (b.pages ?? 0), 0);
  const rated = books.filter((b) => b.rating > 0);
  const avgRating = rated.length > 0 ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : null;
  // 최고의 책: 별점 우선, 동률이면 최근 완독
  const best = [...books].sort((a, b) =>
    (b.rating - a.rating) || (b.endDate || '').localeCompare(a.endDate || ''))[0];
  const thickest = [...books].filter((b) => b.pages).sort((a, b) => (b.pages ?? 0) - (a.pages ?? 0))[0];
  const covers = [...books].filter((b) => b.coverUrl)
    .sort((a, b) => b.rating - a.rating).slice(0, 5);
  const time = fmtTime(totalReadingTime);

  async function handleSave() {
    if (!ref.current) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(ref.current, { pixelRatio: 3, cacheBust: true });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `독서결산_${year}.png`;
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-5"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-[330px]">
        {/* 캡처 대상 카드 */}
        <div ref={ref} className="rounded-[28px] overflow-hidden relative"
          style={{ aspectRatio: '9 / 14', background: 'linear-gradient(160deg, #0C0C18 0%, #14102E 55%, #1a1040 100%)', boxShadow: '0 36px 90px rgba(0,0,0,0.6)' }}>
          {/* 은은한 빛 */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(90% 60% at 50% 0%, rgba(129,140,248,0.22), transparent 65%)' }} />

          <div className="relative h-full flex flex-col px-7 pt-9 pb-7">
            <p className="text-[10px] tracking-[0.3em] uppercase text-white/40">My Reading Report</p>
            <h2 className="mt-1 text-white text-[26px] font-extrabold tracking-tight">{year} 나의 독서</h2>

            {/* 표지 콜라주 */}
            {covers.length > 0 && (
              <div className="mt-5 flex items-end justify-center" style={{ height: 96 }}>
                {covers.map((b, i) => {
                  const mid = (covers.length - 1) / 2;
                  const off = i - mid;
                  return (
                    <div key={b.id} className="rounded-md overflow-hidden flex-shrink-0"
                      style={{
                        width: 56, height: 82,
                        transform: `translateX(${off * -8}px) rotate(${off * 6}deg) translateY(${Math.abs(off) * 5}px)`,
                        zIndex: 10 - Math.abs(off),
                        boxShadow: '0 10px 26px rgba(0,0,0,0.55)',
                        border: '1.5px solid rgba(255,255,255,0.14)',
                      }}>
                      <img src={b.coverUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* 핵심 숫자 */}
            <div className="mt-6 text-center">
              <p className="text-white font-extrabold leading-none" style={{ fontSize: 54, letterSpacing: '-0.03em' }}>
                {books.length}<span className="text-[22px] text-white/50 font-bold">권</span>
              </p>
              <p className="text-white/45 text-[12px] mt-1.5">한 해 동안 완독했어요</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {totalPages > 0 && (
                <div className="rounded-2xl px-3 py-2.5 text-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <p className="text-white text-[16px] font-bold tabular-nums">{totalPages.toLocaleString()}</p>
                  <p className="text-white/40 text-[10px] mt-0.5">읽은 페이지</p>
                </div>
              )}
              {avgRating && (
                <div className="rounded-2xl px-3 py-2.5 text-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <p className="text-amber-300 text-[16px] font-bold">★ {avgRating}</p>
                  <p className="text-white/40 text-[10px] mt-0.5">평균 별점</p>
                </div>
              )}
              {time && (
                <div className="rounded-2xl px-3 py-2.5 text-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <p className="text-white text-[15px] font-bold">{time}</p>
                  <p className="text-white/40 text-[10px] mt-0.5">누적 독서 시간</p>
                </div>
              )}
              {thickest && (
                <div className="rounded-2xl px-3 py-2.5 text-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <p className="text-white text-[13px] font-bold truncate">{thickest.title}</p>
                  <p className="text-white/40 text-[10px] mt-0.5">가장 두꺼운 책 · {thickest.pages}p</p>
                </div>
              )}
            </div>

            {/* 올해의 책 */}
            {best && (
              <div className="mt-auto pt-4">
                <div className="h-px mb-4" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent)' }} />
                <div className="flex items-center gap-3">
                  <div className="w-9 rounded-md overflow-hidden flex-shrink-0" style={{ height: 52, boxShadow: '0 6px 16px rgba(0,0,0,0.5)' }}>
                    {best.coverUrl
                      ? <img src={best.coverUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">{best.title.slice(0, 1)}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/40 text-[9.5px] tracking-[0.14em] uppercase">올해의 책</p>
                    <p className="text-white text-[13px] font-semibold truncate">{best.title}</p>
                    {best.rating > 0 && <p className="text-amber-300 text-[10.5px] mt-0.5">{'★'.repeat(best.rating)}</p>}
                  </div>
                </div>
                <p className="text-[9px] tracking-[0.22em] uppercase mt-5 text-center text-white/25">나의 서재</p>
              </div>
            )}
          </div>
        </div>

        {/* 액션 */}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white text-[#1D1D1F] text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-60">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {saving ? '저장 중...' : '이미지 저장'}
          </button>
          <button onClick={onClose}
            className="py-3.5 rounded-2xl bg-white/10 text-white text-sm font-medium border border-white/15 active:opacity-70 transition-opacity">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
