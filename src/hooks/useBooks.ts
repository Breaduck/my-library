'use client';
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

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setBooks(getBooks().map(migrate));
    setLoaded(true);
  }, []);

  // Listen for Drive sync → replace all books
  useEffect(() => {
    const handler = (e: Event) => {
      const incoming = (e as CustomEvent<Book[]>).detail;
      const migrated = incoming.map(migrate);
      setBooks(migrated);
      saveBooks(migrated);
    };
    window.addEventListener('books:replace', handler);
    return () => window.removeEventListener('books:replace', handler);
  }, []);

  const addBook = useCallback((data: Omit<Book, 'id' | 'createdAt'>) => {
    const book: Book = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setBooks((prev) => {
      const updated = [book, ...prev];
      saveBooks(updated);
      return updated;
    });
    return book;
  }, []);

  const updateBook = useCallback((id: string, data: Partial<Omit<Book, 'id' | 'createdAt'>>) => {
    setBooks((prev) => {
      const updated = prev.map((b) => (b.id === id ? { ...b, ...data } : b));
      saveBooks(updated);
      return updated;
    });
  }, []);

  const deleteBook = useCallback((id: string) => {
    setBooks((prev) => {
      const updated = prev.filter((b) => b.id !== id);
      saveBooks(updated);
      return updated;
    });
  }, []);

  const getBook = useCallback((id: string) => books.find((b) => b.id === id), [books]);

  const reorderBooks = useCallback((orderedIds: string[]) => {
    setBooks((prev) => {
      const map = new Map(prev.map((b) => [b.id, b]));
      const reordered = orderedIds.map((id) => map.get(id)).filter(Boolean) as Book[];
      saveBooks(reordered);
      return reordered;
    });
  }, []);

  return { books, loaded, addBook, updateBook, deleteBook, getBook, reorderBooks };
}
