import { BookSearchResult } from '@/types';

export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (res.ok) return await res.json();
  } catch {}
  return [];
}
