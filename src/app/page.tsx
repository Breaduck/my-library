'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useBooks } from '@/hooks/useBooks';
import BookCard from '@/components/BookCard';
import BookListItem from '@/components/BookListItem';
import BookShelf from '@/components/BookShelf';
import EmptyState from '@/components/EmptyState';
import DriveSync from '@/components/DriveSync';
import { ReadingStatus, Book } from '@/types';
import { getReadingStreak } from '@/lib/storage';

type Tab = 'all' | ReadingStatus;
type ViewMode = 'grid' | 'list' | 'shelf';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all',     label: '전체' },
  { key: 'done',    label: '읽음' },
  { key: 'reading', label: '읽는 중' },
  { key: 'want',    label: '읽을 예정' },
  { key: 'stopped', label: '중단' },
];

const TAB_ACTIVE: Record<Tab, string> = {
  all:     'bg-[#1D1D1F] text-white',
  done:    'bg-emerald-500 text-white',
  reading: 'bg-blue-500 text-white',
  want:    'bg-purple-500 text-white',
  stopped: 'bg-gray-500 text-white',
};

function SortableGridCard({ book, isDragging }: { book: Book; isDragging: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: book.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <BookCard book={book} />
    </div>
  );
}

function SortableListItem({ book, isDragging }: { book: Book; isDragging: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: book.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <BookListItem book={book} />
    </div>
  );
}

