import { useState, useEffect, useRef } from 'react';
import { searchBooks } from '@/lib/bookApi';
import { BookSearchResult } from '@/types';

interface Props {
  onSelect: (result: BookSearchResult) => void;
  initialQuery?: string;
}

export default function BookSearch({ onSelect, initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const data = await searchBooks(query);
      setResults(data);
      setOpen(true);
      setLoading(false);
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleSelect(result: BookSearchResult) {
    onSelect(result);
    setQuery(result.title);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="책 제목을 검색하세요..."
          className="w-full px-4 py-3 pr-10 text-sm rounded-xl bg-[#F5F5F7] border-0 outline-none focus:ring-2 focus:ring-[#0071E3] text-[#1D1D1F] placeholder-[#AEAEB2] transition-all"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute top-full mt-2 w-full bg-white rounded-2xl z-50 overflow-hidden max-h-72 overflow-y-auto"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}
        >
          {results.map((result, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(result)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F5F7] transition-colors text-left border-b border-gray-50 last:border-0"
            >
              {result.coverUrl ? (
                <img
                  src={result.coverUrl}
                  alt={result.title}
                  className="w-9 h-12 object-cover rounded-md flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-12 rounded-md bg-gray-100 flex items-center justify-center text-xs text-gray-400 font-bold flex-shrink-0">
                  {result.title.slice(0, 1)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1D1D1F] truncate">{result.title}</p>
                <p className="text-xs text-[#6E6E73] truncate mt-0.5">{result.author}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && results.length === 0 && query.trim() && (
        <div
          className="absolute top-full mt-2 w-full bg-white rounded-2xl z-50 px-4 py-6 text-center"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}
        >
          <p className="text-sm text-[#6E6E73]">검색 결과가 없어요</p>
          <p className="text-xs text-[#AEAEB2] mt-1">아래에 직접 입력해보세요</p>
        </div>
      )}
    </div>
  );
}
