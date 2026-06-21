'use client';
import Link from 'next/link';
import { Book } from '@/types';

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

interface Props {
  books: Book[];
}

export default function BookShelf({ books }: Props) {
  if (books.length === 0) return null;

  // Chunk books into shelves of BOOKS_PER_SHELF
  const shelves: Book[][] = [];
  for (let i = 0; i < books.length; i += BOOKS_PER_SHELF) {
    shelves.push(books.slice(i, i + BOOKS_PER_SHELF));
  }

  return (
    <div className="space-y-0">
      {shelves.map((shelf, shelfIdx) => (
        <div key={shelfIdx} className="relative">
          {/* Books row */}
          <div
            className="flex items-end gap-0.5 px-2 pt-4 pb-0"
            style={{ minHeight: 148 }}
          >
            {shelf.map((book, bookIdx) => {
              const gradIdx = (book.title.charCodeAt(0) + bookIdx) % SPINE_GRADIENTS.length;
              const gradient = SPINE_GRADIENTS[gradIdx];
              // Vary height slightly for realism
              const heightVariance = ((book.title.charCodeAt(0) + bookIdx * 3) % 3) * 8;
              const spineHeight = 112 + heightVariance;
              // Vary width slightly (thicker/thinner books)
              const widthVariance = ((book.title.charCodeAt(1) ?? 0) + bookIdx) % 4;
              const spineWidth = 26 + widthVariance * 4;

              return (
                <Link
                  key={book.id}
                  href={`/book/${book.id}`}
                  className="flex-shrink-0 group relative"
                  style={{ width: spineWidth }}
                  title={`${book.title} — ${book.author}`}
                >
                  <div
                    className="relative overflow-hidden rounded-t-sm"
                    style={{
                      width: spineWidth,
                      height: spineHeight,
                      background: book.coverUrl ? undefined : gradient,
                      boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.2), inset 2px 0 2px rgba(255,255,255,0.1)',
                      transition: 'transform 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-8px)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = '';
                    }}
                  >
                    {/* Cover image as spine background */}
                    {book.coverUrl && (
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ objectPosition: 'left center' }}
                      />
                    )}

                    {/* Dark overlay for text visibility */}
                    {book.coverUrl && (
                      <div
                        className="absolute inset-0"
                        style={{ background: 'rgba(0,0,0,0.15)' }}
                      />
                    )}

                    {/* Vertical title text */}
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                      }}
                    >
                      <span
                        className="text-white font-semibold leading-none select-none"
                        style={{
                          fontSize: 9,
                          textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                          maxHeight: spineHeight - 8,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {book.title}
                      </span>
                    </div>

                    {/* Status indicator dot at bottom */}
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                      <div
                        className="w-1 h-1 rounded-full"
                        style={{
                          background:
                            book.status === 'done' ? '#34d399' :
                            book.status === 'reading' ? '#60a5fa' :
                            book.status === 'want' ? '#a78bfa' :
                            '#9ca3af',
                        }}
                      />
                    </div>
                  </div>

                  {/* Tooltip on hover */}
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ transitionDelay: '0.2s' }}
                  >
                    <div
                      className="bg-[#1D1D1F] text-white rounded-lg px-2 py-1.5 whitespace-nowrap"
                      style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontSize: 10 }}
                    >
                      <p className="font-semibold leading-tight max-w-[120px] truncate">{book.title}</p>
                      <p className="opacity-60 leading-tight max-w-[120px] truncate">{book.author}</p>
                    </div>
                    {/* Arrow */}
                    <div
                      className="w-0 h-0 mx-auto"
                      style={{
                        borderLeft: '4px solid transparent',
                        borderRight: '4px solid transparent',
                        borderTop: '4px solid #1D1D1F',
                      }}
                    />
                  </div>
                </Link>
              );
            })}

            {/* Fill remaining slots with ghost spines */}
            {shelf.length < BOOKS_PER_SHELF && Array.from({ length: BOOKS_PER_SHELF - shelf.length }).map((_, i) => (
              <div
                key={`ghost-${i}`}
                className="flex-shrink-0"
                style={{ width: 28, height: 120 }}
              />
            ))}
          </div>

          {/* Shelf board */}
          <div
            className="mx-1 rounded-sm"
            style={{
              height: 12,
              background: 'linear-gradient(180deg, #d4a96a 0%, #b8864e 40%, #a0703c 100%)',
              boxShadow: '0 3px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          />
          {/* Shelf shadow */}
          <div
            className="mx-1 mb-4"
            style={{
              height: 6,
              background: 'linear-gradient(180deg, rgba(0,0,0,0.12), transparent)',
            }}
          />
        </div>
      ))}
    </div>
  );
}