export default function HomePage() {
  const { books, loaded, reorderBooks } = useBooks();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [streak, setStreak] = useState(0);
  const [genre, setGenre] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('view-mode') as ViewMode | null;
    if (saved) setViewMode(saved);
  }, []);

  useEffect(() => {
    setStreak(getReadingStreak());
  }, []);

  function toggleView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem('view-mode', mode);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Only reorder when no filters active (reordering filtered views would be confusing)
    if (search || genre || tab !== 'all') return;

    const oldIndex = books.findIndex((b) => b.id === active.id);
    const newIndex = books.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(books, oldIndex, newIndex);
    reorderBooks(newOrder.map((b) => b.id));
  }

  const counts: Record<Tab, number> = {
    all:     books.length,
    done:    books.filter((b) => b.status === 'done').length,
    reading: books.filter((b) => b.status === 'reading').length,
    want:    books.filter((b) => b.status === 'want').length,
    stopped: books.filter((b) => b.status === 'stopped').length,
  };

  const genres = Array.from(new Set(books.map(b => b.genre).filter(Boolean) as string[]));
  const readingBooks = books.filter(b => b.status === 'reading');

  const filtered = books
    .filter((b) => tab === 'all' || b.status === tab)
    .filter((b) => !genre || b.genre === genre)
    .filter((b) => b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase()));

  const isDragging = Boolean(activeId);
  const canDrag = !search && !genre && tab === 'all' && viewMode !== 'shelf';
  const activeBook = activeId ? books.find((b) => b.id === activeId) : null;

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1D1D1F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-28 sm:pb-16">

        {/* Header */}
        <div className="flex items-end justify-between mb-5 sm:mb-7">
          <div>
            <p className="text-[#AEAEB2] text-xs font-medium tracking-widest uppercase mb-1">My Library</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#1D1D1F] tracking-tight">나의 서재</h1>
            {books.length > 0 && (
              <p className="text-[#AEAEB2] mt-1.5 text-sm">
                {[
                  counts.done > 0    && `${counts.done}권 읽음`,
                  counts.reading > 0 && `${counts.reading}권 읽는 중`,
                  counts.want > 0    && `${counts.want}권 읽을 예정`,
                ].filter(Boolean).join('  ·  ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><DriveSync /></div>
            {books.length > 0 && (
              <Link href="/stats"
                className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-white text-[#6E6E73] hover:bg-gray-50 transition-colors"
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }} title="통계">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </Link>
            )}
            <Link href="/discover"
              className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-white text-[#6E6E73] hover:bg-gray-50 transition-colors"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }} title="탐색">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Link>
            <Link href="/add"
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white rounded-full text-sm font-medium hover:bg-[#3A3A3C] transition-colors select-none">
              <span className="text-base leading-none">+</span>책 추가
            </Link>
          </div>
        </div>

        {/* Streak banner */}
        {streak >= 2 && (
          <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 4px 16px rgba(245,158,11,0.3)' }}>
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-white font-bold text-sm">{streak}일 연속 독서 중!</p>
              <p className="text-white/80 text-xs">오늘도 독서해서 스트릭을 이어가세요</p>
            </div>
          </div>
        )}

        {/* Search + View toggle */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="제목이나 저자로 검색..." className="w-full pl-11 pr-4 py-3 rounded-xl bg-white text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] transition-all"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }} />
          </div>
          {/* Grid / List / Shelf toggle */}
          <div className="flex bg-white rounded-xl overflow-hidden flex-shrink-0" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <button onClick={() => toggleView('grid')}
              className={`flex items-center justify-center w-11 h-11 transition-colors ${viewMode === 'grid' ? 'bg-[#1D1D1F] text-white' : 'text-[#AEAEB2] hover:text-[#6E6E73]'}`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/>
              </svg>
            </button>
            <button onClick={() => toggleView('list')}
              className={`flex items-center justify-center w-11 h-11 transition-colors ${viewMode === 'list' ? 'bg-[#1D1D1F] text-white' : 'text-[#AEAEB2] hover:text-[#6E6E73]'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button onClick={() => toggleView('shelf')}
              className={`flex items-center justify-center w-11 h-11 transition-colors ${viewMode === 'shelf' ? 'bg-[#1D1D1F] text-white' : 'text-[#AEAEB2] hover:text-[#6E6E73]'}`}
              title="책장 뷰">
              {/* Bookshelf icon */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6V4m0 2v8m0 0v2M8 14h8M16 6V4m0 2v8m0 0v2M4 20h16M4 4h2M18 4h2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {TABS.filter((t) => t.key === 'all' || counts[t.key] > 0).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                tab === t.key ? TAB_ACTIVE[t.key] : 'bg-white text-[#6E6E73] hover:bg-gray-50'
              }`}
              style={tab !== t.key ? { boxShadow: '0 1px 6px rgba(0,0,0,0.06)' } : {}}>
              {t.label}
              {counts[t.key] > 0 && (
                <span className={`text-xs ${tab === t.key ? 'opacity-75' : 'text-[#AEAEB2]'}`}>{counts[t.key]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Genre filter */}
        {genres.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setGenre(null)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${genre === null ? 'bg-[#1D1D1F] text-white' : 'bg-white text-[#6E6E73]'}`} style={genre !== null ? { boxShadow:'0 1px 6px rgba(0,0,0,0.06)' } : {}}>전체</button>
            {genres.map(g => (
              <button key={g} onClick={() => setGenre(genre === g ? null : g)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${genre === g ? 'bg-indigo-500 text-white' : 'bg-white text-[#6E6E73]'}`} style={genre !== g ? { boxShadow:'0 1px 6px rgba(0,0,0,0.06)' } : {}}>{g}</button>
            ))}
          </div>
        )}

        {/* Drag hint */}
        {canDrag && books.length > 1 && (
          <p className="text-[#AEAEB2] text-xs mb-3 text-center">꾹 눌러서 순서를 바꿀 수 있어요</p>
        )}

        {/* Content */}
        {books.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 지금 읽는 중 spotlight */}
            {readingBooks.length > 0 && (tab === 'all' || tab === 'reading') && !search && !genre && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-[#1D1D1F] mb-3">지금 읽는 중</h2>
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                  {readingBooks.map(book => (
                    <Link key={book.id} href={`/book/${book.id}`} className="flex-shrink-0 block">
                      <div className="relative w-28 rounded-2xl overflow-hidden" style={{ height: 168, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                        {book.coverUrl
                          ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center"><span className="text-white font-bold text-lg">{book.title.slice(0,2)}</span></div>
                        }
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85) 100%)' }} />
                        {book.currentPage && book.pages && book.pages > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                            <div className="h-full bg-indigo-400" style={{ width: `${Math.min(book.currentPage/book.pages*100,100)}%` }} />
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="text-white text-[10px] font-semibold line-clamp-2 leading-tight">{book.title}</p>
                          {book.currentPage && book.pages && <p className="text-white/60 text-[9px] mt-0.5">{Math.round(book.currentPage/book.pages*100)}%</p>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="text-center py-20 text-[#6E6E73] text-sm">
                {search ? `"${search}"에 해당하는 책이 없어요` : '이 탭에 책이 없어요'}
              </div>
            ) : viewMode === 'shelf' ? (
              /* Shelf view — no DnD */
              <div className="rounded-3xl overflow-hidden p-2"
                style={{ background: 'linear-gradient(180deg, #f5ede3 0%, #ede0d0 100%)' }}>
                <BookShelf books={filtered} />
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filtered.map((b) => b.id)}
                  strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
                >
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5">
                      {filtered.map((book) => (
                        <SortableGridCard key={book.id} book={book} isDragging={activeId === book.id} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filtered.map((book) => (
                        <SortableListItem key={book.id} book={book} isDragging={activeId === book.id} />
                      ))}
                    </div>
                  )}
                </SortableContext>

                <DragOverlay>
                  {activeBook ? (
                    viewMode === 'grid' ? (
                      <div style={{ width: 140, opacity: 0.9, transform: 'rotate(3deg) scale(1.05)', transformOrigin: 'center', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.3))' }}>
                        <BookCard book={activeBook} />
                      </div>
                    ) : (
                      <div style={{ opacity: 0.9, transform: 'scale(1.02)', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.2))' }}>
                        <BookListItem book={activeBook} />
                      </div>
                    )
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </>
        )}
      </div>

      {/* 모바일 하단 바 */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 flex items-center justify-between px-5 py-3 bg-[#F5F5F7]/90 backdrop-blur-md border-t border-black/5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <Link href="/stats" className="flex flex-col items-center gap-0.5 text-[#6E6E73] active:opacity-60 transition-opacity">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-[10px] font-medium">통계</span>
        </Link>
        <Link href="/discover" className="flex flex-col items-center gap-0.5 text-[#6E6E73] active:opacity-60 transition-opacity">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-[10px] font-medium">탐색</span>
        </Link>
        <Link href="/add"
          className="w-14 h-14 bg-[#1D1D1F] text-white rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </Link>
        <div className="flex items-center justify-end w-12">
          <DriveSync />
        </div>
      </div>
    </div>
  );
}
