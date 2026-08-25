import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import CompletionCelebration from '@/components/CompletionCelebration';
import { ReadingStatus, Book } from '@/types';
import { getReadingStreak, getTodayPages, hasDoneReadingToday, hasReadToday, getStreakFreezes, reconcileStreakFreeze, localDate } from '@/lib/storage';
import { getGameMode, setGameMode } from '@/lib/game';
import DailyQuests from '@/components/DailyQuests';
import { useAuth } from '@/hooks/useAuth';
import { usePendingRequestCount } from '@/hooks/useFriends';
import { useNotifications } from '@/hooks/useNotifications';

type Tab = 'all' | ReadingStatus;
type ViewMode = 'grid' | 'list' | 'shelf';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'done', label: '완독' },
  { key: 'reading', label: '읽는중' },
  { key: 'want', label: '읽을 예정' },
  { key: 'stopped', label: '중단' },
];


function SortableGridCard({ book, isDragging, index }: { book: Book; isDragging: boolean; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: book.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none' as const,
    // iOS Safari: 길게 누르면 뜨는 이미지 저장/텍스트 선택 콜아웃이 드래그를 취소시킨다 → 전부 끈다
    WebkitTouchCallout: 'none' as const,
    WebkitUserSelect: 'none' as const,
    userSelect: 'none' as const,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {/* 등장 애니메이션은 안쪽 래퍼에 — dnd-kit transform과 충돌 방지 */}
      <div className="anim-fade-up" style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}>
        <BookCard book={book} />
      </div>
    </div>
  );
}

