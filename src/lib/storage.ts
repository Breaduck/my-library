import { Book } from '@/types';

const KEY = 'book-tracker';

// 로컬(사용자 시간대) 기준 YYYY-MM-DD — UTC(toISOString) 대신 사용해 '오늘' 경계 오차 방지
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

// ── 삭제 툼스톤 (지운 책이 병합/동기화에서 되살아나지 않게) ──────────────
const TOMB_KEY = 'deleted-book-ids';
export function getTombstones(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(TOMB_KEY) || '[]'); } catch { return []; }
}
export function setTombstones(ids: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOMB_KEY, JSON.stringify(Array.from(new Set(ids))));
}
export function addTombstone(id: string): void {
  const t = getTombstones();
  if (!t.includes(id)) { t.push(id); setTombstones(t); }
}
export function removeTombstone(id: string): void {
  setTombstones(getTombstones().filter((x) => x !== id));
}

// ── 합집합 병합 (툼스톤 제외, updatedAt 최신 우선) — 절대 책을 잃지 않음 ──
export function mergeBooks(local: Book[], remote: Book[], tombstones: string[] = []): Book[] {
  const dead = new Set(tombstones);
  const byId = new Map<string, Book>();
  const order: string[] = [];
  for (const b of local) {
    if (dead.has(b.id)) continue;
    if (!byId.has(b.id)) order.push(b.id);
    byId.set(b.id, b);
  }
  for (const b of remote) {
    if (dead.has(b.id)) continue;
    const ex = byId.get(b.id);
    if (!ex) { order.push(b.id); byId.set(b.id, b); continue; }
    const et = ex.updatedAt ?? ex.createdAt ?? '';
    const rt = b.updatedAt ?? b.createdAt ?? '';
    if (rt > et) byId.set(b.id, b);
  }
  return order.map((id) => byId.get(id)!);
}

const DATES_KEY = 'reading-dates';

export function logReadingDate(): void {
  if (typeof window === 'undefined') return;
  const date = localDate();
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
  const today = localDate();
  const yesterday = localDate(new Date(Date.now() - 86400000));
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round((new Date(sorted[i - 1]).getTime() - new Date(sorted[i]).getTime()) / 86400000);
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
  const date = localDate();
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
  const date = localDate();
  const existing = getDailyReadings();
  const idx = existing.findIndex((d) => d.date === date && d.bookId === bookId);
  if (idx >= 0) existing[idx].pages += delta;
  else existing.push({ date, pages: delta, bookId });
  localStorage.setItem(DAILY_KEY, JSON.stringify(existing));
  logReadingDate();
}

export function getTodayPages(bookId?: string): number {
  const today = localDate();
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

// 특정 책의 시작일~완독일 사이 일별 읽은 페이지. 실제 기록이 있으면 그대로,
// 없으면(하루 만에 다 읽었거나 기록 없이 완독 처리한 경우) 총 페이지를 기간에 균등 분배해 보여준다.
export function getDailyPagesForBook(book: Book): { date: string; pages: number }[] {
  const real = getDailyReadings().filter((d) => d.bookId === book.id);
  if (real.length > 0) {
    const map = new Map<string, number>();
    for (const r of real) map.set(r.date, (map.get(r.date) ?? 0) + r.pages);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, pages]) => ({ date, pages }));
  }
  if (!book.pages) return [];
  const start = book.startDate || book.endDate;
  const end = book.endDate || book.startDate;
  if (!start) return [];
  const startD = new Date(start);
  const endD = new Date(end);
  const dayCount = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1);
  const perDay = Math.floor(book.pages / dayCount);
  const remainder = book.pages - perDay * dayCount;
  const result: { date: string; pages: number }[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startD.getTime() + i * 86400000);
    result.push({ date: localDate(d), pages: perDay + (i < remainder ? 1 : 0) });
  }
  return result;
}

// 특정 책의 일별 기록 전체를 덮어쓴다. getDailyPagesForBook이 반환한(실제 기록이든
// 균등 분배된 값이든) 배열을 그대로 넘기면, 그 시점부터는 항상 "실제 기록"으로 취급된다.
export function setDailyPagesBulkForBook(entries: { date: string; pages: number }[], bookId: string): void {
  if (typeof window === 'undefined') return;
  const others = getDailyReadings().filter((d) => d.bookId !== bookId);
  const mine = entries.filter((e) => e.pages > 0).map((e) => ({ date: e.date, pages: e.pages, bookId }));
  localStorage.setItem(DAILY_KEY, JSON.stringify([...others, ...mine]));
}

export function getWeeklyPages(): { date: string; pages: number; label: string }[] {
  const readings = getDailyReadings();
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const date = localDate(d);
    const pages = readings.filter((r) => r.date === date).reduce((s, r) => s + r.pages, 0);
    const label = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    result.push({ date, pages, label });
  }
  return result;
}

export function hasDoneReadingToday(): boolean {
  if (typeof window === 'undefined') return false;
  const today = localDate();
  const lastShown = localStorage.getItem('daily-popup-date');
  return lastShown === today;
}

export function markDailyPopupShown(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('daily-popup-date', localDate());
}

// ── 독서 기록 공개 범위 (친구 기능용) ──────────────────────────────────
export type Visibility = 'private' | 'all' | 'select';
const VISIBILITY_KEY = 'reading-visibility';
const SHARED_IDS_KEY = 'shared-book-ids';

export function getVisibility(): Visibility {
  if (typeof window === 'undefined') return 'all';
  const v = localStorage.getItem(VISIBILITY_KEY);
  return v === 'private' || v === 'select' ? v : 'all';
}

