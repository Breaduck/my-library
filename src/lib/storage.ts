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

let quotaWarned = false;
export function saveBooks(books: Book[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(books));
  } catch {
    // localStorage 용량 초과 — 조용히 삼키면 새로고침 시 기록이 사라진 것처럼 보이므로 반드시 알림.
    // (로그인 상태라면 아래 이벤트로 Drive에는 그대로 백업되므로 데이터 자체는 지킬 수 있다)
    if (!quotaWarned) {
      quotaWarned = true;
      alert('저장 공간이 가득 차서 이 브라우저에 기록을 저장하지 못했어요.\n표지 이미지가 큰 책을 지우거나, 로그인해서 Drive 백업을 켜주세요.');
    }
  }
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
const GOAL_KEY = 'reading-goal';
const GOAL_MONTHLY_KEY = 'reading-goal-monthly';
const DAILY_GOAL_KEY = 'daily-page-goal';
// 개인 기록(일별·연속·목표) 리셋 에포크. "모든 기록 초기화"가 이 값을 현재 시각으로 올리면,
// 이보다 오래된 기록은 어느 기기에서 병합돼 오더라도 폐기된다(개인 기록용 툼스톤 역할).
const RESET_KEY = 'personal-reset-at';

export function getPersonalResetAt(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(RESET_KEY) || '';
}
export function setPersonalResetAt(iso: string): void {
  if (typeof window === 'undefined') return;
  if (iso) localStorage.setItem(RESET_KEY, iso);
  else localStorage.removeItem(RESET_KEY);
}

export function getReadingDates(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(DATES_KEY) || '[]'); } catch { return []; }
}

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
  date: string;        // 읽은 날(YYYY-MM-DD)
  pages: number;
  bookId?: string;
  loggedAt?: string;   // 이 항목을 기록/수정한 실제 시각(ISO). 리셋 에포크·동시편집 판정에 사용.
}

const DAILY_KEY = 'daily-reading';

function nowIso(): string { return new Date().toISOString(); }

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
    if (pages > 0) existing[idx] = { date, pages, bookId, loggedAt: nowIso() };
    else existing.splice(idx, 1);
  } else if (pages > 0) {
    existing.push({ date, pages, bookId, loggedAt: nowIso() });
  }
  localStorage.setItem(DAILY_KEY, JSON.stringify(existing));
  if (pages > 0) logReadingDate();
}

// 오늘 기록에서 페이지를 빼기 (현재 페이지를 실수로 크게 입력했다가 줄인 경우 보정)
export function subtractDailyPages(amount: number, bookId?: string): void {
  if (typeof window === 'undefined' || amount <= 0) return;
  const date = localDate();
  const existing = getDailyReadings();
  const idx = existing.findIndex((d) => d.date === date && d.bookId === bookId);
  if (idx < 0) return;
  const next = existing[idx].pages - amount;
  if (next > 0) existing[idx] = { ...existing[idx], pages: next, loggedAt: nowIso() };
  else existing.splice(idx, 1);
  localStorage.setItem(DAILY_KEY, JSON.stringify(existing));
}

