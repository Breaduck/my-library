import { Link } from 'react-router-dom';
import { Book } from '@/types';

// 책갈피 탭 색상 (표지 위로 살짝 튀어나옴)
const TAB_COLORS = [
  '#2DD4BF', '#FB7185', '#A78BFA', '#FBBF24', '#60A5FA',
  '#34D399', '#F472B6', '#38BDF8', '#FB923C', '#4ADE80',
];

const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #4338ca)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #ec4899, #be185d)',
  'linear-gradient(135deg, #10b981, #047857)',
  'linear-gradient(135deg, #06b6d4, #0e7490)',
];

const BOOKS_PER_SHELF = 3;

interface Props {
  books: Book[];
}

export default function BookShelf({ books }: Props) {
  if (books.length === 0) return null;

  const shelves: Book[][] = [];
  for (let i = 0; i < books.length; i += BOOKS_PER_SHELF) {
    shelves.push(books.slice(i, i + BOOKS_PER_SHELF));
  }

  return (
    <div className="px-1">
      {shelves.map((shelf, shelfIdx) => (
        <div key={shelfIdx} className="mb-1.5">
          {/* 한 칸(책들) */}
          <div className="grid grid-cols-3 gap-x-3 sm:gap-x-4 items-end px-2 pt-4">
            {shelf.map((book, bookIdx) => {
              const seed = book.title.charCodeAt(0) + bookIdx;
              const tab = TAB_COLORS[seed % TAB_COLORS.length];
              const grad = FALLBACK_GRADIENTS[seed % FALLBACK_GRADIENTS.length];
              return (
                <Link
                  key={book.id}
                  to={`/book/${book.id}`}
                  className="relative block group"
                  title={`${book.title} — ${book.author}`}
                >
                  {/* 책갈피 탭 */}
                  <span
                    className="absolute z-10"
                    style={{
                      top: -6, right: '20%', width: 9, height: 22,
                      background: tab, borderRadius: '2px 2px 0 0',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
                    }}
                  />
                  {/* 표지 (세워둔 책) */}
                  <div
                    className="relative overflow-hidden rounded-md transition-transform duration-200 group-hover:-translate-y-1.5"
                    style={{
                      aspectRatio: '2 / 3',
                      background: book.coverUrl ? '#fff' : grad,
                      boxShadow: '0 6px 14px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.14)',
                    }}
                  >
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-2">
                        <span className="text-white font-bold text-center leading-tight" style={{ fontSize: 12, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                          {book.title.length > 14 ? book.title.slice(0, 14) + '…' : book.title}
                        </span>
                      </div>
                    )}
                    {/* 상태 점 */}
                    <div className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full border border-white/70"
                      style={{
                        background:
                          book.status === 'done' ? '#34d399' :
                          book.status === 'reading' ? '#60a5fa' :
                          book.status === 'want' ? '#a78bfa' : '#9ca3af',
                      }} />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* 선반 널판 */}
          <div className="mx-1 rounded-full" style={{ height: 5, background: 'linear-gradient(180deg, #ECECF0 0%, #DcDce2 100%)' }} />
          {/* 선반 그림자 */}
          <div className="mx-2" style={{ height: 12, background: 'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, transparent 100%)' }} />
        </div>
      ))}
    </div>
  );
}