export default function HomePage() {
  const { books, loaded, reorderBooks, updateBook } = useBooks();
  const { signedIn, displayName, state: syncState, scopeMissing, signIn, syncNow } = useAuth();
  const pendingRequests = usePendingRequestCount(signedIn);
  const { unread: unreadNotifs } = useNotifications(signedIn);
  const navigate = useNavigate();
  const libraryTitle = signedIn && displayName ? `${displayName}의 서재` : '나의 서재';
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [streak, setStreak] = useState(0);
  const [todayPages, setTodayPages] = useState(0);
  const [freezes, setFreezes] = useState(0);
  const [readToday, setReadToday] = useState(false);
  const [gameMode, setGameModeState] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(30);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalInput, setGoalInput] = useState('30');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [dailyModalBook, setDailyModalBook] = useState<Book | undefined>(undefined);
  const [readingHidden, setReadingHidden] = useState(false);
  const [celebrationBook, setCelebrationBook] = useState<Book | null>(null);
  // 마우스가 있는 PC에서만 책 위치 바꾸기(드래그) 허용. 아이패드/폰 같은 터치 기기에서는
  // 손가락으로 스크롤할 때 책들이 딸려 움직여서 꺼둔다. (pointer:fine + hover:hover = 정밀 포인터=마우스)
  const [reorderEnabled, setReorderEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const apply = () => setReorderEnabled(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  function openDailyFor(book?: Book) {
    setDailyModalBook(book);
    setShowDailyModal(true);
  }

  function refreshTodayStats() {
    reconcileStreakFreeze(); // 하루 1회 — 어제 놓친 날을 보호막으로 메워 연속 기록 보호
    setStreak(getReadingStreak());
    setTodayPages(getTodayPages());
    setFreezes(getStreakFreezes());
    setReadToday(hasReadToday());
    setGameModeState(getGameMode());
  }

  function toggleGameMode(on: boolean) {
    setGameMode(on);
    setGameModeState(on);
  }

  function startNextBook(next: Book) {
    updateBook(next.id, { status: 'reading', startDate: next.startDate || localDate() });
    setCelebrationBook(null);
    navigate(`/book/${next.id}`);
  }

  function saveDailyGoal() {
    const n = Math.max(1, Math.min(999, parseInt(goalInput) || 30));
    setDailyGoal(n);
    localStorage.setItem('daily-page-goal', String(n));
    setShowGoalModal(false);
  }

  function toggleReadingHidden() {
    setReadingHidden((prev) => {
      const next = !prev;
      localStorage.setItem('reading-section-hidden', next ? '1' : '0');
      return next;
    });
  }

  useEffect(() => {
    const saved = localStorage.getItem('view-mode') as ViewMode | null;
    if (saved) setViewMode(saved);
    setReadingHidden(localStorage.getItem('reading-section-hidden') === '1');
    refreshTodayStats();
    const g = parseInt(localStorage.getItem('daily-page-goal') || '');
    if (g > 0) setDailyGoal(g);
  }, []);

  // 하루에 한 번, 읽는중인 책이 있으면 오늘의 기록을 자연스럽게 유도
  useEffect(() => {
    if (!loaded || hasDoneReadingToday()) return;
    const reading = books.filter((b) => b.status === 'reading');
    if (reading.length === 0) return;
    const t = setTimeout(() => openDailyFor(reading[0]), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);


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
    // 탭/검색으로 걸러진 목록 안에서의 순서만 바꾸고, 화면에 없는 책들의 상대 순서는 그대로 둔다.
    const oldIndex = filtered.findIndex((b) => b.id === active.id);
    const newIndex = filtered.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reorderedFiltered = arrayMove(filtered, oldIndex, newIndex);
    const filteredIds = new Set(filtered.map((b) => b.id));
    let i = 0;
    const reorderedAll = books.map((b) => (filteredIds.has(b.id) ? reorderedFiltered[i++] : b));
    reorderBooks(reorderedAll.map((b) => b.id));
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

  const showReadingSection = readingBooks.length > 0 && (tab === 'all' || tab === 'reading') && !search;

  if (!loaded) {
    // 스피너 대신 스켈레톤 — 첫 화면이 덜 '깜빡'이고 빠르게 느껴진다
    return (
      <div className="min-h-screen bg-[#F5F5F7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 page-pt-lg pb-28 sm:pb-16">
          <div className="animate-pulse">
            <div className="h-3 w-20 rounded bg-black/5 mb-3" />
            <div className="h-9 w-44 rounded-xl bg-black/10 mb-8" />
            <div className="h-10 w-64 rounded-xl bg-black/5 mb-4" />
            <div className="h-12 w-full rounded-xl bg-black/5 mb-6" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl sm:rounded-3xl bg-black/10" style={{ aspectRatio: '2 / 3' }} />
              ))}
            </div>
          </div>
        </div>
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
            <h1 className="text-3xl sm:text-4xl font-bold text-[#1D1D1F] tracking-tight">{libraryTitle}</h1>
            {books.length > 0 && (
              <p className="text-[#AEAEB2] mt-1.5 text-sm">
                {[
                  counts.done > 0 && `${counts.done}권 읽음`,
                  counts.reading > 0 && `${counts.reading}권 읽는중`,
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
            {signedIn && (
              <Link to="/notifications" className="relative hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-white text-[#6E6E73] hover:bg-gray-50 transition-colors" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }} title="알림">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {unreadNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadNotifs > 9 ? '9+' : unreadNotifs}
                  </span>
                )}
              </Link>
            )}
            <Link to="/friends" className="relative hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-white text-[#6E6E73] hover:bg-gray-50 transition-colors" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }} title="친구">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-2a3 3 0 10-2-5.24" /></svg>
              {pendingRequests > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {pendingRequests > 9 ? '9+' : pendingRequests}
                </span>
              )}
            </Link>
            <Link to="/add" className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white rounded-full text-sm font-medium hover:bg-[#3A3A3C] transition-colors select-none">
              <span className="text-base leading-none">+</span>책 추가
            </Link>
            <AccountButton />
          </div>
        </div>

        {/* 백업 연결 문제 안내 — 새 기기에서 데이터가 '없는 것처럼' 보일 때 원인과 해결책을 바로 보여준다 */}
        {signedIn && (scopeMissing || syncState === 'error') && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-lg flex-shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-[#8a6d1a] leading-snug">
                {scopeMissing ? '백업 접근 권한이 꺼져 있어요' : '백업을 불러오지 못했어요'}
              </p>
              <p className="text-[11px] text-[#a08a3f] mt-0.5 leading-relaxed">
                {scopeMissing
                  ? '다시 로그인하면서 Google Drive 항목에 꼭 체크해주세요. 기록은 안전하게 보관돼 있어요.'
                  : '네트워크 문제일 수 있어요. 다시 시도하면 기록을 불러와요.'}
              </p>
            </div>
            <button
              onClick={() => (scopeMissing ? signIn() : void syncNow())}
              className="flex-shrink-0 px-3.5 py-2 rounded-full bg-[#1D1D1F] text-white text-[11px] font-bold active:scale-95 transition-transform">
              {scopeMissing ? '권한 허용' : '다시 시도'}
            </button>
          </div>
        )}

        {/* 오늘의 독서 위젯 — 듀오링고식 연속 독서(스트릭) + 오늘 목표 */}
        {books.length > 0 && (streak > 0 || todayPages > 0 || readingBooks.length > 0) && (() => {
          const goalMet = todayPages >= dailyGoal;
          const atRisk = !readToday && streak > 0;         // 오늘 아직 — 불씨가 꺼질 위험
          const lit = readToday || goalMet;                // 오늘 완료 → 불꽃 활활
          const msg = goalMet
            ? '오늘 목표 달성! 내일도 이어가요 🎉'
            : readToday
              ? (streak > 0 ? `오늘 독서 완료! ${streak}일 연속 유지 중` : '오늘 독서 완료! 좋은 시작이에요')
              : atRisk
                ? `오늘 읽으면 ${streak + 1}일째! 불씨를 지켜요`
                : '오늘 첫 장을 펴고 연속 기록을 시작해요';
          const flameBg = lit
            ? 'linear-gradient(135deg,#FFB020,#FF6A00)'
            : atRisk ? 'linear-gradient(135deg,#FF9F45,#FF5A5A)' : '#E5E5EA';
          const ctaRead = !readToday;
          return (
          <div className="mb-4">
            <div className="bg-white rounded-2xl overflow-hidden"
              style={{ boxShadow: atRisk ? '0 2px 16px rgba(255,120,60,0.20)' : '0 1px 8px rgba(0,0,0,0.06)', border: atRisk ? '1px solid rgba(255,120,60,0.28)' : '1px solid transparent' }}>
              <div className="px-4 py-3.5 flex items-center gap-3.5">
                {/* 스트릭 불꽃 */}
                <Link to="/stats" className="flex-shrink-0 relative" aria-label="통계 보기">
                  <div className="w-[52px] h-[52px] rounded-2xl flex flex-col items-center justify-center relative"
                    style={{ background: flameBg, boxShadow: lit ? '0 4px 14px rgba(255,110,0,0.35)' : atRisk ? '0 4px 14px rgba(255,90,90,0.28)' : 'none' }}>
                    {atRisk && <span className="absolute inset-0 rounded-2xl animate-ping" style={{ background: 'rgba(255,120,60,0.35)' }} />}
                    <span className="text-[20px] leading-none relative" style={{ filter: lit || atRisk ? 'none' : 'grayscale(1)', opacity: lit || atRisk ? 1 : 0.5 }}>🔥</span>
                    <span className="text-white text-[13px] font-extrabold leading-none tabular-nums relative mt-0.5"
                      style={{ color: lit || atRisk ? '#fff' : '#8E8E93' }}>{streak}</span>
                  </div>
                  {freezes > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white text-[9px] font-bold text-[#3B7DE8]"
                      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }} title="연속 보호막 — 하루 빠져도 기록이 유지돼요">
                      ❄️{freezes}
                    </span>
                  )}
                </Link>

                {/* 메시지 + 오늘 목표 진행 */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-bold leading-tight mb-1.5 ${atRisk ? 'text-[#E8590C]' : goalMet ? 'text-emerald-600' : 'text-[#1D1D1F]'}`}>{msg}</p>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10.5px] text-[#86848A] flex items-center">
                      오늘 <span className="font-bold text-[#1D1D1F] tabular-nums mx-1">{todayPages}</span> / {dailyGoal}쪽
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGoalInput(String(dailyGoal)); setShowGoalModal(true); }}
                        aria-label="오늘 목표 수정" className="ml-1.5 text-[#C7C7CC] hover:text-[#86848A]">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </p>
                  </div>
                  <div className="h-1.5 bg-[#F0F0F5] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.round((todayPages / dailyGoal) * 100))}%`, background: goalMet ? '#34C759' : 'linear-gradient(90deg, #4F8EF7, #3B7DE8)' }} />
                  </div>
                </div>

                {/* CTA — 오늘 아직이면 '지금 읽기', 완료했으면 '+ 기록' */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (ctaRead && readingBooks[0]) navigate(`/timer/${readingBooks[0].id}`);
                    else openDailyFor(readingBooks[0]);
                  }}
                  className="flex-shrink-0 px-3.5 py-2 rounded-full text-white text-[11px] font-bold active:scale-95 transition-transform"
                  style={{ background: ctaRead ? 'linear-gradient(135deg,#FF8A3D,#FF5A2C)' : '#1D1D1F' }}>
                  {ctaRead ? '지금 읽기' : '+ 기록'}
                </button>
              </div>
            </div>
          </div>
          );
        })()}

        {/* 게임 모드 — 일일 퀘스트·보석·상점 (듀오링고식) */}
        {books.length > 0 && (
          gameMode ? (
            <DailyQuests onChanged={refreshTodayStats} onTurnOff={() => toggleGameMode(false)} />
          ) : (
            <button onClick={() => toggleGameMode(true)}
              className="mb-4 w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left active:scale-[0.99] transition-transform"
              style={{ background: 'linear-gradient(135deg, #1E2A4A, #2B2154)', boxShadow: '0 2px 14px rgba(30,42,74,0.30)' }}>
              <span className="text-xl leading-none flex-shrink-0">🎮</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[13px] font-bold">게임 모드 켜기</p>
                <p className="text-white/45 text-[11px] mt-0.5">매일 퀘스트 깨고 💎 보석 모아 ❄️ 보호막 사기</p>
              </div>
              <svg className="w-4 h-4 text-white/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          )
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
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="제목이나 저자로 검색..." className="w-full pl-11 pr-4 py-3 rounded-xl bg-white text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#3B7DE8] transition-all" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }} />
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


        {books.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 읽는중 섹션 — Apple 미니멀 카드 */}
            {showReadingSection && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[13px] font-semibold text-[#86848A] tracking-wide uppercase">읽는중</h2>
                    <span className="text-[11px] text-[#AEAEB2]">{readingBooks.length}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {!readingHidden && readingBooks.length > 3 && (
                      <button onClick={() => setTab('reading')} className="text-[11px] text-[#86848A] hover:text-[#1D1D1F] transition-colors">
                        더 보기
                      </button>
                    )}
                    <button onClick={toggleReadingHidden}
                      title={readingHidden ? '읽는중 펼치기' : '읽는중 숨기기'}
                      className="flex items-center gap-1 text-[11px] text-[#86848A] hover:text-[#1D1D1F] transition-colors">
                      {readingHidden ? (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          펼치기
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
                          </svg>
                          숨기기
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {!readingHidden && (
                  <div className="space-y-2">
                    {readingBooks.slice(0, 3).map((book) => {
                      const pct = book.pages && book.pages > 0
                        ? Math.min(100, Math.round((book.currentPage ?? 0) / book.pages * 100))
                        : null;
                      return (
                        <div key={book.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openDailyFor(book)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDailyFor(book); } }}
                          title="눌러서 오늘 기록 추가하기"
                          className="bg-white rounded-2xl flex items-center gap-3 p-3 cursor-pointer active:scale-[0.99] transition-transform"
                          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)' }}>
                          {/* 표지 */}
                          <div
                            className="flex-shrink-0 rounded-lg overflow-hidden"
                            style={{ width: 50, height: 74, boxShadow: '0 3px 10px rgba(0,0,0,0.14)' }}
                          >
                            {book.coverUrl
                              ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                              : <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center"><span className="text-white font-bold text-sm">{book.title.slice(0, 2)}</span></div>
                            }
                          </div>

                          {/* 중앙 정보 */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#1D1D1F] text-[14px] truncate leading-tight">{book.title}</p>
                            <p className="text-[#86848A] text-[11.5px] mt-0.5 truncate">{book.author}</p>
                            {pct !== null ? (
                              <div className="mt-2">
                                <div className="relative h-[18px] bg-[#F0F0F5] rounded-full overflow-hidden">
                                  <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #4F8EF7, #3B7DE8)' }} />
                                  <div className="absolute inset-0 flex items-center px-2">
                                    <span className={`text-[10px] font-bold ${pct >= 35 ? 'text-white' : 'text-[#1D1D1F]'} transition-colors`}>
                                      {pct}%
                                    </span>
                                    <span className={`ml-auto text-[9.5px] font-medium ${pct >= 90 ? 'text-white/90' : 'text-[#86848A]'} transition-colors`}>
                                      {book.currentPage}/{book.pages}p
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-1.5 text-[11px] text-[#AEAEB2]">총 페이지를 입력하면 진행률이 표시돼요</p>
                            )}
                          </div>

                          {/* 우측 액션 — 상세 + 타이머 (박스 클릭과 분리) */}
                          <div className="flex-shrink-0 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <Link to={`/book/${book.id}`}
                              title="상세 보기"
                              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#EAEAEC] active:scale-95 transition-all">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                            <Link to={`/timer/${book.id}`}
                              title="독서 타이머"
                              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#EAEAEC] active:scale-95 transition-all">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Main book grid/list/shelf */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 text-[#6E6E73] text-sm">
                {search ? `"${search}"에 해당하는 책이 없어요` : '이 탭에 책이 없어요'}
              </div>
            ) : (
              viewMode === 'shelf' ? (
                <div className="rounded-3xl p-2" style={{ background: 'linear-gradient(180deg, #f5ede3 0%, #ede0d0 100%)' }}>
                  <BookShelf books={filtered} />
                </div>
              ) : viewMode === 'list' ? (
                <BookStack books={filtered} />
              ) : reorderEnabled ? (
                // PC(마우스): 드래그로 책 위치 바꾸기
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                  <SortableContext items={filtered.map((b) => b.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5">
                      {filtered.map((book, i) => <SortableGridCard key={book.id} book={book} isDragging={activeId === book.id} index={i} />)}
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {activeBook ? (
                      <div style={{ width: 140, opacity: 0.9, transform: 'rotate(3deg) scale(1.05)', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.3))' }}><BookCard book={activeBook} /></div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              ) : (
                // 터치 기기(아이패드/폰): 드래그 없이 일반 그리드 — 손가락 스크롤이 자연스럽게
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5">
                  {filtered.map((book, i) => (
                    <div key={book.id} className="anim-fade-up" style={{ animationDelay: `${Math.min(i * 35, 350)}ms` }}>
                      <BookCard book={book} />
                    </div>
                  ))}
                </div>
              )
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
        <Link to="/friends" className="relative flex flex-col items-center gap-0.5 text-[#6E6E73] active:opacity-60 transition-opacity">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-2a3 3 0 10-2-5.24" /></svg>
          {pendingRequests > 0 && (
            <span className="absolute top-0 right-1/2 translate-x-3 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
              {pendingRequests > 9 ? '9+' : pendingRequests}
            </span>
          )}
          <span className="text-[10px] font-medium">친구</span>
        </Link>
        <Link to="/add" className="w-14 h-14 bg-[#1D1D1F] text-white rounded-full flex items-center justify-center active:scale-95 transition-transform" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </Link>
        {signedIn ? (
          <Link to="/notifications" className="relative flex flex-col items-center gap-0.5 text-[#6E6E73] active:opacity-60 transition-opacity">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            {unreadNotifs > 0 && (
              <span className="absolute top-0 right-1/2 translate-x-3 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </span>
            )}
            <span className="text-[10px] font-medium">알림</span>
          </Link>
        ) : (
          <button onClick={() => openDailyFor(readingBooks[0])} className="flex flex-col items-center gap-0.5 text-[#6E6E73] active:opacity-60 transition-opacity">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <span className="text-[10px] font-medium">기록</span>
          </button>
        )}
      </div>

      {/* 오늘의 페이지 목표 수정 */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setShowGoalModal(false)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 sm:p-8"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
            <h3 className="text-lg font-semibold text-[#1D1D1F] mb-1">오늘의 목표</h3>
            <p className="text-[#6E6E73] text-sm mb-5">하루에 읽을 페이지 목표를 정해보세요</p>
            <div className="flex items-center gap-2 mb-6">
              <input type="number" inputMode="numeric" value={goalInput} min={1} max={999} autoFocus
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveDailyGoal(); }}
                className="flex-1 px-4 py-3 rounded-xl bg-[#F5F5F7] text-base text-[#1D1D1F] outline-none focus:ring-2 focus:ring-[#3B7DE8] transition-all" />
              <span className="text-sm text-[#6E6E73] flex-shrink-0">쪽 / 일</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowGoalModal(false)} className="flex-1 py-3.5 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] text-sm font-medium active:bg-gray-200 transition-colors">취소</button>
              <button onClick={saveDailyGoal} className="flex-1 py-3.5 rounded-xl bg-[#1D1D1F] text-white text-sm font-medium hover:bg-[#3A3A3C] transition-colors">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* Daily reading modal */}
      {showDailyModal && (
        <DailyReadingModal
          readingBook={dailyModalBook ?? readingBooks[0]}
          onClose={() => { setShowDailyModal(false); setDailyModalBook(undefined); refreshTodayStats(); }}
          onFinished={(book) => setCelebrationBook(book)}
        />
      )}

      {/* 오늘 기록으로 총 페이지에 도달해 자동 완독됐을 때 축하 */}
      {celebrationBook && (
        <CompletionCelebration
          book={celebrationBook}
          doneCount={books.filter((b) => b.status === 'done').length}
          nextBook={books.find((b) => b.status === 'want')}
          onShare={() => navigate(`/book/${celebrationBook.id}`)}
          onStartNext={startNextBook}
          onClose={() => setCelebrationBook(null)}
        />
      )}
    </div>
  );
}
