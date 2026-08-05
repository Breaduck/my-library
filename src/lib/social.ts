import { getToken } from '@/lib/googleDrive';
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

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  if (!token) throw new Error('not-signed-in');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) throw new Error(`social-error-${res.status}`);
  return res;
}

export async function getProfile(): Promise<ServerProfile | null> {
  const res = await apiFetch('/profile');
  const data = await res.json() as { profile: ServerProfile | null };
  return data.profile;
}

export async function saveProfile(fields: { name?: string; googlePicture?: string; customPicture?: string | null; customName?: string | null }): Promise<ServerProfile> {
  const res = await apiFetch('/profile', { method: 'POST', body: JSON.stringify(fields) });
  const data = await res.json() as { profile: ServerProfile };
  return data.profile;
}

export async function listFriends(): Promise<FriendsData> {
  const res = await apiFetch('/friends');
  return await res.json() as FriendsData;
}

async function friendAction(action: string, email: string): Promise<void> {
  await apiFetch('/friends', { method: 'POST', body: JSON.stringify({ action, email }) });
}

export const inviteFriend = (email: string) => friendAction('invite', email);
export const acceptFriend = (email: string) => friendAction('accept', email);
export const declineFriend = (email: string) => friendAction('decline', email);
export const removeFriend = (email: string) => friendAction('remove', email);

export async function lookupByNickname(nickname: string): Promise<FriendEntry[]> {
  const res = await apiFetch(`/lookup?nickname=${encodeURIComponent(nickname)}`);
  const data = await res.json() as { users: FriendEntry[] };
  return data.users;
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
