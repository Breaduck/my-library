// 홈화면 위젯이 호출하는 공개 데이터 엔드포인트 — 토큰이 곧 인증(개인 비밀 URL).
// 브라우저가 아닌 Scriptable이 호출하지만 안전하게 CORS 허용 헤더를 붙인다.
interface Env { DB: D1Database }

interface Row {
  streak: number; xp: number; level: number; level_title: string | null;
  today_pages: number; daily_goal: number; freezes: number; read_today: number;
  display_name: string | null; updated_at: string;
}

function jsonCors(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const token = (url.searchParams.get('token') ?? '').trim();
  if (!token) return jsonCors({ error: 'missing-token' }, 400);

  let row: Row | null = null;
  try {
    row = await env.DB.prepare('SELECT * FROM widget_data WHERE token = ?').bind(token).first<Row>();
  } catch {
    // 테이블이 아직 없으면(위젯을 한 번도 안 켬) 없는 것으로 처리
    return jsonCors({ error: 'not-found' }, 404);
  }
  if (!row) return jsonCors({ error: 'not-found' }, 404);

  return jsonCors({
    streak: row.streak,
    xp: row.xp,
    level: row.level,
    levelTitle: row.level_title ?? '',
    todayPages: row.today_pages,
    dailyGoal: row.daily_goal,
    freezes: row.freezes,
    readToday: !!row.read_today,
    displayName: row.display_name ?? '',
    updatedAt: row.updated_at,
  });
};
