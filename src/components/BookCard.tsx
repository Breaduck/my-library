'use client';
import Link from 'next/link';
import { Book, ReadingStatus } from '@/types';

export const STATUS_META: Record<ReadingStatus, { label: string; badge: string; dot: string }> = {
  want:    { label: '읽을 예정', badge: 'bg-purple-600 text-white border-transparent',     dot: 'bg-purple-300' },
  reading: { label: '읽는 중',   badge: 'bg-blue-600 text-white border-transparent',       dot: 'bg-blue-300' },
  done:    { label: '읽음',      badge: 'bg-emerald-600 text-white border-transparent',    dot: 'bg-emerald-300' },
  stopped: { label: '중단',      badge: 'bg-gray-700/80 text-white/80 border-transparent', dot: 'bg-gray-400' },
};

const GRADIENTS = [
  'from-blue-600 to-indigo-800',
  'from-amber-500 to-orange-700',
  'from-pink-500 to-rose-700',
  'from-emerald-500 to-teal-700',
  'from-violet-500 to-purple-700',
  'from-orange-500 to-red-700',
];

export default function BookCard({ book }: { book: Book }) {
  const meta = STATUS_META[book.status ?? 'done'];
  const grad = GRADIENTS[book.title.charCodeAt(0) % GRADIENTS.length];

  return (
    <Link href={`/book/${book.id}`} className="block group">
      <div
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl cursor-pointer"
        style={{
          aspectRatio: '2 / 3',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
          transform: 'translateZ(0)',
          transition: 'transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.22s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-6px) translateZ(0)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 20px 48px rgba(0,0,0,0.24), 0 4px 12px rgba(0,0,0,0.12)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateZ(0)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)';
        }}
      >
        {/* Cover */}
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${grad} flex items-end justify-start p-3`}>
            <span className="text-white/20 font-black" style={{ fontSize: 64, lineHeight: 1, letterSpacing: '-0.05em' }}>
              {book.title.slice(0, 1)}
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 35%, rgba(0,0,0,0.12) 55%, rgba(0,0,0,0.85) 100%)' }}
        />

        {/* Genre pill — bottom-left above text */}
        {book.genre && (
          <div className="absolute left-2.5" style={{ bottom: 52 }}>
            <span className="text-[9px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm bg-black/40 text-white/80 border border-white/10">
              {book.genre}
            </span>
          </div>
        )}

        {/* Progress bar for reading books */}
        {book.status === 'reading' && book.currentPage && book.pages && book.pages > 0 && (() => {
          const ratio = Math.min(book.currentPage / book.pages, 1);
          const pct = Math.round(ratio * 100);
          return (
            <>
              <div className="absolute right-2.5" style={{ bottom: 52 }}>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/80 text-white backdrop-blur-sm">
                  {pct}%
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                <div className="h-full bg-indigo-400" style={{ width: `${pct}%` }} />
              </div>
            </>
          );
        })()}

        {/* Status badge — top right */}
        {book.status !== 'done' && (
          <div className="absolute top-2.5 right-2.5">
            <span className={`flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-full border backdrop-blur-sm ${meta.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>
        )}

        {/* Top-left: rating OR timer indicator */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {book.status === 'done' && book.rating > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold px-2 py-1 rounded-full backdrop-blur-sm bg-black/30 text-amber-300 border border-white/10">
              ★ {book.rating}
            </span>
          )}
          {(book.totalReadingTime ?? 0) >= 60 && (
            <span className="flex items-center gap-1 text-[9px] font-medium px-2 py-1 rounded-full backdrop-blur-sm bg-black/30 text-indigo-300 border border-indigo-400/20">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {Math.floor((book.totalReadingTime ?? 0) / 60)}분
            </span>
          )}
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-6">
          <h3 className="text-white font-semibold text-xs sm:text-sm leading-snug line-clamp-2 mb-0.5"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
            {book.title}
          </h3>
          <p className="text-white/60 text-[10px] sm:text-xs truncate">{book.author}</p>
        </div>
      </div>
    </Link>
  );
}
