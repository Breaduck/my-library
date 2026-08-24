import { useState, useCallback, useEffect } from 'react';
import * as social from '@/lib/social';
import { FriendsData, FriendEntry, SharedBook, CommentEntry } from '@/lib/social';
import { ReadingStats } from '@/lib/storage';

// 친구들의 최근 독서 활동 피드 — 각 친구의 공유 책을 모아 최신순 정렬
export interface ActivityItem {
  friend: FriendEntry;
  book: SharedBook;
}

export function useFriendActivity(friends: FriendEntry[], limit = 8) {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (friends.length === 0) { setItems([]); return; }
    let cancelled = false;
    Promise.all(
      friends.map((f) =>
        social.getFriendBooks(f.email)
          .then((bs) => bs.map((book) => ({ friend: f, book })))
          .catch(() => [] as ActivityItem[])
      )
    ).then((all) => {
      if (cancelled) return;
      setItems(
        all.flat()
          .filter((i) => i.book.updatedAt)
          .sort((a, b) => b.book.updatedAt.localeCompare(a.book.updatedAt))
          .slice(0, limit)
      );
    });
    return () => { cancelled = true; };
  }, [friends, limit]);

  return items;
}

export function useFriendStats(email: string | undefined) {
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    setLoading(true);
    social.getFriendStats(email)
      .then((s) => { if (!cancelled) setStats(s); })
      .catch(() => { if (!cancelled) setStats(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [email]);

  return { stats, loading };
}

export function usePendingRequestCount(active: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const load = () => {
      social.listFriends()
        .then((d) => { if (!cancelled) setCount(d.incoming.length); })
        .catch(() => {});
    };
    load();
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.removeEventListener('focus', load); };
  }, [active]);

  return count;
}

// 친구 목록을 로컬에 캐시한다. 데스크톱에선 새로고침 때 메모리상의 구글 토큰이 사라져
// listFriends가 잠시 실패하는데, 캐시가 없으면 "친구 없음"으로 깜빡여 친구가 사라진 것처럼 보인다.
// 계정이 바뀌면 남의 친구가 보이면 안 되므로 소유 계정(owner)과 함께 저장/검증한다.
const FRIENDS_CACHE_KEY = 'friends-cache-v1';
const EMPTY_FRIENDS: FriendsData = { friends: [], incoming: [], outgoing: [] };

function currentOwner(): string {
  try { return localStorage.getItem('book-tracker-owner') || ''; } catch { return ''; }
}
function loadFriendsCache(): FriendsData {
  try {
    const raw = JSON.parse(localStorage.getItem(FRIENDS_CACHE_KEY) || 'null');
    if (raw && raw.owner === currentOwner() && raw.data) return raw.data as FriendsData;
  } catch { /* ignore */ }
  return EMPTY_FRIENDS;
}
function saveFriendsCache(data: FriendsData) {
  try { localStorage.setItem(FRIENDS_CACHE_KEY, JSON.stringify({ owner: currentOwner(), data })); } catch { /* ignore */ }
}

export function useFriends(active: boolean) {
  const [data, setData] = useState<FriendsData>(loadFriendsCache);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await social.listFriends();
      setData(res);
      saveFriendsCache(res); // 성공했을 때만 캐시 갱신 — 실패 시엔 직전 목록을 그대로 유지
    } catch {
      setError('친구 정보를 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) void refresh();
  }, [active, refresh]);

  const invite = useCallback(async (email: string) => {
    await social.inviteFriend(email);
    await refresh();
  }, [refresh]);

  const accept = useCallback(async (email: string) => {
    await social.acceptFriend(email);
    await refresh();
  }, [refresh]);

  const decline = useCallback(async (email: string) => {
    await social.declineFriend(email);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (email: string) => {
    await social.removeFriend(email);
    await refresh();
  }, [refresh]);

  return { ...data, loading, error, refresh, invite, accept, decline, remove };
}

export function useFriendBooks(email: string | undefined) {
  const [books, setBooks] = useState<SharedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    setLoading(true);
    social.getFriendBooks(email)
      .then((b) => { if (!cancelled) setBooks(b); })
      .catch(() => { if (!cancelled) setError('책 목록을 불러오지 못했어요'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [email]);

  return { books, loading, error };
}

export function useComments(owner: string | undefined, bookId: string | undefined) {
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!owner || !bookId) return;
    setLoading(true);
    try {
      const res = await social.getComments(owner, bookId);
      setComments(res);
    } finally {
      setLoading(false);
    }
  }, [owner, bookId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const add = useCallback(async (text: string, authorName?: string) => {
    if (!owner || !bookId) return;
    await social.addComment(owner, bookId, text, authorName);
    await refresh();
  }, [owner, bookId, refresh]);

  return { comments, loading, add, refresh };
}
