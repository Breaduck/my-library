import { SharedBook } from '@/lib/social';

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

export default function FriendBookStack({ books, onOpen }: { books: SharedBook[]; onOpen: (b: SharedBook) => void }) {
  if (books.length === 0) return null;

  const shelves: SharedBook[][] = [];
  for (let i = 0; i < books.length; i += BOOKS_PER_SHELF) {
    shelves.push(books.slice(i, i + BOOKS_PER_SHELF));
  }

  return (
    <div className="rounded-3xl bg-white px-2 py-3" style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.05)' }}>
      {shelves.map((shelf, shelfIdx) => (
        <div key={shelfIdx} className="mb-1">
          <div className="grid grid-cols-3 items-end px-2 pt-4">
            {shelf.map((book, bookIdx) => {
              const seed = book.title.charCodeAt(0) + bookIdx;
              const tab = TAB_COLORS[seed % TAB_COLORS.length];
              const grad = FALLBACK_GRADIENTS[seed % FALLBACK_GRADIENTS.length];
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => onOpen(book)}
                  className="block group text-left"
                  title={`${book.title} — ${book.author}`}
                >
                  <div className="relative mx-auto" style={{ width: '70%' }}>
                    <span className="absolute z-10"
                      style={{ top: -5, right: '18%', width: 8, height: 18, background: tab, borderRadius: '2px 2px 0 0', boxShadow: '0 1px 2px rgba(0,0,0,0.18)' }} />
                    <div className="relative overflow-hidden rounded transition-transform duration-200 group-hover:-translate-y-1"
                      style={{ aspectRatio: '2 / 3', background: book.coverUrl ? '#fff' : grad, boxShadow: '0 4px 10px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.12)' }}>
                      {book.coverUrl ? (
                        <img src={book.coverUrl} alt={book.title} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center p-1.5">
                          <span className="text-white font-bold text-center leading-tight" style={{ fontSize: 10, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                            {book.title.length > 14 ? book.title.slice(0, 14) + '…' : book.title}
                          </span>
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full border border-white/70"
                        style={{
                          background:
                            book.status === 'done' ? '#34d399' :
                            book.status === 'reading' ? '#60a5fa' :
                            book.status === 'want' ? '#a78bfa' : '#9ca3af',
                        }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mx-1 rounded-full" style={{ height: 3, background: '#EDEDF0' }} />
          <div className="mx-2" style={{ height: 10, background: 'linear-gradient(180deg, rgba(0,0,0,0.07) 0%, transparent 100%)' }} />
        </div>
      ))}
    </div>
  );
}
