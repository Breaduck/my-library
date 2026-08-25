// 홈화면 위젯(Scriptable) 연동 — 앱의 독서 통계를 서버에 올리고, 개인 토큰/URL을 관리한다.
import { getBooks, getDailyReadings, getReadingStreak, getTodayPages, getStreakFreezes, hasReadToday } from './storage';
import { levelFromXp } from './levels';
import { syncWidget, WidgetPayload } from './social';

const TOKEN_KEY = 'widget-token';

export function getWidgetToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setWidgetToken(t: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearWidgetToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

// 위젯에 표시할 통계를 로컬 데이터에서 계산 (게이미피케이션 카드와 동일한 XP 규칙)
export function computeWidgetStats(displayName: string): WidgetPayload {
  const books = getBooks();
  const daily = getDailyReadings();
  const done = books.filter((b) => b.status === 'done');
  const pagesFromDaily = daily.reduce((s, r) => s + r.pages, 0);
  const pagesFromDone = done.reduce((s, b) => s + (b.pages ?? 0), 0);
  const totalPages = Math.max(pagesFromDaily, pagesFromDone);
  const xp = totalPages + done.length * 100;
  const lv = levelFromXp(xp);
  const dailyGoal = parseInt(localStorage.getItem('daily-page-goal') || '30', 10) || 30;
  return {
    streak: getReadingStreak(),
    xp,
    level: lv.level,
    levelTitle: lv.title,
    todayPages: getTodayPages(),
    dailyGoal,
    freezes: getStreakFreezes(),
    readToday: hasReadToday(),
    displayName,
  };
}

// 최초 활성화 — 토큰 발급받아 저장하고 반환
export async function enableWidget(displayName: string): Promise<string> {
  const token = await syncWidget(computeWidgetStats(displayName));
  if (token) setWidgetToken(token);
  return token;
}

// 위젯을 켠 적이 있으면(토큰 보유) 최신 통계를 조용히 서버에 반영. 실패는 무시.
export async function pushWidgetIfEnabled(displayName: string): Promise<void> {
  if (!getWidgetToken()) return;
  try {
    const t = await syncWidget(computeWidgetStats(displayName));
    if (t) setWidgetToken(t);
  } catch { /* ignore */ }
}

// 개인 위젯 데이터 URL (Scriptable이 호출)
export function widgetDataUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/api/widget/data?token=${token}`;
}
