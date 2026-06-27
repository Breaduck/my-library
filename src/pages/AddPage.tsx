import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useBooks } from '@/hooks/useBooks';
import BookSearch from '@/components/BookSearch';
import StarRating from '@/components/StarRating';
import DateField from '@/components/DateField';
import CoverInput from '@/components/CoverInput';
import { BookSearchResult, ReadingStatus } from '@/types';

interface QuoteDraft { text: string; page: string; }

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STATUS_OPTIONS: { key: ReadingStatus; label: string; emoji: string; active: string }[] = [
  { key: 'want',    label: '읽을 예정', emoji: '🔖', active: 'bg-purple-500 text-white border-purple-500' },
  { key: 'reading', label: '읽는 중',   emoji: '📖', active: 'bg-blue-500 text-white border-blue-500' },
  { key: 'done',    label: '읽음',      emoji: '✅', active: 'bg-emerald-500 text-white border-emerald-500' },
];

const REVIEW_PLACEHOLDER = `이 책을 읽으며 어떤 감정이 스쳐갔나요?
가장 기억에 남는 장면, 마음을 두드린 문장,
다시 떠올리고 싶은 생각을 자유롭게 적어보세요.`;

export default function AddPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addBook } = useBooks();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [status, setStatus] = useState<ReadingStatus>('done');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(0);
  const [quotes, setQuotes] = useState<QuoteDraft[]>([{ text: '', page: '' }]);
  const [pages, setPages] = useState('');
  const [currentPage, setCurrentPage] = useState('');
  const [showManual, setShowManual] = useState(false);

  async function fetchPages(isbn?: string, t?: string, a?: string) {
    const params = new URLSearchParams();
    if (isbn) params.set('isbn', isbn);
    if (t) params.set('title', t);
    if (a) params.set('author', a);
    if (!params.toString()) return;
    try {
      const res = await fetch(`/api/pages?${params.toString()}`);
      const data = await res.json() as { pages?: number };
      if (data.pages) setPages(String(data.pages));
    } catch {}
  }

  useEffect(() => {
    const paramTitle = searchParams.get('title');
    const paramAuthor = searchParams.get('author');
    const paramCover = searchParams.get('cover');
    const paramIsbn = searchParams.get('isbn');
    if (paramTitle) setTitle(paramTitle);
    if (paramAuthor) setAuthor(paramAuthor);
    if (paramCover) setCoverUrl(paramCover);
    if (paramIsbn || paramTitle) fetchPages(paramIsbn ?? undefined, paramTitle ?? undefined, paramAuthor ?? undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSelect(r: BookSearchResult) {
    setTitle(r.title); setAuthor(r.author); setCoverUrl(r.coverUrl);
    if (r.pages) setPages(String(r.pages));
    else fetchPages(r.isbn, r.title, r.author);
  }

  function addQuote() { setQuotes((p) => [...p, { text: '', page: '' }]); }
  function removeQuote(i: number) { setQuotes((p) => p.filter((_, idx) => idx !== i)); }
  function updateQuote(i: number, f: 'text' | 'page', v: string) {
    setQuotes((p) => p.map((q, idx) => idx === i ? { ...q, [f]: v } : q));
  }

  function handleSave() {
    if (!title.trim()) return;
    /* 상태별로 의미 없는 날짜는 비워서 저장 */
    const finalStart = status === 'want' ? '' : startDate;
    const finalEnd = status === 'done' ? endDate : '';
    addBook({
      title: title.trim(), author: author.trim(), coverUrl, status, oneLiner: '',
      startDate: finalStart, endDate: finalEnd, review, rating, totalReadingTime: 0,
      pages: pages ? parseInt(pages) : undefined,
      currentPage: currentPage ? parseInt(currentPage) : undefined,
      quotes: quotes.filter((q) => q.text.trim()).map((q) => ({ ...q, id: crypto.randomUUID() })),
    });
    navigate('/');
  }

  const inp = 'w-full px-4 py-3 rounded-xl bg-[#F5F5F7] text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] transition-all';
  const cs = { boxShadow: '0 2px 16px rgba(0,0,0,0.06)' };
  const showDates = status === 'reading' || status === 'done';
  const showReview = status === 'reading' || status === 'done';

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-pt pb-32">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors flex-shrink-0" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}>
            <svg className="w-5 h-5 sm:w-4 sm:h-4 text-[#1D1D1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">책 추가</h1>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6" style={cs}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#1D1D1F]">책 검색</h2>
              <button type="button" onClick={() => setShowManual(true)} className="text-xs text-[#AEAEB2] hover:text-[#6E6E73] transition-colors flex items-center gap-1">
                직접 입력
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </button>
            </div>
            <BookSearch onSelect={handleSelect} />
            {title && (
              <div className="mt-4 flex items-center gap-3 p-3 bg-[#F5F5F7] rounded-xl">
                {coverUrl
                  ? <img src={coverUrl} alt={title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
                  : <div className="w-10 h-14 rounded-lg bg-gray-200 flex items-center justify-center text-xs text-gray-500 font-bold flex-shrink-0">{title.slice(0, 2)}</div>
                }
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1D1D1F] truncate">{title}</p>
                  <p className="text-xs text-[#6E6E73] truncate">{author || '저자 미상'}</p>
                </div>
                <button type="button" onClick={() => { setTitle(''); setAuthor(''); setCoverUrl(''); }} className="w-8 h-8 flex items-center justify-center text-[#AEAEB2] text-xl flex-shrink-0">×</button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 sm:p-6" style={cs}>
            <h2 className="text-sm font-semibold text-[#1D1D1F] mb-4">독서 상태</h2>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button key={opt.key} type="button" onClick={() => setStatus(opt.key)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${status === opt.key ? opt.active : 'border-[#F5F5F7] bg-[#F5F5F7] text-[#6E6E73]'}`}>
                  <span className="text-xl">{opt.emoji}</span>
                  <span className="text-[10px] sm:text-xs font-medium leading-tight text-center">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {showReview && (
            <>
              {status === 'done' && (
                <div className="bg-white rounded-2xl p-5 sm:p-6" style={cs}>
                  <h2 className="text-sm font-semibold text-[#1D1D1F] mb-4">별점</h2>
                  <StarRating value={rating} onChange={setRating} />
                </div>
              )}

              {/* 나의 기록 — Apple pearl gradient (warm) */}
              <div className="rounded-3xl overflow-hidden relative"
                style={{
                  background: 'linear-gradient(135deg, #FDFCFA 0%, #F7F2EB 60%, #EFE6D6 100%)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 18px 50px rgba(180,150,110,0.14)',
                  border: '1px solid rgba(0,0,0,0.04)',
                }}>
                <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-55 pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(255,210,170,0.55) 0%, transparent 70%)', transform: 'translate(35%, -35%)' }} />
                <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-40 pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(255,180,200,0.40) 0%, transparent 70%)', transform: 'translate(-30%, 35%)' }} />
                <div className="relative p-5 sm:p-7">
                  <h2 className="text-[15px] font-semibold text-[#1D1D1F] tracking-tight">나의 기록</h2>
                  <p className="text-[12px] text-[#86848A] mt-0.5 mb-5">읽으면서 떠오른 생각을 기록해보세요</p>
                  <textarea value={review} onChange={(e) => setReview(e.target.value)}
                    placeholder={REVIEW_PLACEHOLDER}
                    rows={6}
                    className="w-full px-4 py-3.5 rounded-2xl text-[15px] text-[#1D1D1F] placeholder-[#B0AEB4] outline-none focus:ring-2 transition-all resize-none"
                    style={{
                      fontFamily: '"Noto Serif KR", Georgia, "Times New Roman", serif',
                      background: 'rgba(255,255,255,0.65)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
                      lineHeight: 1.95,
                      ['--tw-ring-color' as never]: 'rgba(0,113,227,0.22)',
                    }}
                  />
                  <p className="text-right text-[10px] text-[#A09EA4] mt-2 tracking-wide">{review.length}자</p>
                </div>
              </div>

              {/* 인상깊은 구절 — Apple pearl gradient (cool) */}
              <div className="rounded-3xl overflow-hidden relative"
                style={{
                  background: 'linear-gradient(135deg, #FBFAFD 0%, #F0EEF5 55%, #E2DEEC 100%)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 18px 50px rgba(140,130,180,0.12)',
                  border: '1px solid rgba(0,0,0,0.04)',
                }}>
                <div className="absolute top-0 left-0 w-56 h-56 rounded-full opacity-50 pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(180,180,255,0.45) 0%, transparent 70%)', transform: 'translate(-35%, -35%)' }} />
                <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full opacity-40 pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(200,170,230,0.40) 0%, transparent 70%)', transform: 'translate(30%, 35%)' }} />
                <div className="relative p-5 sm:p-7">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-semibold text-[#1D1D1F] tracking-tight">인상깊은 구절</h2>
                      <p className="text-[12px] text-[#86848A] mt-0.5">밑줄 긋고 싶은 문장을 모아두세요</p>
                    </div>
                    <button type="button" onClick={addQuote}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/70 hover:bg-white text-[#1D1D1F] text-[12px] font-semibold active:scale-95 transition-all flex-shrink-0"
                      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                      구절 추가
                    </button>
                  </div>
                  <div className="mt-5 space-y-3">
                    {quotes.map((q, i) => (
                      <div key={i} className="rounded-2xl p-3.5 space-y-2"
                        style={{
                          background: 'rgba(255,255,255,0.65)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
                        }}>
                        <div className="flex gap-2 items-start">
                          <textarea value={q.text} onChange={(e) => updateQuote(i, 'text', e.target.value)}
                            placeholder='"마음에 닿은 문장을 옮겨 적어보세요"'
                            rows={3}
                            className="flex-1 px-2 py-1 rounded-lg bg-transparent text-[15px] text-[#1D1D1F] placeholder-[#B0AEB4] outline-none resize-none italic"
                            style={{ fontFamily: '"Noto Serif KR", Georgia, serif', lineHeight: 1.85 }}
                          />
                          {quotes.length > 1 && (
                            <button type="button" onClick={() => removeQuote(i)} className="mt-0.5 w-7 h-7 flex items-center justify-center rounded-lg text-[#AEAEB2] hover:text-red-400 hover:bg-red-50/60 transition-colors flex-shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                        <input type="text" value={q.page} onChange={(e) => updateQuote(i, 'page', e.target.value)} placeholder="p. 페이지 (선택)"
                          className="w-32 px-2.5 py-1.5 rounded-lg text-xs text-[#1D1D1F] placeholder-[#B0AEB4] outline-none focus:ring-2 transition-all"
                          style={{
                            background: 'rgba(0,0,0,0.025)',
                            ['--tw-ring-color' as never]: 'rgba(0,113,227,0.22)',
                          }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {showDates && (
            <div className="bg-white rounded-2xl p-5 sm:p-6" style={cs}>
              <h2 className="text-sm font-semibold text-[#1D1D1F] mb-4">읽은 기간</h2>
              <div className="space-y-3">
                <DateField label="시작일" value={startDate} onChange={setStartDate} presets={['today', 'yesterday', 'week-ago']} />
                {status === 'done' && (
                  <DateField label="종료일" value={endDate} onChange={setEndDate} presets={['today', 'yesterday']} />
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">총 페이지 수</label>
                  <input type="number" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="예) 328" className={inp} min="1" />
                </div>
                {status === 'reading' && (
                  <div>
                    <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">현재 페이지</label>
                    <input type="number" value={currentPage} onChange={e => setCurrentPage(e.target.value)} placeholder="예) 145" className={inp} min="1" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-4 sm:px-6 pt-3 bg-[#F5F5F7]/90 backdrop-blur-md border-t border-black/5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <div className="max-w-2xl mx-auto">
          <button type="button" onClick={handleSave} disabled={!title.trim()} className="w-full py-4 bg-[#1D1D1F] text-white rounded-2xl text-sm font-semibold hover:bg-[#3A3A3C] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            저장하기
          </button>
        </div>
      </div>

      {showManual && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && setShowManual(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-[#1D1D1F]">직접 입력</h3>
              <button onClick={() => setShowManual(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F5F5F7] text-[#6E6E73] text-lg">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">제목 *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="책 제목" className="w-full px-4 py-3 rounded-xl bg-[#F5F5F7] text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] transition-all" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">저자</label>
                <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="저자 이름" className="w-full px-4 py-3 rounded-xl bg-[#F5F5F7] text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">표지 (선택)</label>
                <CoverInput value={coverUrl} onChange={setCoverUrl} />
              </div>
              <button type="button" onClick={() => setShowManual(false)} className="w-full mt-2 py-3.5 bg-[#1D1D1F] text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-all">확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
