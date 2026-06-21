import { Link } from 'react-router-dom';
import { Book } from '@/types';
import { STATUS_META } from './BookCard';
import StarRating from './StarRating';

const STATUS_BADGE: Record<string, string> = {
  want:    'bg-purple-50 text-purple-500',
  reading: 'bg-blue-50 text-blue-500',
  done:    'bg-emerald-50 text-emerald-600',
  stopped: 'bg-gray-100 text-gray-500',
};

function formatDateShort(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const PLACEHOLDER_COLORS = [
  { bg: '#E8F4FD', text: '#2563EB' },
  { bg: '#FEF3C7', text: '#D97706' },
  { bg: '#FCE7F3', text: '#DB2777' },
  { bg: '#F0FDF4', text: '#16A34A' },
  { bg: '#F5F3FF', text: '#7C3AED' },
  { bg: '#FFF7ED', text: '#EA580C' },
];

export default function BookListItem({ book }: { book: Book }) {
  const meta = STATUS_META[book.status ?? 'done'];
  const color = PLACEHOLDER_COLORS[book.title.charCodeAt(0) % PLACEHOLDER_COLORS.length];

  return (
    <Link to={`/book/${book.id}`} className="block">
      <div
        className="bg-white rounded-2xl flex items-center gap-4 p-4 active:bg-gray-50 transition-colors"
        style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
      >
        {/* Cover */}
        <div className="flex-shrink-0 w-12 h-[72px] rounded-xl overflow-hidden">
          {book.coverUrl
            ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
            : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: color.bg }}>
                <span className="text-base font-bold" style={{ color: color.text }}>{book.title.slice(0, 2)}</span>
              </div>
            )
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#1D1D1F] text-sm truncate">{book.title}</p>
          <p className="text-[#6E6E73] text-xs mt-0.5 truncate">{book.author}</p>
          {book.oneLiner && (
            <p className="text-[#AEAEB2] text-xs mt-1 italic truncate">&ldquo;{book.oneLiner}&rdquo;</p>
          )}
          {book.status === 'reading' && book.currentPage && book.pages && (
            <div className="mt-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(Math.round(book.currentPage/book.pages*100),100)}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
                </div>
                <span className="text-[10px] text-indigo-500 font-medium">{Math.min(Math.round(book.currentPage/book.pages*100),100)}%</span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {book.status === 'done' && book.rating > 0 && <StarRating value={book.rating} readonly size="sm" />}
            {book.status === 'done' && book.endDate && (
              <span className="text-[#AEAEB2] text-[10px]">{formatDateShort(book.endDate)}</span>
            )}
          </div>
        </div>

        {/* Status / arrow */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {book.status !== 'done' && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[book.status]}`}>
              {meta.label}
            </span>
          )}
          <svg className="w-4 h-4 text-[#D1D1D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
