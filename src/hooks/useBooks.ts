import { useState, useEffect, useCallback } from 'react';
import { Book } from '@/types';
import { getBooks, saveBooks } from '@/lib/storage';

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
    commitStore(loadStore().filter((b) => b.id !== id));
  }, []);

  const getBook = useCallback((id: string) => loadStore().find((b) => b.id === id), []);

  const reorderBooks = useCallback((orderedIds: string[]) => {
    const map = new Map(loadStore().map((b) => [b.id, b]));
    const reordered = orderedIds.map((id) => map.get(id)).filter(Boolean) as Book[];
    commitStore(reordered);
  }, []);

  return { books, loaded, addBook, updateBook, deleteBook, getBook, reorderBooks };
}
