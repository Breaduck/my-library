// 게임 모드 — 듀오링고식 일일 퀘스트 · 보석(젬) 경제 · 상점.
// 설계 원칙:
//  - 매일 접속할 이유: 날짜 기반으로 매일 조금씩 달라지는 퀘스트 3개(읽기·타이머·도장)
//  - 보상의 순환: 퀘스트 → 보석 → 상점(연속 보호막 구매) → 스트릭 보호 → 다시 퀘스트
//  - 로컬 전용(기기별): 핵심 독서 데이터 동기화 스키마를 건드리지 않는다(스트릭 프리즈와 동일한 원칙)
import { localDate, getTodayPages, hasReadToday, getStreakFreezes, addStreakFreeze } from './storage';

const MODE_KEY = 'game-mode';
const GEMS_KEY = 'game-gems';
const CLAIMS_KEY = 'game-quest-claims';    // { date, ids: [] } — 오늘 받은 퀘스트 보상
const TIMER_KEY = 'daily-timer-seconds';   // { 'YYYY-MM-DD': seconds } — 타이머 퀘스트 진행도용
const LEVEL_SEEN_KEY = 'game-level-seen';  // 레벨업 축하를 이미 보여준 레벨

export const FREEZE_COST = 150;            // 연속 보호막 가격(보석)
export const LEVELUP_BONUS = 50;           // 레벨업 축하 보너스 보석

// ── 게임 모드 on/off ─────────────────────────────────────────────
export function getGameMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MODE_KEY) === '1';
}
export function setGameMode(on: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MODE_KEY, on ? '1' : '0');
}

// ── 보석 ────────────────────────────────────────────────────────
export function getGems(): number {
  if (typeof window === 'undefined') return 0;
  try { return Math.max(0, parseInt(localStorage.getItem(GEMS_KEY) || '0', 10) || 0); } catch { return 0; }
}
function setGems(n: number): void {
  localStorage.setItem(GEMS_KEY, String(Math.max(0, n)));
}
export function addGems(n: number): void {
  if (typeof window === 'undefined' || n <= 0) return;
  setGems(getGems() + n);
}

// ── 타이머 사용 기록(오늘 몇 분 읽었는지) ─────────────────────────
// TimerPage가 시간을 저장할 때마다 호출. 최근 14일만 유지해 무한히 커지지 않게 한다.
export function logTimerSeconds(sec: number): void {
  if (typeof window === 'undefined' || sec <= 0) return;
  try {
    const map: Record<string, number> = JSON.parse(localStorage.getItem(TIMER_KEY) || '{}');
    const today = localDate();
    map[today] = (map[today] ?? 0) + sec;
    const cutoff = localDate(new Date(Date.now() - 14 * 86400000));
    for (const k of Object.keys(map)) if (k < cutoff) delete map[k];
    localStorage.setItem(TIMER_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}
export function getTodayTimerSeconds(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const map: Record<string, number> = JSON.parse(localStorage.getItem(TIMER_KEY) || '{}');
    return map[localDate()] ?? 0;
  } catch { return 0; }
}

// ── 일일 퀘스트 ──────────────────────────────────────────────────
export interface Quest {
  id: string;
  icon: string;
  title: string;
  target: number;
  progress: number;  // 0..target
  reward: number;    // 보석
  done: boolean;
  claimed: boolean;
}

// 날짜 문자열 → 안정적인 해시(매일 같은 퀘스트, 날마다 다른 조합)
function hashDate(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function getClaimedIds(today: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CLAIMS_KEY) || 'null') as { date?: string; ids?: string[] } | null;
    return raw && raw.date === today && Array.isArray(raw.ids) ? raw.ids : [];
  } catch { return []; }
}
function setClaimedIds(today: string, ids: string[]): void {
  localStorage.setItem(CLAIMS_KEY, JSON.stringify({ date: today, ids }));
}

export function getDailyQuests(): Quest[] {
  if (typeof window === 'undefined') return [];
  const today = localDate();
  const h = hashDate(today);
  // 매일 목표가 살짝 달라진다 — 지루하지 않게, 그러나 항상 달성 가능한 수준으로
  const pageTarget = [15, 20, 25, 30][h % 4];
  const minTarget = [10, 15, 20, 30][(h >> 3) % 4];
  const claimed = getClaimedIds(today);

  const pages = getTodayPages();
  const mins = Math.floor(getTodayTimerSeconds() / 60);
  const stamped = hasReadToday();

  const mk = (id: string, icon: string, title: string, target: number, progress: number, reward: number): Quest => ({
    id, icon, title, target,
    progress: Math.min(progress, target),
    reward,
    done: progress >= target,
    claimed: claimed.includes(id),
  });

  return [
    mk('stamp', '🔥', '오늘의 독서 도장 찍기', 1, stamped ? 1 : 0, 20),
    mk('pages', '📖', `${pageTarget}쪽 읽기`, pageTarget, pages, 30),
    mk('timer', '⏱️', `타이머로 ${minTarget}분 읽기`, minTarget, mins, 40),
  ];
}

// 완료한 퀘스트의 보상 수령. 성공 시 받은 보석 수, 아니면 null.
export function claimQuest(id: string): number | null {
  if (typeof window === 'undefined') return null;
  const today = localDate();
  const quest = getDailyQuests().find((q) => q.id === id);
  if (!quest || !quest.done || quest.claimed) return null;
  setClaimedIds(today, [...getClaimedIds(today), id]);
  addGems(quest.reward);
  return quest.reward;
}

// 오늘 퀘스트 3개를 모두 받으면 추가 보너스(콤보) — 전부 수령한 순간 1회
const COMBO_KEY = 'game-combo-claimed';
export const COMBO_BONUS = 30;
export function tryClaimCombo(): number | null {
  if (typeof window === 'undefined') return null;
  const today = localDate();
  if (localStorage.getItem(COMBO_KEY) === today) return null;
  const quests = getDailyQuests();
  if (!quests.every((q) => q.claimed)) return null;
  localStorage.setItem(COMBO_KEY, today);
  addGems(COMBO_BONUS);
  return COMBO_BONUS;
}

// ── 상점 ────────────────────────────────────────────────────────
export function buyFreeze(): boolean {
  if (typeof window === 'undefined') return false;
  if (getGems() < FREEZE_COST) return false;
  if (getStreakFreezes() >= 2) return false;
  if (!addStreakFreeze(1)) return false;
  setGems(getGems() - FREEZE_COST);
  return true;
}

// ── 레벨업 감지(축하 연출용) ─────────────────────────────────────
// 반환: 처음 도달한 새 레벨이면 그 레벨 번호, 아니면 null. 호출 즉시 '본 것'으로 기록.
export function checkLevelUp(currentLevelIdx: number): number | null {
  if (typeof window === 'undefined') return null;
  const seen = parseInt(localStorage.getItem(LEVEL_SEEN_KEY) || '-1', 10);
  if (seen < 0) { localStorage.setItem(LEVEL_SEEN_KEY, String(currentLevelIdx)); return null; } // 최초 방문 — 축하 없이 기준만 저장
  if (currentLevelIdx > seen) {
    localStorage.setItem(LEVEL_SEEN_KEY, String(currentLevelIdx));
    addGems(LEVELUP_BONUS);
    return currentLevelIdx;
  }
  return null;
}
