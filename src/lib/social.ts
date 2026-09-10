import { getToken, ensureToken, invalidateToken } from '@/lib/googleDrive';
import { getSessionToken, ensureSession, clearSession } from '@/lib/session';
import { Book } from '@/types';
import { ReadingStats } from '@/lib/storage';

const BASE = '/api/social';

export interface ServerProfile {
  email: string;
  name: string;
  customName: string;
  googlePicture: string;
  customPicture: string;
}

export interface FriendEntry {
  email: string;
  name: string;
  picture: string;
  createdAt?: string;
}

export interface FriendsData {
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
}

export interface SharedBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  status: string;
  rating: number;
  currentPage: number;
  pages: number;
  review: string;
  updatedAt: string;
}

export interface CommentEntry {
  id: number;
  authorEmail: string;
  authorName: string;
  text: string;
  createdAt: string;
}

// 인증이 끊겨 실패한 요청 — 호출부에서 "결과 없음"과 구분해 안내하기 위한 전용 오류.
export class AuthRequiredError extends Error {
  constructor() { super('auth-required'); this.name = 'AuthRequiredError'; }
}
export function isAuthError(e: unknown): boolean {
  return e instanceof AuthRequiredError;
}

function send(fullPath: string, token: string, options: RequestInit): Promise<Response> {
  return fetch(fullPath, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
}

// 인증 순서:
//  1) 우리 세션 토큰(90일, 쓸 때마다 연장) — 기본 경로. 구글 토큰이 만료돼도 계속 동작한다.
//  2) 세션이 아직 없으면 구글 토큰으로 세션을 발급받아 쓴다.
//  3) 그래도 없으면(로그인 자체가 안 됨) 사용자 조작일 때만 구글 재인증을 시도한다.
// 예전엔 구글 토큰만 썼기 때문에 한 시간만 지나면 모든 소셜 요청이 조용히 실패했다
// (닉네임 검색 0건, 초대/수락 무반응). 세션 토큰 도입으로 그 구간이 사라진다.
// ★ 구글 재인증은 팝업을 띄울 수 있어 사용자 조작(interactive)에서만 허용한다.
async function authFetch(fullPath: string, options: RequestInit = {}, interactive = false): Promise<Response> {
  let token: string | null = getSessionToken();
  if (!token) token = await ensureSession();
  if (!token) {
    // 세션을 못 받았다 = 구글 토큰도 없다. 구글 토큰으로 직접 보내는 경로를 유지(구버전 호환).
    token = getToken();
    if (!token && interactive) {
      token = await ensureToken();
      if (token) token = (await ensureSession()) ?? token;
    }
  }
  if (!token) throw new AuthRequiredError();

  let res = await send(fullPath, token, options);
  if (res.status === 401) {
    // 세션이 만료/해지됐거나 구글 토큰이 죽었다 → 한 번만 새로 받아 재시도.
    clearSession();
    invalidateToken();
    let fresh: string | null = await ensureSession();
    if (!fresh && interactive) {
      const google = await ensureToken();
      if (google) fresh = (await ensureSession()) ?? google;
    }
    if (!fresh) throw new AuthRequiredError();
    res = await send(fullPath, fresh, options);
    if (res.status === 401) throw new AuthRequiredError();
  }
  if (!res.ok) throw new Error(`social-error-${res.status}`);
  return res;
}

function apiFetch(path: string, options: RequestInit = {}, interactive = false): Promise<Response> {
  return authFetch(`${BASE}${path}`, options, interactive);
}

export async function getProfile(): Promise<ServerProfile | null> {
  const res = await apiFetch('/profile');
  const data = await res.json() as { profile: ServerProfile | null };
  return data.profile;
}

// ── 홈화면 위젯(Scriptable)용 통계 업로드 ──────────────────────────
export interface WidgetPayload {
  streak: number; xp: number; level: number; levelTitle: string;
  todayPages: number; dailyGoal: number; freezes: number; readToday: boolean; displayName: string;
  weekRead: string;   // 이번 주 일~토 독서 여부, '1'/'0' 7자리
  weekToday: number;  // 오늘 요일 인덱스 0(일)~6(토)
}
// 성공 시 개인 위젯 토큰을 반환(최초엔 서버가 발급, 이후엔 동일 토큰 유지)
export async function syncWidget(payload: WidgetPayload): Promise<string> {
  const res = await authFetch('/api/widget/sync', { method: 'POST', body: JSON.stringify(payload) });
  const data = await res.json() as { token?: string };
  return data.token ?? '';
}

export async function saveProfile(fields: { name?: string; googlePicture?: string; customPicture?: string | null; customName?: string | null }): Promise<ServerProfile> {
  const res = await apiFetch('/profile', { method: 'POST', body: JSON.stringify(fields) });
  const data = await res.json() as { profile: ServerProfile };
  return data.profile;
}

// interactive=true는 사용자가 '다시 연결'을 눌렀을 때만 — 만료된 토큰을 재발급받아 불러온다.
export async function listFriends(interactive = false): Promise<FriendsData> {
  const res = await apiFetch('/friends', {}, interactive);
  return await res.json() as FriendsData;
}

// 친구 관련 동작은 모두 사용자 버튼 클릭에서 시작되므로 interactive(필요 시 재인증) 허용.
async function friendAction(action: string, email: string): Promise<InviteResult> {
  const res = await apiFetch('/friends', { method: 'POST', body: JSON.stringify({ action, email }) }, true);
  return await res.json() as InviteResult;
}

// 서버가 알려주는 초대 결과 — 'pending'(요청 보냄) | 'accepted'(맞초대로 즉시 친구)
// | 'already-exists'(이미 요청/친구 상태) | 'already-friends'
export type InviteStatus = 'pending' | 'accepted' | 'already-exists' | 'already-friends';
export interface InviteResult { ok?: boolean; status?: InviteStatus; error?: string }

export const inviteFriend = (email: string) => friendAction('invite', email);
export const acceptFriend = (email: string) => friendAction('accept', email);
export const declineFriend = (email: string) => friendAction('decline', email);
export const removeFriend = (email: string) => friendAction('remove', email);

export async function lookupByNickname(nickname: string): Promise<FriendEntry[]> {
  const res = await apiFetch(`/lookup?nickname=${encodeURIComponent(nickname)}`, {}, true);
  const data = await res.json() as { users: FriendEntry[] };
  return data.users;
}

export interface NotificationEntry {
  id: number;
  bookId: string;
  bookTitle: string;
  coverUrl: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export async function getNotifications(): Promise<NotificationEntry[]> {
  const res = await apiFetch('/notifications');
  const data = await res.json() as { notifications: NotificationEntry[] };
  return data.notifications;
}

export async function syncMyBooks(books: Book[]): Promise<void> {
  const payload = books.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    coverUrl: b.coverUrl,
    status: b.status,
    rating: b.rating,
    currentPage: b.currentPage ?? 0,
    pages: b.pages ?? 0,
    review: b.review ?? '',
    updatedAt: b.updatedAt ?? b.createdAt,
  }));
  await apiFetch('/books', { method: 'POST', body: JSON.stringify({ books: payload }) });
}

