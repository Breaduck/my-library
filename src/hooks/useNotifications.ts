import { useState, useEffect, useCallback, useRef } from 'react';
import * as social from '@/lib/social';

const LAST_READ_KEY = 'notif-last-read';        // 이 시각 이후 댓글은 '안 읽음'
const BROWSER_KEY = 'notif-browser-enabled';    // 브라우저 알림(푸시) 켜짐 여부

export function getBrowserNotifEnabled(): boolean {
  return localStorage.getItem(BROWSER_KEY) === '1';
}
export function setBrowserNotifEnabled(v: boolean) {
  localStorage.setItem(BROWSER_KEY, v ? '1' : '0');
}

function getLastRead(): string {
  return localStorage.getItem(LAST_READ_KEY) ?? '';
}

// 앱이 열려 있는 동안 새 댓글이 들어오면 브라우저 알림을 띄운다(권한 허용 + 설정 ON일 때만).
function maybeNotify(items: social.NotificationEntry[]) {
  if (!getBrowserNotifEnabled()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  for (const n of items) {
    try {
      new Notification(`${n.authorName}님의 댓글`, {
        body: `《${n.bookTitle}》 ${n.text}`,
        tag: `comment-${n.id}`,
        icon: n.coverUrl || undefined,
      });
    } catch { /* 일부 브라우저는 SW 없이는 실패 — 무시 */ }
  }
}

export function useNotifications(active: boolean) {
  const [items, setItems] = useState<social.NotificationEntry[]>([]);
  const [unread, setUnread] = useState(0);
  // 이미 브라우저 알림을 띄운 최신 createdAt — 폴링 때 중복 알림 방지
  const notifiedAfter = useRef<string>(getLastRead());

  const load = useCallback(async () => {
    try {
      const list = await social.getNotifications();
      setItems(list);
      const lastRead = getLastRead();
      setUnread(list.filter((n) => n.createdAt > lastRead).length);

      const fresh = list.filter((n) => n.createdAt > notifiedAfter.current);
      if (fresh.length > 0) {
        maybeNotify(fresh);
        notifiedAfter.current = fresh[0].createdAt; // list는 최신순
      }
    } catch { /* 비로그인/네트워크 실패는 조용히 무시 */ }
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const run = () => { if (!cancelled) void load(); };
    run();
    const onFocus = () => run();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(run, 60_000);
    return () => { cancelled = true; window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, [active, load]);

  const markAllRead = useCallback(() => {
    const latest = items[0]?.createdAt;
    // 미래로 새지 않게 가장 최근 댓글 시각을 기준으로(없으면 현재)
    const stamp = latest && latest > new Date().toISOString() ? latest : new Date().toISOString();
    localStorage.setItem(LAST_READ_KEY, stamp);
    setUnread(0);
  }, [items]);

  return { items, unread, markAllRead, refresh: load };
}
