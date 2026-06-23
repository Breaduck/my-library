import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface BestsellerBook {
  title: string;
  author: string;
  coverUrl: string;
  isbn: string;
  description: string;
  publisher: string;
  pubdate: string;
  price: string;
  discount: string;
}

const RECENT_SEARCHES_KEY = 'recent-searches';
const MAX_RECENT = 6;

function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]'); } catch { return []; }
}
function addRecentSearch(q: string) {
  const existing = getRecentSearches().filter((s) => s !== q);
  const updated = [q, ...existing].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}
function removeRecentSearch(q: string) {
  const updated = getRecentSearches().filter((s) => s !== q);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<BestsellerBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BestsellerBook | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
    fetch('/api/bestsellers')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBooks(data);
        else setError('베스트셀러를 불러오지 못했어요');
      })
      .catch(() => setError('네트워크 오류가 발생했어요'))
      .finally(() => setLoading(false));
  }, []);

  function handleAddBook(book: BestsellerBook) {
    const params = new URLSearchParams({
      title: book.title,
      author: book.author,
      cover: book.coverUrl,
      isbn: book.isbn,
    });
    navigate(`/add?${params.toString()}`);
  }

  function handleSearch(q: string) {
    if (!q.trim()) return;
    addRecentSearch(q.trim());
    setRecentSearches(getRecentSearches());
    setSearchQuery('');
    inputRef.current?.blur();
  }

  function handleRemoveRecent(q: string) {
    removeRecentSearch(q);
    setRecentSearches(getRecentSearches());
  }

  const filteredBooks = searchQuery.trim()
    ? books.filter((b) =>
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.author.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : books;

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 page-pt pb-28 sm:pb-16">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/"
            className="flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors flex-shrink-0"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}
          >
            <svg className="w-5 h-5 sm:w-4 sm:h-4 text-[#1D1D1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <p className="text-[#AEAEB2] text-xs font-medium tracking-widest uppercase mb-0.5">Discover</p>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">탐색</h1>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
            placeholder="책 제목이나 저자를 검색하세요"
            className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-white text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] transition-all"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-[#AEAEB2] text-white text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* 최근 검색어 */}
        {(searchFocused || searchQuery) && recentSearches.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-[#AEAEB2] mb-2 px-1">최근 검색어</p>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((q) => (
                <div key={q} className="flex items-center gap-1 pl-3 pr-2 py-1.5 bg-white rounded-full text-sm text-[#1D1D1F]" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                  <button onClick={() => setSearchQuery(q)} className="hover:text-[#0071E3] transition-colors">
                    {q}
                  </button>
                  <button onClick={() => handleRemoveRecent(q)} className="w-4 h-4 flex items-center justify-center text-[#AEAEB2] hover:text-[#6E6E73] text-xs">
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-[#1D1D1F] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-[#6E6E73] text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {searchQuery ? (
              <>
                <p className="text-[#AEAEB2] text-sm mb-4">
                  "{searchQuery}" 검색 결과 {filteredBooks.length}권
                </p>
                {filteredBooks.length === 0 ? (
                  <div className="text-center py-20 text-[#6E6E73] text-sm">검색 결과가 없어요</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredBooks.map((book, i) => (
                      <BookItem key={i} book={book} rank={i + 1} onSelect={() => setSelected(book)} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-[#1D1D1F]">베스트셀러</h2>
                  <p className="text-[#AEAEB2] text-xs">{books.length}권</p>
                </div>

                {/* Top 5 list style */}
                {books.slice(0, 5).length > 0 && (
                  <div className="space-y-2 mb-6">
                    {books.slice(0, 5).map((book, i) => (
                      <button
                        key={i}
                        onClick={() => setSelected(book)}
                        className="w-full flex items-center gap-4 bg-white rounded-2xl p-3.5 hover:bg-gray-50 active:opacity-70 transition-all text-left"
                        style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
                      >
                        <span
                          className="text-xl font-black flex-shrink-0 w-8 text-right"
                          style={{
                            color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#D1D1D6',
                          }}
                        >
                          {i + 1}
                        </span>
                        <div
                          className="flex-shrink-0 rounded-xl overflow-hidden"
                          style={{ width: 44, height: 64, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                        >
                          {book.coverUrl
                            ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center"><span className="text-white font-bold text-xs">{book.title.slice(0, 1)}</span></div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1D1D1F] truncate leading-snug">{book.title}</p>
                          <p className="text-xs text-[#6E6E73] truncate mt-0.5">{book.author}</p>
                          {book.discount && (
                            <p className="text-xs font-medium text-[#1D1D1F] mt-1">{parseInt(book.discount).toLocaleString()}원</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Rest as grid */}
                {books.length > 5 && (
                  <>
                    <p className="text-xs font-semibold text-[#AEAEB2] mb-3 px-1">6위 이하</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {books.slice(5).map((book, i) => (
                        <BookItem key={i + 5} book={book} rank={i + 6} onSelect={() => setSelected(book)} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Bottom nav */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around px-5 py-3 bg-white/90 backdrop-blur-md border-t border-black/5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <Link to="/" className="flex flex-col items-center gap-0.5 text-[#6E6E73] active:opacity-60 transition-opacity">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2zm16-2l-7-4-7 4" />
          </svg>
          <span className="text-[10px] font-medium">서재</span>
        </Link>
        <Link to="/discover" className="flex flex-col items-center gap-0.5 text-[#1D1D1F] active:opacity-60 transition-opacity">
          <svg className="w-6 h-6" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-[10px] font-bold">탐색</span>
        </Link>
        <Link to="/stats" className="flex flex-col items-center gap-0.5 text-[#6E6E73] active:opacity-60 transition-opacity">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-[10px] font-medium">통계</span>
        </Link>
      </div>

      {/* Bottom Sheet for selected book */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden"
            style={{
              boxShadow: '0 -8px 48px rgba(0,0,0,0.2)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

            <div className="flex justify-end px-4 pt-3 pb-1">
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F5F5F7] text-[#6E6E73] text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 pb-2">
              <div className="flex gap-4 mb-5">
                <div
                  className="flex-shrink-0 w-24 rounded-2xl overflow-hidden bg-gray-100"
                  style={{ aspectRatio: '2 / 3', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
                >
                  {selected.coverUrl ? (
                    <img src={selected.coverUrl} alt={selected.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-600">
                      <span className="text-white font-bold text-2xl">{selected.title.slice(0, 1)}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <h3 className="text-base font-bold text-[#1D1D1F] leading-snug mb-1">{selected.title}</h3>
                  <p className="text-sm text-[#6E6E73] mb-2">{selected.author}</p>
                  {selected.publisher && (
                    <p className="text-xs text-[#AEAEB2]">{selected.publisher}</p>
                  )}
                  {selected.discount && (
                    <p className="text-xs font-semibold text-[#1D1D1F] mt-1">
                      {parseInt(selected.discount).toLocaleString()}원
                    </p>
                  )}
                </div>
              </div>

              {selected.description && (
                <div className="mb-5">
                  <p className="text-xs text-[#6E6E73] leading-relaxed line-clamp-4">{selected.description}</p>
                </div>
              )}

              <button
                onClick={() => handleAddBook(selected)}
                className="w-full py-4 bg-[#1D1D1F] text-white rounded-2xl text-sm font-semibold hover:bg-[#3A3A3C] active:scale-[0.98] transition-all"
              >
                내 서재에 추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BookItem({ book, rank, onSelect }: { book: BestsellerBook; rank: number; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="group text-left">
      <div
        className="relative overflow-hidden rounded-2xl mb-2.5 bg-gray-100"
        style={{
          aspectRatio: '2 / 3',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.2)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = '';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)';
        }}
      >
        <div className="absolute top-2 left-2 z-10">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-black/50 text-white text-[10px] font-bold backdrop-blur-sm">
            {rank}
          </span>
        </div>
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-600">
            <span className="text-white font-bold text-2xl">{book.title.slice(0, 1)}</span>
          </div>
        )}
      </div>
      <p className="text-xs font-semibold text-[#1D1D1F] leading-snug line-clamp-2 mb-0.5">{book.title}</p>
      <p className="text-[10px] text-[#6E6E73] truncate">{book.author}</p>
    </button>
  );
}
