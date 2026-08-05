import { useState } from 'react';
import { SharedBook } from '@/lib/social';

const SPINE_GRADIENTS = [
  'linear-gradient(180deg, #6366f1, #4338ca)',
  'linear-gradient(180deg, #f59e0b, #d97706)',
  'linear-gradient(180deg, #ec4899, #be185d)',
  'linear-gradient(180deg, #10b981, #047857)',
  'linear-gradient(180deg, #8b5cf6, #6d28d9)',
  'linear-gradient(180deg, #f97316, #c2410c)',
  'linear-gradient(180deg, #06b6d4, #0e7490)',
  'linear-gradient(180deg, #84cc16, #4d7c0f)',
  'linear-gradient(180deg, #ef4444, #b91c1c)',
  'linear-gradient(180deg, #a855f7, #7e22ce)',
];

const BOOKS_PER_SHELF = 6;

export default function FriendBookShelf({ books, onOpen }: { books: SharedBook[]; onOpen: (b: SharedBook) => void }) {
  const [flippedId, setFlippedId] = useState<string | null>(null);
  if (books.length === 0) return null;

  const shelves: SharedBook[][] = [];
  for (let i = 0; i < books.length; i += BOOKS_PER_SHELF) {
    shelves.push(books.slice(i, i + BOOKS_PER_SHELF));
  }

  return (
    <div className="space-y-0">
      <style>{`@keyframes flipIn{from{transform:translateY(-6px) rotateY(-78deg);opacity:0}to{transform:translateY(-6px) rotateY(0);opacity:1}}`}</style>
      {shelves.map((shelf, shelfIdx) => (
        <div key={shelfIdx} className="relative">
          <div className="flex items-end gap-1 px-2 pt-5 pb-0" style={{ minHeight: 206 }}>
            {shelf.map((book, bookIdx) => {
              const gradIdx = (book.title.charCodeAt(0) + bookIdx) % SPINE_GRADIENTS.length;
              const gradient = SPINE_GRADIENTS[gradIdx];
              const heightVariance = ((book.title.charCodeAt(0) + bookIdx * 3) % 3) * 10;
              const spineHeight = 158 + heightVariance;
              const widthVariance = ((book.title.charCodeAt(1) ?? 0) + bookIdx) % 4;
              const spineWidth = 30 + widthVariance * 3;
              const coverW = Math.round(spineHeight * 0.66);
              const isFlipped = flippedId === book.id;

              return (
                <div key={book.id} className="flex-shrink-0 relative"
                  style={{ width: isFlipped ? coverW : spineWidth, height: spineHeight, transition: 'width 0.3s ease', zIndex: isFlipped ? 30 : undefined }}>
                  {isFlipped ? (
                    <button
                      type="button"
                      onClick={() => onOpen(book)}
                      title={book.title}
                      className="block w-full h-full rounded overflow-hidden"
                      style={{ transform: 'translateY(-6px)', boxShadow: '0 14px 30px rgba(0,0,0,0.42)', animation: 'flipIn 0.3s ease', background: book.coverUrl ? '#fff' : gradient }}
                    >
                      {book.coverUrl
                        ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center p-1"><span className="text-white text-[11px] font-bold text-center leading-tight">{book.title}</span></div>}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFlippedId(book.id)}
                      className="group relative w-full h-full"
                      title={`${book.title} — ${book.author}`}
                    >
                      <div
                        className="relative overflow-hidden rounded-t-sm transition-transform duration-150 hover:-translate-y-2"
                        style={{
                          width: spineWidth, height: spineHeight,
                          background: book.coverUrl ? undefined : gradient,
                          boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.2), inset 2px 0 2px rgba(255,255,255,0.1)',
                        }}
                      >
                        {book.coverUrl && (
                          <img src={book.coverUrl} alt={book.title} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: 'left center' }} />
                        )}
                        {book.coverUrl && <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.15)' }} />}

                        <div className="absolute inset-0 flex items-center justify-center" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                          <span className="text-white font-semibold leading-none select-none"
                            style={{ fontSize: 11, textShadow: '0 1px 3px rgba(0,0,0,0.6)', maxHeight: spineHeight - 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                            {book.title}
                          </span>
                        </div>

                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                          <div className="w-1 h-1 rounded-full" style={{
                            background:
                              book.status === 'done' ? '#34d399' :
                              book.status === 'reading' ? '#60a5fa' :
                              book.status === 'want' ? '#a78bfa' : '#9ca3af',
                          }} />
                        </div>
                      </div>

                      {(() => {
                        const isFirst = bookIdx === 0;
                        const isLast = bookIdx === shelf.length - 1;
                        const posClass = isLast ? 'right-0' : isFirst ? 'left-0' : 'left-1/2 -translate-x-1/2';
                        const arrowClass = isLast ? 'ml-auto mr-2.5' : isFirst ? 'ml-2.5' : 'mx-auto';
                        return (
                          <div className={`absolute bottom-full ${posClass} mb-2 z-30 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity`} style={{ transitionDelay: '0.2s' }}>
                            <div className="bg-[#1D1D1F] text-white rounded-lg px-2 py-1.5 whitespace-nowrap" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontSize: 10 }}>
                              <p className="font-semibold leading-tight max-w-[120px] truncate">{book.title}</p>
                              <p className="opacity-60 leading-tight max-w-[120px] truncate">{book.author}</p>
                            </div>
                            <div className={`w-0 h-0 ${arrowClass}`} style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid #1D1D1F' }} />
                          </div>
                        );
                      })()}
                    </button>
                  )}
                </div>
              );
            })}

            {shelf.length < BOOKS_PER_SHELF && Array.from({ length: BOOKS_PER_SHELF - shelf.length }).map((_, i) => (
              <div key={`ghost-${i}`} className="flex-shrink-0" style={{ width: 34, height: 158 }} />
            ))}
          </div>

          <div className="mx-1 rounded-sm" style={{ height: 12, background: 'linear-gradient(180deg, #d4a96a 0%, #b8864e 40%, #a0703c 100%)', boxShadow: '0 3px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)' }} />
          <div className="mx-1 mb-4" style={{ height: 6, background: 'linear-gradient(180deg, rgba(0,0,0,0.12), transparent)' }} />
        </div>
      ))}
    </div>
  );
}