// Add `delta` pages to today's entry for the given (or unscoped) bookId.
export function addDailyPages(delta: number, bookId?: string): void {
  if (delta <= 0) return;
  const date = localDate();
  const existing = getDailyReadings();
  const idx = existing.findIndex((d) => d.date === date && d.bookId === bookId);
  if (idx >= 0) existing[idx] = { ...existing[idx], pages: existing[idx].pages + delta, loggedAt: nowIso() };
  else existing.push({ date, pages: delta, bookId, loggedAt: nowIso() });
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
  if (pages > 0) filtered.push({ date, pages, loggedAt: nowIso() });
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
  const stamp = nowIso();
  const mine = entries.filter((e) => e.pages > 0).map((e) => ({ date: e.date, pages: e.pages, bookId, loggedAt: stamp }));
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

// ── 개인 기록 정리 ────────────────────────────────────────────────────
// 일별 읽은 페이지·연속 독서 날짜·오늘 팝업 기록 삭제 (사용자 "모든 기록 초기화" 시 사용)
// ★ 리셋 에포크를 현재 시각으로 올려, 이 삭제가 Drive·다른 기기에도 전파되게 한다.
export function clearReadingRecords(): void {
  if (typeof window === 'undefined') return;
  [DAILY_KEY, DATES_KEY, 'daily-popup-date'].forEach((k) => localStorage.removeItem(k));
  setPersonalResetAt(nowIso());
}

// 계정 전환 시 이전 계정의 개인 기록(일별 기록·목표·공개 설정)이 새 계정에 섞이지 않도록 정리.
// 리셋 에포크는 '비움' — 새 계정의 Drive에 있는 에포크를 그대로 채택하기 위함(이전 계정의
// 리셋 시각을 새 계정에 전파하면 안 됨).
export function clearPersonalData(): void {
  if (typeof window === 'undefined') return;
  [
    DAILY_KEY, DATES_KEY, 'daily-popup-date',
    'reading-goal', 'reading-goal-monthly', 'daily-page-goal',
    VISIBILITY_KEY, SHARED_IDS_KEY, SHARE_REVIEWS_KEY, SHARE_STATS_KEY,
    RESET_KEY,
  ].forEach((k) => localStorage.removeItem(k));
}

// ── Drive 백업에 실을 개인 기록(일별 기록·연속 독서·목표) ─────────────────
export interface PersonalData {
  dailyReadings: DailyReading[];
  readingDates: string[];
  goals: { readingGoal?: string; monthlyGoal?: string; dailyGoal?: string };
  personalResetAt?: string; // 리셋 에포크 — 이 시각보다 오래된 기록은 폐기
}

export function getPersonalData(): PersonalData {
  const goals: PersonalData['goals'] = {};
  if (typeof window !== 'undefined') {
    const g = localStorage.getItem(GOAL_KEY); if (g) goals.readingGoal = g;
    const m = localStorage.getItem(GOAL_MONTHLY_KEY); if (m) goals.monthlyGoal = m;
    const d = localStorage.getItem(DAILY_GOAL_KEY); if (d) goals.dailyGoal = d;
  }
  return { dailyReadings: getDailyReadings(), readingDates: getReadingDates(), goals, personalResetAt: getPersonalResetAt() };
}

// 일별 기록 병합.
//  - resetAt보다 오래된(loggedAt < resetAt) 기록은 양쪽 모두에서 폐기 → 리셋이 전 기기에 전파됨.
//    (loggedAt이 없는 레거시 기록은 '리셋 이전'으로 간주 — resetAt이 설정돼 있으면 폐기)
//  - 같은 키가 남으면 loggedAt이 더 나중인 쪽을 채택(최근 편집 우선). loggedAt이 없으면 페이지 큰 쪽.
export function mergeDailyReadings(local: DailyReading[], remote: DailyReading[], resetAt = ''): DailyReading[] {
  const alive = (r: DailyReading) => !resetAt || (r.loggedAt ?? '') >= resetAt;
  const k = (r: DailyReading) => `${r.date}|${r.bookId ?? ''}`;
  const pick = (a: DailyReading, b: DailyReading): DailyReading => {
    const la = a.loggedAt ?? '', lb = b.loggedAt ?? '';
    if (la && lb) return lb > la ? b : a;   // 둘 다 타임스탬프 → 최근 편집 우선(LWW)
    return b.pages > a.pages ? b : a;         // 레거시 → 진도 손실 방지로 큰 값
  };
  const map = new Map<string, DailyReading>();
  for (const r of local) if (alive(r)) map.set(k(r), r);
  for (const r of remote) {
    if (!alive(r)) continue;
    const ex = map.get(k(r));
    map.set(k(r), ex ? pick(ex, r) : r);
  }
  return [...map.values()];
}

// 신뢰할 수 없는(JSON) 배열을 DailyReading[]로 안전 변환
function sanitizeDailyReadings(arr: unknown[]): DailyReading[] {
  const out: DailyReading[] = [];
  for (const r of arr) {
    if (r && typeof r === 'object') {
      const o = r as Record<string, unknown>;
      if (typeof o.date === 'string' && typeof o.pages === 'number') {
        out.push({
          date: o.date, pages: o.pages,
          bookId: typeof o.bookId === 'string' ? o.bookId : undefined,
          loggedAt: typeof o.loggedAt === 'string' ? o.loggedAt : undefined,
        });
      }
    }
  }
  return out;
}

// 원격 개인 기록을 로컬에 병합 반영. 리셋 에포크를 존중해, 리셋 이전 기록은 어느 쪽에서 와도 되살아나지 않는다.
export function applyPersonalData(remote: {
  dailyReadings?: unknown[];
  readingDates?: unknown[];
  goals?: { readingGoal?: string; monthlyGoal?: string; dailyGoal?: string };
  personalResetAt?: string;
} | undefined): void {
  if (typeof window === 'undefined' || !remote) return;

  // 로컬/원격 중 더 나중의 리셋 시각을 채택. 새로 올라간 리셋이면 로컬에도 반영한다.
  const localReset = getPersonalResetAt();
  const remoteReset = typeof remote.personalResetAt === 'string' ? remote.personalResetAt : '';
  const effectiveReset = remoteReset > localReset ? remoteReset : localReset;
  const resetAdvanced = effectiveReset > localReset;
  if (resetAdvanced) setPersonalResetAt(effectiveReset);

  // 일별 기록: 리셋 필터 + 합집합. remote에 dailyReadings가 없어도, 리셋이 올라갔으면
  // 로컬의 오래된 기록을 정리해야 하므로 병합을 수행한다.
  if (Array.isArray(remote.dailyReadings) || resetAdvanced) {
    const remoteDaily = Array.isArray(remote.dailyReadings) ? sanitizeDailyReadings(remote.dailyReadings) : [];
    const merged = mergeDailyReadings(getDailyReadings(), remoteDaily, effectiveReset);
    localStorage.setItem(DAILY_KEY, JSON.stringify(merged));
  }

  // 연속 독서 날짜: 타임스탬프가 없으므로, 리셋이 올라간 순간 로컬을 비우고(이전 기록 폐기)
  // 그 뒤로 원격/로컬의 최신 값만 쌓는다. 리셋이 아니면 단순 합집합.
  if (Array.isArray(remote.readingDates) || resetAdvanced) {
    const remoteDates = Array.isArray(remote.readingDates)
      ? remote.readingDates.filter((d): d is string => typeof d === 'string') : [];
    const base = resetAdvanced ? [] : getReadingDates();
    const merged = Array.from(new Set([...base, ...remoteDates]));
    localStorage.setItem(DATES_KEY, JSON.stringify(merged));
  }

  // 목표는 로컬에 값이 없을 때만 원격 값으로 채운다(현재 기기의 설정을 우선).
  if (remote.goals) {
    if (remote.goals.readingGoal && !localStorage.getItem(GOAL_KEY)) localStorage.setItem(GOAL_KEY, remote.goals.readingGoal);
    if (remote.goals.monthlyGoal && !localStorage.getItem(GOAL_MONTHLY_KEY)) localStorage.setItem(GOAL_MONTHLY_KEY, remote.goals.monthlyGoal);
    if (remote.goals.dailyGoal && !localStorage.getItem(DAILY_GOAL_KEY)) localStorage.setItem(DAILY_GOAL_KEY, remote.goals.dailyGoal);
  }
}

// ── 백업(내보내기) / 복원(가져오기) ───────────────────────────────────
export function exportData(): string {
  const dump = {
    app: 'my-library',
    version: 1,
    exportedAt: new Date().toISOString(),
    books: getBooks(),
    dailyReadings: getDailyReadings(),
    readingDates: getReadingDates(),
    personalResetAt: getPersonalResetAt(),
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

  // 리셋 에포크: replace면 파일 값 채택, merge면 더 나중 값 채택
  const fileReset: string = (!Array.isArray(data) && typeof data.personalResetAt === 'string') ? data.personalResetAt : '';
  const effectiveReset = mode === 'replace' ? fileReset : (fileReset > getPersonalResetAt() ? fileReset : getPersonalResetAt());
  setPersonalResetAt(effectiveReset);

  const dr: DailyReading[] | undefined = Array.isArray(data) ? undefined : data.dailyReadings;
  if (dr) {
    const incoming = sanitizeDailyReadings(dr);
    const base = mode === 'replace' ? [] : getDailyReadings();
    localStorage.setItem(DAILY_KEY, JSON.stringify(mergeDailyReadings(base, incoming, effectiveReset)));
  }

  const rd: string[] | undefined = Array.isArray(data) ? undefined : data.readingDates;
  if (rd) {
    const cur = mode === 'replace' ? [] : getReadingDates();
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