export async function getFriendBooks(email: string): Promise<SharedBook[]> {
  const res = await apiFetch(`/books?email=${encodeURIComponent(email)}`);
  const data = await res.json() as { books: SharedBook[] };
  return data.books;
}

export async function getComments(owner: string, bookId: string): Promise<CommentEntry[]> {
  const res = await apiFetch(`/comments?owner=${encodeURIComponent(owner)}&bookId=${encodeURIComponent(bookId)}`);
  const data = await res.json() as { comments: CommentEntry[] };
  return data.comments;
}

export async function addComment(owner: string, bookId: string, text: string, authorName?: string): Promise<void> {
  await apiFetch('/comments', { method: 'POST', body: JSON.stringify({ owner, bookId, text, authorName }) });
}

export async function syncMyStats(stats: ReadingStats): Promise<void> {
  await apiFetch('/stats', { method: 'POST', body: JSON.stringify(stats) });
}

export async function clearMyStats(): Promise<void> {
  await apiFetch('/stats', { method: 'DELETE' });
}

export async function getFriendStats(email: string): Promise<ReadingStats | null> {
  const res = await apiFetch(`/stats?email=${encodeURIComponent(email)}`);
  const data = await res.json() as { stats: ReadingStats | null };
  return data.stats;
}

// ── 서버 백업 (Drive와 별개) ──────────────────────────────────────────────
// Drive 백업은 구글 토큰이 살아 있을 때만 동작해서, 만료 구간의 변경은 로컬에만 남았다.
// 이 백업은 세션 토큰(90일)으로 인증하므로 그 공백을 메운다.
export interface BackupMeta {
  tombstones?: string[];
  dailyReadings?: unknown[];
  readingDates?: string[];
  goals?: { readingGoal?: string; monthlyGoal?: string; dailyGoal?: string };
  personalResetAt?: string;
}

export async function saveBackup(books: Book[], meta: BackupMeta): Promise<void> {
  await authFetch('/api/backup/books', { method: 'POST', body: JSON.stringify({ books, meta }) });
}

export async function loadBackup(): Promise<{ books: Book[]; meta: BackupMeta | null; updatedAt: string }> {
  const res = await authFetch('/api/backup/books');
  const data = await res.json() as { books?: Book[]; meta?: BackupMeta | null; updatedAt?: string };
  return { books: data.books ?? [], meta: data.meta ?? null, updatedAt: data.updatedAt ?? '' };
}

export interface AdminStats {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  active7d: number;
  active30d: number;
  totalFriendships: number;
  totalComments: number;
  totalSharedBooks: number;
  signupsByDay: { day: string; c: number }[];
  recentUsers: { email: string; name: string; createdAt: string; lastSeenAt: string; activeMinutes: number }[];
  readingTotals: { totalBooks: number; doneBooks: number; totalPages: number; avgRating: number };
  statusBreakdown: { status: string; count: number }[];
  streakLeaders: { email: string; name: string; streak: number; level: number; levelTitle: string }[];
  recentComments: { id: number; ownerEmail: string; bookId: string; authorName: string; text: string; createdAt: string }[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const res = await authFetch('/api/admin/stats');
  return await res.json() as AdminStats;
}

export async function sendHeartbeat(seconds: number): Promise<void> {
  await authFetch('/api/admin/heartbeat', { method: 'POST', body: JSON.stringify({ seconds }) });
}
