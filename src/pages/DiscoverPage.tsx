import { useState, useEffect } from 'react';
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

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<BestsellerBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BestsellerBook | null>(null);

  useEffect(() => {
    fetch('/api/bestsellers')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBooks(data);
        } else {
          setError('베스트셀러를 불러오지 못했어요');
        }
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

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-12 pb-28 sm:pb-16">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
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
            <h1 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">베스트셀러 탐색</h1>
          </div>
        </div>

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

        {!loading && !error && books.length > 0 && (
          <>
            <p className="text-[#AEAEB2] text-sm mb-5">네이버 도서 베스트셀러 {books.length}권</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {books.map((book, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(book)}
                  className="group text-left"
                >
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
                        {i + 1}
                      </span>
                    </div>
                    {book.coverUrl ? (
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-600">
                        <span className="text-white font-bold text-2xl">{book.title.slice(0, 1)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[#1D1D1F] leading-snug line-clamp-2 mb-0.5">{book.title}</p>
                  <p className="text-[10px] text-[#6E6E73] truncate">{book.author}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom nav */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around px-5 py-3 bg-[#F5F5F7]/90 backdrop-blur-md border-t border-black/5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <Link to="/" className="flex flex-col items-center gap-0.5 text-[#6E6E73] active:opacity-60 transition-opacity">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2zm16-2l-7-4-7 4" />
          </svg>
          <span className="text-[10px] font-medium">서재</span>
        </Link>
        <Link to="/discover" className="flex flex-col items-center gap-0.5 text-[#1D1D1F] active:opacity-60 transition-opacity">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-[10px] font-medium">탐색</span>
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
          style={{ background: 'rgba(0,0,0,0.5)' }}
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
