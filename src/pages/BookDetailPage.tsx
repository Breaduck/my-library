import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { useBooks } from '@/hooks/useBooks';
import StarRating from '@/components/StarRating';
import BookSearch from '@/components/BookSearch';
import BookProgress from '@/components/BookProgress';
import DateField from '@/components/DateField';
import { BookSearchResult, Quote, ReadingStatus } from '@/types';

interface QuoteDraft {
  id: string;
  text: string;
  page: string;
}

const REVIEW_PLACEHOLDER = `이 책을 읽으며 어떤 감정이 스쳐갔나요?
가장 기억에 남는 장면, 마음을 두드린 문장,
다시 떠올리고 싶은 생각을 자유롭게 적어보세요.`;

function formatDateShort(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function readingDays(start: string, end: string) {
  if (!start || !end) return null;
  const diff = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

function fmtReadingTime(s: number): string {
  if (!s || s === 0) return '';
  if (s < 60) return `${s}초`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

const STATUS_OPTIONS: { key: ReadingStatus; label: string; emoji: string; active: string }[] = [
  { key: 'want',    label: '읽을 예정', emoji: '🔖', active: 'bg-purple-500 text-white border-purple-500' },
  { key: 'reading', label: '읽는 중',   emoji: '📖', active: 'bg-blue-500 text-white border-blue-500' },
  { key: 'done',    label: '읽음',      emoji: '✅', active: 'bg-emerald-500 text-white border-emerald-500' },
  { key: 'stopped', label: '중단',      emoji: '🚫', active: 'bg-gray-500 text-white border-gray-500' },
];

const STATUS_BADGE: Record<ReadingStatus, { label: string; cls: string }> = {
  want:    { label: '읽을 예정', cls: 'bg-purple-50 text-purple-600' },
  reading: { label: '읽는 중',   cls: 'bg-blue-50 text-blue-600' },
  done:    { label: '읽음',      cls: 'bg-emerald-50 text-emerald-700' },
  stopped: { label: '중단',      cls: 'bg-gray-100 text-gray-500' },
};

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { books, loaded, updateBook, deleteBook } = useBooks();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editStatus, setEditStatus] = useState<ReadingStatus>('done');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editRating, setEditRating] = useState(0);
  const [editPages, setEditPages] = useState('');
  const [editCurrentPage, setEditCurrentPage] = useState('');

  const book = books.find((b) => b.id === id);

  /* ── inline review / quotes (view mode, auto-save on blur) ── */
  const [liveReview, setLiveReview] = useState('');
  const [liveQuotes, setLiveQuotes] = useState<QuoteDraft[]>([]);

  useEffect(() => {
    if (!book) return;
    setLiveReview(book.review);
    setLiveQuotes(
      book.quotes.length > 0
        ? book.quotes.map((q) => ({ id: q.id, text: q.text, page: q.page || '' }))
        : [{ id: crypto.randomUUID(), text: '', page: '' }]
    );
  }, [book?.id, book?.review, book?.quotes]);

  function commitReview() {
    if (!book || !id) return;
    if (liveReview === book.review) return;
    updateBook(id, { review: liveReview });
  }

  function commitQuotes() {
    if (!book || !id) return;
    const next: Quote[] = liveQuotes
      .filter((q) => q.text.trim())
      .map((q) => ({ id: q.id, text: q.text, page: q.page || undefined }));
    const sameLen = next.length === book.quotes.length;
    const same = sameLen && next.every((q, i) => {
      const b = book.quotes[i];
      return b && b.id === q.id && b.text === q.text && (b.page || undefined) === q.page;
    });
    if (same) return;
    updateBook(id, { quotes: next });
  }

  function addLiveQuote() {
    setLiveQuotes((p) => [...p, { id: crypto.randomUUID(), text: '', page: '' }]);
  }
  function removeLiveQuote(i: number) {
    setLiveQuotes((p) => {
      const next = p.filter((_, idx) => idx !== i);
      // commit immediately since blur won't fire on removed input
      if (book && id) {
        const cleaned: Quote[] = next.filter((q) => q.text.trim()).map((q) => ({ id: q.id, text: q.text, page: q.page || undefined }));
        updateBook(id, { quotes: cleaned });
      }
      return next.length === 0 ? [{ id: crypto.randomUUID(), text: '', page: '' }] : next;
    });
  }
  function updateLiveQuote(i: number, f: 'text' | 'page', v: string) {
    setLiveQuotes((p) => p.map((q, idx) => (idx === i ? { ...q, [f]: v } : q)));
  }

  function startEdit() {
    if (!book) return;
    setEditTitle(book.title);
    setEditAuthor(book.author);
    setEditCoverUrl(book.coverUrl);
    setEditStatus(book.status ?? 'done');
    setEditStartDate(book.startDate);
    setEditEndDate(book.endDate);
    setEditRating(book.rating);
    setEditPages(book.pages ? String(book.pages) : '');
    setEditCurrentPage(book.currentPage ? String(book.currentPage) : '');
    setIsEditing(true);
  }

  function saveEdit() {
    if (!editTitle.trim() || !id) return;
    updateBook(id, {
      title: editTitle.trim(),
      author: editAuthor.trim(),
      coverUrl: editCoverUrl,
      status: editStatus,
      startDate: editStartDate,
      endDate: editEndDate,
      rating: editRating,
      pages: editPages ? parseInt(editPages) : undefined,
      currentPage: editCurrentPage ? parseInt(editCurrentPage) : undefined,
    });
    setIsEditing(false);
  }

  function handleDelete() {
    if (!id) return;
    deleteBook(id);
    navigate('/');
  }

  async function handleSaveShareCard() {
    if (!shareCardRef.current) return;
    setSavingCard(true);
    try {
      const dataUrl = await toPng(shareCardRef.current, { pixelRatio: 3, cacheBust: true });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `리뷰_${book?.title ?? 'book'}.png`;
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingCard(false);
    }
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1D1D1F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center gap-4">
        <p className="text-[#6E6E73]">책을 찾을 수 없어요.</p>
        <Link to="/" className="text-[#0071E3] text-sm font-medium hover:underline">서재로 돌아가기</Link>
      </div>
    );
  }

  const days = readingDays(book.startDate, book.endDate);
  const badge = STATUS_BADGE[book.status ?? 'done'];
  const inputClass = 'w-full px-4 py-3 rounded-xl bg-[#F5F5F7] text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] transition-all';
  const cardStyle = { boxShadow: '0 2px 16px rgba(0,0,0,0.06)' };

  /* ─── EDIT MODE ─── */
  if (isEditing) {
    const showDates = editStatus === 'reading' || editStatus === 'done' || editStatus === 'stopped';
    const showRating = editStatus === 'done';

    return (
      <div className="min-h-screen bg-[#F5F5F7]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 sm:pt-12 pb-32 sm:pb-12">
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors flex-shrink-0"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}
            >
              <svg className="w-5 h-5 sm:w-4 sm:h-4 text-[#1D1D1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">책 수정</h1>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {/* Search */}
            <div className="bg-white rounded-2xl p-5 sm:p-6" style={cardStyle}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[#1D1D1F]">책 검색</h2>
                <button type="button" onClick={() => setShowManual(true)} className="text-xs text-[#AEAEB2] hover:text-[#6E6E73] flex items-center gap-1">
                  직접 입력
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              </div>
              <BookSearch
                onSelect={(r: BookSearchResult) => { setEditTitle(r.title); setEditAuthor(r.author); setEditCoverUrl(r.coverUrl); }}
                initialQuery={editTitle}
              />
              {editTitle && (
                <div className="mt-4 flex items-center gap-3 p-3 bg-[#F5F5F7] rounded-xl">
                  {editCoverUrl
                    ? <img src={editCoverUrl} alt={editTitle} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
                    : <div className="w-10 h-14 rounded-lg bg-gray-200 flex items-center justify-center text-xs text-gray-500 font-bold flex-shrink-0">{editTitle.slice(0,2)}</div>
                  }
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1D1D1F] truncate">{editTitle}</p>
                    <p className="text-xs text-[#6E6E73] truncate">{editAuthor}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="bg-white rounded-2xl p-5 sm:p-6" style={cardStyle}>
              <h2 className="text-sm font-semibold text-[#1D1D1F] mb-4">독서 상태</h2>
              <div className="grid grid-cols-4 gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button key={opt.key} type="button" onClick={() => setEditStatus(opt.key)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${editStatus === opt.key ? opt.active : 'border-[#F5F5F7] bg-[#F5F5F7] text-[#6E6E73]'}`}>
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="text-xs">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            {showDates && (
              <div className="bg-white rounded-2xl p-5 sm:p-6" style={cardStyle}>
                <h2 className="text-sm font-semibold text-[#1D1D1F] mb-4">읽은 기간</h2>
                <div className="space-y-3">
                  <DateField label="시작일" value={editStartDate} onChange={setEditStartDate} presets={['today', 'yesterday', 'week-ago']} />
                  {editStatus === 'done' && (
                    <DateField label="종료일" value={editEndDate} onChange={setEditEndDate} presets={['today', 'yesterday']} />
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">총 페이지 수</label>
                    <input type="number" value={editPages} onChange={(e) => setEditPages(e.target.value)} placeholder="예) 328" className={inputClass} min="1" />
                  </div>
                  {editStatus === 'reading' && (
                    <div>
                      <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">현재 페이지</label>
                      <input type="number" value={editCurrentPage} onChange={e => setEditCurrentPage(e.target.value)} placeholder="예) 145" className={inputClass} min="1" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rating (done only) */}
            {showRating && (
              <div className="bg-white rounded-2xl p-5 sm:p-6" style={cardStyle}>
                <h2 className="text-sm font-semibold text-[#1D1D1F] mb-4">별점</h2>
                <StarRating value={editRating} onChange={setEditRating} />
              </div>
            )}
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 px-4 sm:px-6 pt-3 bg-[#F5F5F7]/90 backdrop-blur-md border-t border-black/5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          <div className="max-w-2xl mx-auto">
            <button onClick={saveEdit} disabled={!editTitle.trim()} className="w-full py-4 bg-[#1D1D1F] text-white rounded-2xl text-sm font-semibold hover:bg-[#3A3A3C] active:scale-[0.98] transition-all disabled:opacity-40">
              저장하기
            </button>
          </div>
        </div>

        {/* 직접 입력 팝업 */}
        {showManual && (
          <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50"
            onClick={(e) => e.target === e.currentTarget && setShowManual(false)}>
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6"
              style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-[#1D1D1F]">직접 입력</h3>
                <button onClick={() => setShowManual(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F5F5F7] text-[#6E6E73] text-lg">×</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">제목 *</label>
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[#F5F5F7] text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] transition-all" autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">저자</label>
                  <input type="text" value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[#F5F5F7] text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">표지 URL (선택)</label>
                  <input type="url" value={editCoverUrl} onChange={(e) => setEditCoverUrl(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[#F5F5F7] text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] transition-all" />
                </div>
                <button type="button" onClick={() => setShowManual(false)} className="w-full mt-2 py-3.5 bg-[#1D1D1F] text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-all">
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ─── VIEW MODE ─── */
  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 sm:pt-12"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 48px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <Link to="/"
            className="flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}>
            <svg className="w-5 h-5 sm:w-4 sm:h-4 text-[#1D1D1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowShareCard(true)}
              className="px-4 py-2.5 sm:py-2 rounded-full bg-white text-[#1D1D1F] text-sm font-medium hover:bg-gray-50 transition-colors"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}>
              공유
            </button>
            <button onClick={startEdit}
              className="px-4 py-2.5 sm:py-2 rounded-full bg-white text-[#1D1D1F] text-sm font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}>수정</button>
            <button onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2.5 sm:py-2 rounded-full bg-white text-red-500 text-sm font-medium hover:bg-red-50 active:bg-red-100 transition-colors"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}>삭제</button>
          </div>
        </div>

        {/* Hero */}
        <div className="rounded-3xl overflow-hidden mb-3 sm:mb-4" style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.14)' }}>
          <div className="relative flex flex-col items-center pt-8 pb-6 px-6"
            style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', minHeight: 200 }}>
            {book.coverUrl && (
              <div className="absolute inset-0 overflow-hidden">
                <img src={book.coverUrl} alt="" className="w-full h-full object-cover opacity-20 scale-110"
                  style={{ filter: 'blur(24px)' }} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(15,20,40,0.6) 0%, rgba(15,20,40,0.85) 100%)' }} />
              </div>
            )}
            <div className="relative flex-shrink-0 rounded-xl overflow-hidden"
              style={{ width: 110, height: 160, boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.4)' }}>
              {book.coverUrl
                ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center">
                    <span className="text-white text-2xl font-black">{book.title.slice(0, 2)}</span>
                  </div>
              }
            </div>
            <div className="relative mt-4 text-center">
              <h1 className="text-white font-bold text-lg sm:text-xl leading-snug"
                style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                {book.title}
              </h1>
              <p className="text-white/60 text-sm mt-1">{book.author}</p>
            </div>
          </div>
          <div className="bg-white px-5 sm:px-6 py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
              {book.status === 'done' && book.rating > 0 && (
                <StarRating value={book.rating} readonly />
              )}
            </div>
            {(book.startDate || book.endDate || book.pages) && (
              <div className="mt-3 pt-3 border-t border-[#F5F5F7] flex items-center gap-4 flex-wrap">
                {book.startDate && (
                  <div>
                    <p className="text-[10px] text-[#AEAEB2] mb-0.5">시작일</p>
                    <p className="text-xs font-medium text-[#1D1D1F]">{formatDateShort(book.startDate)}</p>
                  </div>
                )}
                {book.endDate && (
                  <div>
                    <p className="text-[10px] text-[#AEAEB2] mb-0.5">완독일</p>
                    <p className="text-xs font-medium text-[#1D1D1F]">{formatDateShort(book.endDate)}</p>
                  </div>
                )}
                {book.pages && (
                  <div>
                    <p className="text-[10px] text-[#AEAEB2] mb-0.5">페이지</p>
                    <p className="text-xs font-medium text-[#1D1D1F]">{book.pages}p</p>
                  </div>
                )}
                {days && (
                  <div className="ml-auto">
                    <p className="text-xs text-[#6E6E73]">{days}일 동안 읽었어요</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {book.status === 'reading' && book.currentPage && book.pages && (
          <div className="bg-white rounded-2xl p-5 mb-3 sm:mb-4" style={cardStyle}>
            <h2 className="text-sm font-semibold text-[#1D1D1F] mb-3">읽기 진행률</h2>
            <BookProgress currentPage={book.currentPage} pages={book.pages} />
          </div>
        )}

        {(book.status === 'reading' || book.status === 'done' || book.status === 'stopped') && (
          <>
            {/* 독후감 (인라인 편집) */}
            <div className="rounded-2xl overflow-hidden relative mb-3 sm:mb-4"
              style={{
                background: 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 50%, #fff7ed 100%)',
                boxShadow: '0 2px 24px rgba(168,85,247,0.08), 0 1px 4px rgba(0,0,0,0.04)',
                border: '1px solid rgba(168,85,247,0.08)',
              }}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-30 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #d8b4fe 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
              <div className="relative p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">✨</span>
                  <h2 className="text-sm font-bold text-[#1D1D1F]">나의 기록</h2>
                </div>
                <p className="text-[11px] text-[#6E6E73] mb-4 ml-7">읽으면서 떠오른 생각을 자유롭게 기록해보세요</p>
                <textarea value={liveReview} onChange={(e) => setLiveReview(e.target.value)} onBlur={commitReview}
                  placeholder={REVIEW_PLACEHOLDER}
                  rows={Math.max(5, liveReview.split('\n').length + 1)}
                  className="w-full px-4 py-3 rounded-xl bg-white/70 backdrop-blur-sm text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-purple-200 focus:bg-white transition-all resize-none leading-relaxed"
                  style={{ fontFamily: '"Noto Serif KR", Georgia, "Times New Roman", serif' }}
                />
                {liveReview.length > 0 && (
                  <p className="text-right text-[10px] text-[#AEAEB2] mt-1.5">{liveReview.length}자 · 자동 저장됨</p>
                )}
              </div>
            </div>

            {/* 인상깊은 구절 (인라인 편집) */}
            <div className="rounded-2xl overflow-hidden relative mb-3 sm:mb-4"
              style={{
                background: 'linear-gradient(135deg, #eff6ff 0%, #ecfeff 50%, #f0fdf4 100%)',
                boxShadow: '0 2px 24px rgba(59,130,246,0.08), 0 1px 4px rgba(0,0,0,0.04)',
                border: '1px solid rgba(59,130,246,0.08)',
              }}>
              <div className="absolute top-0 left-0 w-40 h-40 rounded-full opacity-20 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #93c5fd 0%, transparent 70%)', transform: 'translate(-30%, -30%)' }} />
              <div className="relative p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📜</span>
                  <h2 className="text-sm font-bold text-[#1D1D1F]">인상깊은 구절</h2>
                  {liveQuotes.filter(q => q.text.trim()).length > 0 && (
                    <span className="text-[10px] text-[#6E6E73] ml-1">{liveQuotes.filter(q => q.text.trim()).length}개</span>
                  )}
                </div>
                <p className="text-[11px] text-[#6E6E73] mb-4 ml-7">밑줄 긋고 싶은 문장을 모아두세요</p>
                <div className="space-y-4">
                  {liveQuotes.map((q, i) => (
                    <div key={q.id} className="rounded-xl bg-white/70 backdrop-blur-sm p-3 space-y-2 border border-white/60">
                      <div className="flex gap-2 items-start">
                        <textarea value={q.text} onChange={(e) => updateLiveQuote(i, 'text', e.target.value)} onBlur={commitQuotes}
                          placeholder='"마음에 닿은 문장을 옮겨 적어보세요"'
                          rows={Math.max(2, q.text.split('\n').length + 1)}
                          className="flex-1 px-3 py-2 rounded-lg bg-transparent text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none resize-none italic leading-relaxed"
                          style={{ fontFamily: '"Noto Serif KR", Georgia, serif' }}
                        />
                        {liveQuotes.length > 1 && (
                          <button type="button" onClick={() => removeLiveQuote(i)} className="mt-1 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#AEAEB2] hover:text-red-400 transition-colors flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                      <input type="text" value={q.page} onChange={(e) => updateLiveQuote(i, 'page', e.target.value)} onBlur={commitQuotes}
                        placeholder="p. 페이지 (선택)"
                        className="w-32 px-2.5 py-1.5 rounded-md bg-white/60 text-xs text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-1 focus:ring-blue-300 transition-all" />
                    </div>
                  ))}
                  <button type="button" onClick={addLiveQuote} className="flex items-center gap-1.5 text-blue-600 text-sm font-medium hover:text-blue-700 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    구절 추가
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Timer card */}
        <div className="mt-3 sm:mt-4 rounded-3xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0C0C18 0%, #1a1040 100%)', boxShadow: '0 4px 32px rgba(0,0,0,0.2)' }}>
          <div className="px-6 py-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-white/70 text-sm font-medium">독서 타이머</p>
              </div>
              {(book.totalReadingTime ?? 0) > 0
                ? <p className="text-white/40 text-xs">누적 {fmtReadingTime(book.totalReadingTime)}</p>
                : <p className="text-white/30 text-xs">아직 기록된 시간이 없어요</p>
              }
            </div>
            <Link to={`/timer/${id}`}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-[#0C0C18] active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #818CF8, #C084FC)', boxShadow: '0 4px 16px rgba(129,140,248,0.4)' }}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              시작
            </Link>
          </div>
        </div>
      </div>

      {/* 공유 카드 모달 */}
      {showShareCard && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
          onClick={(e) => e.target === e.currentTarget && setShowShareCard(false)}>
          <div className="w-full max-w-sm">
            <div ref={shareCardRef} className="rounded-3xl overflow-hidden"
              style={{ background: 'linear-gradient(160deg, #1a1035 0%, #0d0d1a 100%)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
              <div className="relative h-48 overflow-hidden">
                {book.coverUrl
                  ? <img src={book.coverUrl} alt="" className="w-full h-full object-cover opacity-40" />
                  : <div className="w-full h-full bg-gradient-to-br from-indigo-800 to-purple-900" />
                }
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 20%, #1a1035 100%)' }} />
                {book.coverUrl && (
                  <img src={book.coverUrl} alt={book.title}
                    className="absolute bottom-[-20px] left-1/2 -translate-x-1/2 rounded-xl object-cover"
                    style={{ width: 80, height: 114, boxShadow: '0 12px 32px rgba(0,0,0,0.7)' }} />
                )}
              </div>

              <div className="px-6 pt-8 pb-6">
                <p className="text-white font-bold text-lg text-center leading-tight">{book.title}</p>
                <p className="text-white/50 text-sm text-center mt-1">{book.author}</p>

                {book.rating > 0 && (
                  <div className="flex justify-center gap-1 mt-2">
                    {[1,2,3,4,5].map(s => <span key={s} className={`text-lg ${book.rating >= s ? 'text-amber-400' : 'text-white/15'}`}>★</span>)}
                  </div>
                )}

                {book.quotes.length > 0 && (
                  <div className="mt-4 px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-white/80 text-xs italic leading-relaxed line-clamp-3">&ldquo;{book.quotes[0].text}&rdquo;</p>
                    {book.quotes[0].page && <p className="text-white/30 text-[10px] mt-1">p. {book.quotes[0].page}</p>}
                  </div>
                )}

                <div className="flex justify-center gap-4 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  {book.pages && <div className="text-center"><p className="text-white/30 text-[9px] uppercase tracking-widest">페이지</p><p className="text-white text-sm font-medium">{book.pages}p</p></div>}
                  {(book.totalReadingTime ?? 0) > 0 && <div className="text-center"><p className="text-white/30 text-[9px] uppercase tracking-widest">독서시간</p><p className="text-white text-sm font-medium">{Math.floor((book.totalReadingTime??0)/3600) > 0 ? `${Math.floor((book.totalReadingTime??0)/3600)}시간` : `${Math.floor((book.totalReadingTime??0)/60)}분`}</p></div>}
                  {book.endDate && <div className="text-center"><p className="text-white/30 text-[9px] uppercase tracking-widest">완독일</p><p className="text-white text-sm font-medium">{book.endDate.slice(0,7)}</p></div>}
                </div>

                <div className="flex items-center justify-center gap-1.5 mt-4">
                  <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                    </svg>
                  </div>
                  <p className="text-white/30 text-[10px] tracking-widest uppercase">나의 서재</p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={handleSaveShareCard}
                disabled={savingCard}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white text-[#1D1D1F] text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-60"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {savingCard ? '저장 중...' : '이미지 저장'}
              </button>
              <button onClick={() => setShowShareCard(false)}
                className="py-3.5 rounded-2xl bg-white/10 text-white text-sm font-medium backdrop-blur-sm border border-white/10 active:opacity-70 transition-opacity">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 sm:p-8"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
            <h3 className="text-lg font-semibold text-[#1D1D1F] mb-2">책을 삭제할까요?</h3>
            <p className="text-[#6E6E73] text-sm mb-6">&ldquo;{book.title}&rdquo;과 모든 기록이 삭제됩니다.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3.5 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] text-sm font-medium active:bg-gray-200 transition-colors">취소</button>
              <button onClick={handleDelete} className="flex-1 py-3.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 active:bg-red-700 transition-colors">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