export function setVisibility(v: Visibility): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VISIBILITY_KEY, v);
  window.dispatchEvent(new CustomEvent('visibility:changed'));
}

export function getSharedBookIds(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(SHARED_IDS_KEY) || '[]'); } catch { return []; }
}

export function setSharedBookIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SHARED_IDS_KEY, JSON.stringify(Array.from(new Set(ids))));
  window.dispatchEvent(new CustomEvent('visibility:changed'));
}

export function toggleSharedBookId(id: string, shared: boolean): void {
  const ids = new Set(getSharedBookIds());
  if (shared) ids.add(id); else ids.delete(id);
  setSharedBookIds(Array.from(ids));
}

// 공개 범위 설정에 따라 친구에게 동기화할 책만 걸러냄
export function filterSharedBooks(books: Book[]): Book[] {
  const v = getVisibility();
  if (v === 'private') return [];
  if (v === 'all') return books;
  const ids = new Set(getSharedBookIds());
  return books.filter((b) => ids.has(b.id));
}

const SHARE_REVIEWS_KEY = 'share-reviews';
const SHARE_STATS_KEY = 'share-stats';

export function getShareReviews(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SHARE_REVIEWS_KEY) === '1';
}

export function setShareReviews(v: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SHARE_REVIEWS_KEY, v ? '1' : '0');
  window.dispatchEvent(new CustomEvent('visibility:changed'));
}

export function getShareStats(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SHARE_STATS_KEY) === '1';
}

export function setShareStats(v: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SHARE_STATS_KEY, v ? '1' : '0');
  window.dispatchEvent(new CustomEvent('visibility:changed'));
}

// 공개 범위(전체/일부) + 독서록 공개 여부를 함께 반영해 친구에게 보낼 책 데이터를 준비
export function prepareSharedBooks(books: Book[]): Book[] {
  const filtered = filterSharedBooks(books);
  if (getShareReviews()) return filtered;
  return filtered.map((b) => ({ ...b, review: '' }));
}

export interface ReadingStats {
  totalBooks: number;
  doneBooks: number;
  avgRating: number;
  totalPages: number;
}

export function computeReadingStats(books: Book[]): ReadingStats {
  const done = books.filter((b) => b.status === 'done');
  const rated = done.filter((b) => b.rating > 0);
  const avgRating = rated.length > 0 ? rated.reduce((s, b) => s + b.rating, 0) / rated.length : 0;
  const totalPages = done.reduce((s, b) => s + (b.pages ?? 0), 0);
  return {
    totalBooks: books.length,
    doneBooks: done.length,
    avgRating: Math.round(avgRating * 10) / 10,
    totalPages,
  };
}

// ── 백업(내보내기) / 복원(가져오기) ───────────────────────────────────
export function exportData(): string {
  const dump = {
    app: 'my-library',
    version: 1,
    exportedAt: new Date().toISOString(),
    books: getBooks(),
    dailyReadings: getDailyReadings(),
    readingDates: (() => { try { return JSON.parse(localStorage.getItem(DATES_KEY) || '[]'); } catch { return []; } })(),
    settings: {
      readingGoal: localStorage.getItem('reading-goal'),
      monthlyGoal: localStorage.getItem('reading-goal-monthly'),
      dailyGoal: localStorage.getItem('daily-page-goal'),
    },
  };
  return JSON.stringify(dump, null, 2);
}

// mode: 'merge' = 합치기(안전), 'replace' = 통째 교체
export function importData(json: string, mode: 'merge' | 'replace'): { books: number } {
  const data = JSON.parse(json);
  const incoming: Book[] = Array.isArray(data) ? data : (data.books ?? []);
  if (!Array.isArray(incoming)) throw new Error('올바른 백업 파일이 아니에요');

  const next = mode === 'replace' ? incoming : mergeBooks(getBooks(), incoming, getTombstones());
  saveBooks(next);

  const dr: DailyReading[] | undefined = Array.isArray(data) ? undefined : data.dailyReadings;
  if (dr) {
    if (mode === 'replace') {
      localStorage.setItem(DAILY_KEY, JSON.stringify(dr));
    } else {
      const cur = getDailyReadings();
      const k = (r: DailyReading) => `${r.date}|${r.bookId ?? ''}`;
      const map = new Map(cur.map((r) => [k(r), r]));
      for (const r of dr) if (!map.has(k(r))) map.set(k(r), r);
      localStorage.setItem(DAILY_KEY, JSON.stringify([...map.values()]));
    }
  }

  const rd: string[] | undefined = Array.isArray(data) ? undefined : data.readingDates;
  if (rd) {
    const cur = mode === 'replace' ? [] : (() => { try { return JSON.parse(localStorage.getItem(DATES_KEY) || '[]'); } catch { return []; } })();
    localStorage.setItem(DATES_KEY, JSON.stringify(Array.from(new Set([...cur, ...rd]))));
  }

  if (!Array.isArray(data) && data.settings && mode === 'replace') {
    const s = data.settings;
    if (s.readingGoal) localStorage.setItem('reading-goal', String(s.readingGoal));
    if (s.monthlyGoal) localStorage.setItem('reading-goal-monthly', String(s.monthlyGoal));
    if (s.dailyGoal) localStorage.setItem('daily-page-goal', String(s.dailyGoal));
  }

  window.dispatchEvent(new CustomEvent<Book[]>('books:replace', { detail: getBooks() }));
  return { books: next.length };
}
