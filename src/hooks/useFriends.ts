import { useState, useCallback, useEffect } from 'react';
import * as social from '@/lib/social';
import { FriendsData, SharedBook, CommentEntry } from '@/lib/social';

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

export function useFriends(active: boolean) {
  const [data, setData] = useState<FriendsData>({ friends: [], incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await social.listFriends();
      setData(res);
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
