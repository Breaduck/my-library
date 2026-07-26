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

export interface DailyReading {
  date: string;
  pages: number;
  bookId?: string;
}

const DAILY_KEY = 'daily-reading';

export function getDailyReadings(): DailyReading[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(DAILY_KEY) || '[]');
  } catch {
    return [];
  }
}

// pages: replaces today's value for that (book or general) entry.
export function logDailyPages(pages: number, bookId?: string): void {
  if (typeof window === 'undefined') return;
  const date = new Date().toISOString().slice(0, 10);
  const existing = getDailyReadings();
  const idx = existing.findIndex((d) => d.date === date && d.bookId === bookId);
  if (idx >= 0) {
    if (pages > 0) existing[idx] = { date, pages, bookId };
    else existing.splice(idx, 1);
  } else if (pages > 0) {
    existing.push({ date, pages, bookId });
  }
  localStorage.setItem(DAILY_KEY, JSON.stringify(existing));
  if (pages > 0) logReadingDate();
}

// Add `delta` pages to today's entry for the given (or unscoped) bookId.
export function addDailyPages(delta: number, bookId?: string): void {
  if (delta <= 0) return;
  const date = new Date().toISOString().slice(0, 10);
  const existing = getDailyReadings();
  const idx = existing.findIndex((d) => d.date === date && d.bookId === bookId);
  if (idx >= 0) existing[idx].pages += delta;
  else existing.push({ date, pages: delta, bookId });
  localStorage.setItem(DAILY_KEY, JSON.stringify(existing));
  logReadingDate();
}

export function getTodayPages(bookId?: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const all = getDailyReadings().filter((d) => d.date === today);
  if (bookId === undefined) return all.reduce((s, d) => s + d.pages, 0);
  return all.find((d) => d.bookId === bookId)?.pages ?? 0;
}

export function setDailyPages(date: string, pages: number): void {
  if (typeof window === 'undefined') return;
  const existing = getDailyReadings();
  const filtered = existing.filter((d) => d.date !== date);
  if (pages > 0) filtered.push({ date, pages });
  localStorage.setItem(DAILY_KEY, JSON.stringify(filtered));
  if (pages > 0) {
    const dates: string[] = JSON.parse(localStorage.getItem(DATES_KEY) || '[]');
    if (!dates.includes(date)) {
      dates.push(date);
      localStorage.setItem(DATES_KEY, JSON.stringify(dates));
    }
  }
}

export function getWeeklyPages(): { date: string; pages: number; label: string }[] {
  const readings = getDailyReadings();
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const date = d.toISOString().slice(0, 10);
    const pages = readings.filter((r) => r.date === date).reduce((s, r) => s + r.pages, 0);
    const label = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    result.push({ date, pages, label });
  }
  return result;
}

export function hasDoneReadingToday(): boolean {
  if (typeof window === 'undefined') return false;
  const today = new Date().toISOString().slice(0, 10);
  const lastShown = localStorage.getItem('daily-popup-date');
  return lastShown === today;
}

export function markDailyPopupShown(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('daily-popup-date', new Date().toISOString().slice(0, 10));
}
