import { useMemo } from 'react';
import { Book } from '@/types';

interface Props {
  book: Book;          // 방금 완독한 책
  doneCount: number;   // 이 책을 포함한 총 완독 권수
  nextBook?: Book;     // '읽을 예정' 중 다음 책 추천
  onShare: () => void;
  onStartNext: (book: Book) => void;
  onClose: () => void;
}

const CONFETTI_COLORS = ['#4F8EF7', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6', '#EC4899', '#FBBF24'];

export default function CompletionCelebration({ book, doneCount, nextBook, onShare, onStartNext, onClose }: Props) {
  // 렌더마다 위치가 바뀌지 않도록 결정적(인덱스 기반) 랜덤
  const pieces = useMemo(() =>
    Array.from({ length: 44 }, (_, i) => ({
      left: (i * 37 + 11) % 100,
      delay: ((i * 13) % 12) / 10,
      dur: 2.4 + ((i * 7) % 12) / 6,
      size: 6 + (i % 3) * 3,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: i % 4 === 0,
    })), []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>

      {/* 컨페티 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {pieces.map((p, i) => (
          <span key={i} className="absolute block"
            style={{
              left: `${p.left}%`,
              top: '-4vh',
              width: p.size,
              height: p.round ? p.size : p.size * 1.8,
              background: p.color,
              borderRadius: p.round ? '50%' : 2,
              animation: `confetti-fall ${p.dur}s ${p.delay}s ease-in both`,
            }} />
        ))}
      </div>

      <div className="w-full max-w-[320px] rounded-3xl p-7 text-center relative animate-[pop_0.22s_ease-out]"
        style={{ background: 'var(--card, #fff)', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
        <style>{`@keyframes pop{from{transform:scale(0.85);opacity:0}to{transform:scale(1);opacity:1}}`}</style>

        {/* 표지 */}
        <div className="mx-auto rounded-xl overflow-hidden"
          style={{ width: 96, height: 140, boxShadow: '0 16px 40px rgba(0,0,0,0.35)' }}>
          {book.coverUrl
            ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center">
                <span className="text-white text-xl font-black">{book.title.slice(0, 2)}</span>
              </div>}
        </div>

        <p className="mt-5 text-[13px] font-semibold text-[#3B7DE8] tracking-wide">🎉 {doneCount}권째 완독!</p>
        <h3 className="mt-1 text-[19px] font-extrabold text-[#1D1D1F] tracking-tight leading-snug line-clamp-2">{book.title}</h3>
        <p className="mt-1.5 text-[12.5px] text-[#86848A]">끝까지 읽어낸 스스로를 축하해주세요</p>

        <button onClick={onShare}
          className="mt-5 w-full py-3.5 rounded-2xl bg-[#1D1D1F] text-white text-sm font-semibold hover:bg-[#3A3A3C] active:scale-[0.98] transition-all">
          공유 카드 만들기
        </button>

        {nextBook && (
          <div className="mt-3 rounded-2xl p-3 flex items-center gap-3 text-left"
            style={{ background: 'var(--surface-2, #F5F5F7)' }}>
            <div className="w-9 rounded-md overflow-hidden flex-shrink-0" style={{ height: 52 }}>
              {nextBook.coverUrl
                ? <img src={nextBook.coverUrl} alt={nextBook.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">{nextBook.title.slice(0, 2)}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] text-[#86848A]">다음은 이 책 어때요?</p>
              <p className="text-[12.5px] font-semibold text-[#1D1D1F] truncate">{nextBook.title}</p>
            </div>
            <button onClick={() => onStartNext(nextBook)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full bg-[#3B7DE8] text-white text-[11px] font-bold active:scale-95 transition-transform">
              바로 시작
            </button>
          </div>
        )}

        <button onClick={onClose} className="mt-3 text-[12px] text-[#AEAEB2] hover:text-[#6E6E73] transition-colors">
          닫기
        </button>
      </div>
    </div>
  );
}
