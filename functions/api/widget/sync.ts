// 홈화면 위젯용 통계 업로드 — 로그인(구글 토큰) 필요. 최초 호출 시 개인 위젯 토큰을 발급한다.
import { requireEmail, json } from '../../_lib/auth';

interface Env { DB: D1Database; VITE_GOOGLE_CLIENT_ID?: string }

interface Body {
  streak?: number; xp?: number; level?: number; levelTitle?: string;
  todayPages?: number; dailyGoal?: number; freezes?: number; readToday?: boolean; displayName?: string;
  weekRead?: string; weekToday?: number;
}

// 마이그레이션을 따로 돌리지 않아도 되도록 첫 호출에서 테이블/컬럼을 보장한다.
async function ensureTable(db: D1Database): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS widget_data (
    email TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    streak INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    level_title TEXT,
    today_pages INTEGER NOT NULL DEFAULT 0,
    daily_goal INTEGER NOT NULL DEFAULT 30,
    freezes INTEGER NOT NULL DEFAULT 0,
    read_today INTEGER NOT NULL DEFAULT 0,
    display_name TEXT,
    week_read TEXT,
    week_today INTEGER,
    updated_at TEXT NOT NULL
  )`).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_widget_token ON widget_data(token)').run();
  // 기존에 만들어진 테이블엔 컬럼이 없으므로 추가(이미 있으면 에러 무시)
  try { await db.prepare('ALTER TABLE widget_data ADD COLUMN week_read TEXT').run(); } catch { /* exists */ }
  try { await db.prepare('ALTER TABLE widget_data ADD COLUMN week_today INTEGER').run(); } catch { /* exists */ }
}

function genToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const me = await requireEmail(request, env.VITE_GOOGLE_CLIENT_ID);
  if (!me) return json({ error: 'unauthorized' }, 401);
  await ensureTable(env.DB);

  const b = await request.json() as Body;

  // 기존 토큰이 있으면 유지(위젯 URL이 바뀌지 않게), 없으면 새로 발급
  const existing = await env.DB.prepare('SELECT token FROM widget_data WHERE email = ?').bind(me).first<{ token: string }>();
  const token = existing?.token ?? genToken();

  await env.DB.prepare(
    `INSERT INTO widget_data (email, token, streak, xp, level, level_title, today_pages, daily_goal, freezes, read_today, display_name, week_read, week_today, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       streak = excluded.streak, xp = excluded.xp, level = excluded.level, level_title = excluded.level_title,
       today_pages = excluded.today_pages, daily_goal = excluded.daily_goal, freezes = excluded.freezes,
       read_today = excluded.read_today, display_name = excluded.display_name,
       week_read = excluded.week_read, week_today = excluded.week_today, updated_at = excluded.updated_at`
  ).bind(
    me, token,
    b.streak ?? 0, b.xp ?? 0, b.level ?? 1, b.levelTitle ?? '',
    b.todayPages ?? 0, b.dailyGoal ?? 30, b.freezes ?? 0, b.readToday ? 1 : 0,
    b.displayName ?? '', b.weekRead ?? '0000000', b.weekToday ?? 0, new Date().toISOString(),
  ).run();

  return json({ token });
};
