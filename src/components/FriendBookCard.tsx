import { SharedBook } from '@/lib/social';
import { STATUS_META } from '@/components/BookCard';

const GRADIENTS = [
  'from-blue-600 to-indigo-800',
  'from-amber-500 to-orange-700',
  'from-pink-500 to-rose-700',
  'from-emerald-500 to-teal-700',
  'from-violet-500 to-purple-700',
  'from-orange-500 to-red-700',
];

export default function FriendBookCard({ book, onOpen }: { book: SharedBook; onOpen: () => void }) {
  const meta = STATUS_META[(book.status as keyof typeof STATUS_META) ?? 'done'];
  const grad = GRADIENTS[book.title.charCodeAt(0) % GRADIENTS.length];

  return (
    <button type="button" onClick={onOpen} className="block group text-left w-full">
      <div
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl cursor-pointer transition-transform duration-200 group-hover:-translate-y-1.5"
        style={{ aspectRatio: '2 / 3', boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)' }}
      >
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${grad} flex items-end justify-start p-3`}>
            <span className="text-white/20 font-black" style={{ fontSize: 64, lineHeight: 1, letterSpacing: '-0.05em' }}>
              {book.title.slice(0, 1)}
            </span>
          </div>
        )}

        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 35%, rgba(0,0,0,0.12) 55%, rgba(0,0,0,0.85) 100%)' }} />

        {book.status === 'reading' && book.currentPage > 0 && book.pages > 0 && (() => {
          const pct = Math.round(Math.min(book.currentPage / book.pages, 1) * 100);
          return (
            <>
              <div className="absolute right-2.5" style={{ bottom: 52 }}>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white backdrop-blur-sm" style={{ background: 'rgba(59,125,232,0.85)' }}>
                  {pct}%
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                <div className="h-full" style={{ width: `${pct}%`, background: '#3B7DE8' }} />
              </div>
            </>
          );
        })()}

        {book.status !== 'done' && meta && (
          <div className="absolute top-2.5 right-2.5">
            <span className={`flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-full border backdrop-blur-sm ${meta.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>
        )}

        {book.status === 'done' && book.rating > 0 && (
          <div className="absolute top-2.5 left-2.5">
            <span className="flex items-center gap-0.5 text-[10px] font-semibold px-2 py-1 rounded-full backdrop-blur-sm bg-black/30 text-amber-300 border border-white/10">
              ★ {book.rating}
            </span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-6">
          <h3 className="text-white font-semibold text-xs sm:text-sm leading-snug line-clamp-2 mb-0.5" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
            {book.title}
          </h3>
          <p className="text-white/60 text-[10px] sm:text-xs truncate">{book.author}</p>
        </div>
      </div>
    </button>
  );
}
