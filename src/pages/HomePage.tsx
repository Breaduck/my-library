import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useBooks } from '@/hooks/useBooks';
import BookCard from '@/components/BookCard';
import BookShelf from '@/components/BookShelf';
import BookStack from '@/components/BookStack';
import EmptyState from '@/components/EmptyState';
import AccountButton from '@/components/AccountButton';
import DailyReadingModal from '@/components/DailyReadingModal';
import { ReadingStatus, Book } from '@/types';
import { getReadingStreak } from '@/lib/storage';

type Tab = 'all' | ReadingStatus;
type ViewMode = 'grid' | 'list' | 'shelf';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'done', label: '완독' },
  { key: 'reading', label: '읽는 중' },
  { key: 'want', label: '읽을 예정' },
  { key: 'stopped', label: '중단' },
];


function SortableGridCard({ book, isDragging }: { book: Book; isDragging: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: book.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, touchAction: 'none' as const };
  return <div ref={setNodeRef} style={style} {...attributes} {...listeners}><BookCard book={book} /></div>;
}

export default function HomePage() {
  const { books, loaded, reorderBooks } = useBooks();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [streak, setStreak] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [dailyModalBook, setDailyModalBook] = useState<Book | undefined>(undefined);

  function openDailyFor(book?: Book) {
    setDailyModalBook(book);
    setShowDailyModal(true);
  }

  useEffect(() => {
    const saved = localStorage.getItem('view-mode') as ViewMode | null;
    if (saved) setViewMode(saved);
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

  function handleDragStart(event: DragStartEvent) { setActiveId(String(event.active.id)); }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (search || tab !== 'all') return;
    const oldIndex = books.findIndex((b) => b.id === active.id);
    const newIndex = books.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderBooks(arrayMove(books, oldIndex, newIndex).map((b) => b.id));
  }

  const counts: Record<Tab, number> = {
    all: books.length,
    done: books.filter((b) => b.status === 'done').length,
    reading: books.filter((b) => b.status === 'reading').length,
    want: books.filter((b) => b.status === 'want').length,
    stopped: books.filter((b) => b.status === 'stopped').length,
  };

  const readingBooks = books.filter(b => b.status === 'reading');
  const filtered = books
    .filter((b) => tab === 'all' || b.status === tab)
    .filter((b) => b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase()));

  const activeBook = activeId ? books.find((b) => b.id === activeId) : null;
  const canDrag = !search && tab === 'all' && viewMode === 'grid';

  const showReadingSection = readingBooks.length > 0 && (tab === 'all' || tab === 'reading') && !search;

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1D1D1F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 page-pt-lg pb-28 sm:pb-16">

        {/* Header */}
        <div className="flex items-end justify-between mb-5 sm:mb-7">
          <div>
            <p className="text-[#AEAEB2] text-xs font-medium tracking-widest uppercase mb-1">My Library</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#1D1D1F] tracking-tight">나의 서재</h1>
            {books.length > 0 && (
              <p className="text-[#AEAEB2] mt-1.5 text-sm">
                {[
                  counts.done > 0 && `${counts.done}권 읽음`,
                  counts.reading > 0 && `${counts.reading}권 읽는 중`,
                  counts.want > 0 && `${counts.want}권 읽을 예정`,
                ].filter(Boolean).join('  ·  ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {books.length > 0 && (
              <Link to="/stats" className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-white text-[#6E6E73] hover:bg-gray-50 transition-colors" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }} title="통계">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </Link>
            )}
            <Link to="/add" className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white rounded-full text-sm font-medium hover:bg-[#3A3A3C] transition-colors select-none">
              <span className="text-base leading-none">+</span>책 추가
            </Link>
            <AccountButton />
          </div>
        </div>

        {/* Reading streak banner */}
        {streak >= 2 && (
          <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-2xl" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 4px 16px rgba(245,158,11,0.3)' }}>
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-white font-bold text-sm">{streak}일 연속 독서 중!</p>
              <p className="text-white/80 text-xs">오늘도 독서해서 스트릭을 이어가세요</p>
            </div>
          </div>
        )}

        {/* Status tabs — Apple segmented control 스타일, 좌측 정렬 */}
        <div className="mb-3 flex">
          <div className="inline-flex p-0.5 rounded-xl gap-0.5"
            style={{
              background: 'rgba(120,120,128,0.12)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}>
            {TABS.filter((t) => t.key === 'all' || counts[t.key] > 0).map((t) => {
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-all ${active ? 'text-[#1D1D1F]' : 'text-[#6E6E73] hover:text-[#1D1D1F]'}`}
                  style={active ? {
                    background: 'rgba(255,255,255,0.95)',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)',
                    fontWeight: 600,
                  } : undefined}>
                  {t.label}
                  {counts[t.key] > 0 && (
                    <span className={`text-[10.5px] ${active ? 'text-[#86848A]' : 'text-[#AEAEB2]'}`}>
                      {counts[t.key]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + view toggle */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="제목이나 저자로 검색..." className="w-full pl-11 pr-4 py-3 rounded-xl bg-white text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] transition-all" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }} />
          </div>
          <div className="flex bg-white rounded-xl overflow-hidden flex-shrink-0" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            {(['grid', 'list', 'shelf'] as ViewMode[]).map((mode, i) => (
              <button key={mode} onClick={() => toggleView(mode)} className={`flex items-center justify-center w-11 h-11 transition-colors ${viewMode === mode ? 'bg-[#1D1D1F] text-white' : 'text-[#AEAEB2] hover:text-[#6E6E73]'}`}>
                {i === 0 && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z" /></svg>}
                {i === 1 && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M6 12h12M5 17h14" /></svg>}
                {i === 2 && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6V4m0 2v8m0 0v2M8 14h8M16 6V4m0 2v8m0 0v2M4 20h16M4 4h2M18 4h2" /></svg>}
              </button>
            ))}
          </div>
        </div>

        {canDrag && books.length > 1 && (
          <p className="text-[#AEAEB2] text-xs mb-3 text-center">꾹 눌러서 순서를 바꿀 수 있어요</p>
        )}

        {books.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 읽는 중 섹션 — Apple 미니멀 카드 */}
            {showReadingSection && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-[13px] font-semibold text-[#86848A] tracking-wide uppercase">Now Reading</h2>
                  {readingBooks.length > 3 && (
                    <button onClick={() => setTab('reading')} className="text-[11px] text-[#86848A] hover:text-[#1D1D1F] transition-colors">
                      더 보기
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {readingBooks.slice(0, 3).map((book) => {
                    const pct = book.currentPage && book.pages && book.pages > 0
                      ? Math.round(book.currentPage / book.pages * 100)
                      : null;
                    return (
                      <div key={book.id}
                        className="bg-white rounded-2xl flex items-center gap-3.5 p-3"
                        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)' }}>
                        {/* 표지 — hover 시 투명 기록 버튼 */}
                        <button
                          type="button"
                          onClick={() => openDailyFor(book)}
                          title="오늘 기록 추가하기"
                          className="group relative flex-shrink-0 rounded-lg overflow-hidden active:scale-95 transition-transform"
                          style={{ width: 50, height: 74, boxShadow: '0 3px 10px rgba(0,0,0,0.14)' }}
                        >
                          {book.coverUrl
                            ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center"><span className="text-white font-bold text-sm">{book.title.slice(0, 2)}</span></div>
                          }
                          <span
                            className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-0.5 py-1 rounded-md text-white text-[9px] font-semibold opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
                            style={{
                              background: 'rgba(0,0,0,0.55)',
                              backdropFilter: 'blur(8px)',
                              WebkitBackdropFilter: 'blur(8px)',
                              border: '1px solid rgba(255,255,255,0.18)',
                            }}>
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            기록 추가
                          </span>
                        </button>

                        {/* 중앙 정보 — 클릭 시 책 상세로 */}
                        <Link to={`/book/${book.id}`} className="flex-1 min-w-0">
                          <p className="font-semibold text-[#1D1D1F] text-[14px] truncate leading-tight">{book.title}</p>
                          <p className="text-[#86848A] text-[11.5px] mt-0.5 truncate">{book.author}</p>
                          {pct !== null ? (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1 bg-[#F0F0F5] rounded-full overflow-hidden">
                                <div className="h-full rounded-full"
                                  style={{ width: `${pct}%`, background: '#1D1D1F' }} />
                              </div>
                              <span className="text-[10px] font-semibold text-[#1D1D1F] flex-shrink-0">{pct}%</span>
                            </div>
                          ) : (
                            <p className="text-[10.5px] text-[#AEAEB2] mt-1.5">진행률 미설정</p>
                          )}
                        </Link>

                        {/* 우측 타이머 — 작은 원형 아이콘 버튼 */}
                        <Link to={`/timer/${book.id}`}
                          title="독서 타이머"
                          className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#EAEAEC] active:scale-95 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Main book grid/list/shelf */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 text-[#6E6E73] text-sm">
                {search ? `"${search}"에 해당하는 책이 없어요` : '이 탭에 책이 없어요'}
              </div>
            ) : viewMode === 'shelf' ? (
              <div className="rounded-3xl overflow-hidden p-2" style={{ background: 'linear-gradient(180deg, #f5ede3 0%, #ede0d0 100%)' }}>
                <BookShelf books={filtered} />
              </div>
            ) : viewMode === 'list' ? (
              <BookStack books={filtered} />
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={filtered.map((b) => b.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5">
                    {filtered.map((book) => <SortableGridCard key={book.id} book={book} isDragging={activeId === book.id} />)}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeBook ? (
                    <div style={{ width: 140, opacity: 0.9, transform: 'rotate(3deg) scale(1.05)', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.3))' }}><BookCard book={activeBook} /></div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </>
        )}
      </div>

      {/* Mobile bottom nav */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around px-5 py-3 bg-white/90 backdrop-blur-md border-t border-black/5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <Link to="/stats" className="flex flex-col items-center gap-0.5 text-[#6E6E73] active:opacity-60 transition-opacity">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          <span className="text-[10px] font-medium">통계</span>
        </Link>
        <Link to="/add" className="w-14 h-14 bg-[#1D1D1F] text-white rounded-full flex items-center justify-center active:scale-95 transition-transform" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </Link>
        <button onClick={() => openDailyFor(readingBooks[0])} className="flex flex-col items-center gap-0.5 text-[#6E6E73] active:opacity-60 transition-opacity">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          <span className="text-[10px] font-medium">기록</span>
        </button>
      </div>

      {/* Daily reading modal */}
      {showDailyModal && (
        <DailyReadingModal
          readingBook={dailyModalBook ?? readingBooks[0]}
          onClose={() => { setShowDailyModal(false); setDailyModalBook(undefined); }}
        />
      )}
    </div>
  );
}
