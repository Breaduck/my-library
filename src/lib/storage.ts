import { Book } from '@/types';

const KEY = 'book-tracker';

export function getBooks(): Book[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveBooks(books: Book[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(books));
  window.dispatchEvent(new CustomEvent('books:changed', { detail: books }));
}

const DATES_KEY = 'reading-dates';

export function logReadingDate(): void {
  if (typeof window === 'undefined') return;
  const date = new Date().toISOString().slice(0, 10);
  const existing: string[] = JSON.parse(localStorage.getItem(DATES_KEY) || '[]');
  if (!existing.includes(date)) {
    existing.push(date);
    localStorage.setItem(DATES_KEY, JSON.stringify(existing));
  }
}

export function getReadingStreak(): number {
  if (typeof window === 'undefined') return 0;
  const dates: string[] = JSON.parse(localStorage.getItem(DATES_KEY) || '[]');
  if (dates.length === 0) return 0;
  const sorted = [...dates].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round((new Date(sorted[i-1]).getTime() - new Date(sorted[i]).getTime()) / 86400000);
    if (diff === 1) streak++; else break;
  }
  return streak;
}
