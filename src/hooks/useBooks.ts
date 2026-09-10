import { useState, useEffect, useCallback } from 'react';
import { Book } from '@/types';
import { getBooks, saveBooks, addTombstone } from '@/lib/storage';

function migrate(book: Partial<Book>): Book {
  return {
    status: 'done',
    oneLiner: '',
    startDate: '',
    endDate: '',
    review: '',
    quotes: [],
    rating: 0,
    totalReadingTime: 0,
    ...book,
  } as Book;
}

// ── Shared store ────────────────────────────────────────────────
// All useBooks() instances read/write the same array so a mutation in
// one component (e.g. the daily-record modal) immediately re-renders
// every other component (e.g. the home "reading" card).
let store: Book[] | null = null;
const listeners = new Set<() => void>();

function loadStore(): Book[] {
  if (store === null) store = getBooks().map(migrate);
  return store;
}

function commitStore(next: Book[]) {
  store = next;
  saveBooks(next);
  listeners.forEach((l) => l());
}

export function useBooks() {
  const [, forceRender] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadStore();
    setLoaded(true);
    const l = () => forceRender((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  // Listen for Drive sync → replace all books
  useEffect(() => {
    const handler = (e: Event) => {
      const incoming = (e as CustomEvent<Book[]>).detail;
      commitStore(incoming.map(migrate));
    };
    window.addEventListener('books:replace', handler);
    return () => window.removeEventListener('books:replace', handler);
  }, []);

  const books = loadStore();

  const addBook = useCallback((data: Omit<Book, 'id' | 'createdAt'>) => {
    const now = new Date().toISOString();
    const book: Book = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    commitStore([book, ...loadStore()]);
    return book;
  }, []);

  const updateBook = useCallback((id: string, data: Partial<Omit<Book, 'id' | 'createdAt'>>) => {
    const now = new Date().toISOString();
    commitStore(loadStore().map((b) => (b.id === id ? { ...b, ...data, updatedAt: now } : b)));
  }, []);

  const deleteBook = useCallback((id: string) => {
    addTombstone(id); // 삭제 기록 — 병합/동기화에서 되살아나지 않도록
    commitStore(loadStore().filter((b) => b.id !== id));
  }, []);

  const getBook = useCallback((id: string) => loadStore().find((b) => b.id === id), []);

  // ★ 순서만 바꾼다 — 목록에 빠진 책이 있어도 절대 버리지 않는다.
  // 예전엔 orderedIds에 없는 책이 조용히 사라졌다(툼스톤도 없어 다음 동기화 전까지 로컬에서 소실).
  // 호출부가 전체 목록을 넘기지 않는 실수를 해도 데이터가 날아가지 않도록 뒤에 이어 붙인다.
  const reorderBooks = useCallback((orderedIds: string[]) => {
    const current = loadStore();
    const map = new Map(current.map((b) => [b.id, b]));
    const seen = new Set<string>();
    const reordered: Book[] = [];
    for (const id of orderedIds) {
      const b = map.get(id);
      if (b && !seen.has(id)) { seen.add(id); reordered.push(b); }
    }
    for (const b of current) if (!seen.has(b.id)) reordered.push(b);
    commitStore(reordered);
  }, []);

  return { books, loaded, addBook, updateBook, deleteBook, getBook, reorderBooks };
}
