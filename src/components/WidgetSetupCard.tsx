import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getToken } from '@/lib/googleDrive';
import { enableWidget, getWidgetToken, widgetDataUrl } from '@/lib/widget';

const cs = { boxShadow: '0 2px 16px rgba(0,0,0,0.06)' };

// Scriptable에 붙여넣을 위젯 스크립트. __URL__/__OPEN__ 만 개인 값으로 치환한다.
// (백틱·${} 를 쓰지 않아 템플릿 리터럴에 그대로 담아도 안전)
const SCRIPT_TEMPLATE = `// 나의 서재 - 홈화면 위젯 (Scriptable)
const DATA_URL = "__URL__";
const OPEN_URL = "__OPEN__";

let r = null;
try { r = await new Request(DATA_URL).loadJSON(); } catch (e) { r = null; }

const w = new ListWidget();
const g = new LinearGradient();
g.colors = [new Color("#1E2A4A"), new Color("#2B2154")];
g.locations = [0, 1];
w.backgroundGradient = g;
w.setPadding(16, 16, 16, 16);
w.url = OPEN_URL;

if (!r) {
  const t = w.addText("데이터를 불러올 수 없어요");
  t.textColor = Color.white();
  t.font = Font.systemFont(13);
} else {
  const top = w.addStack();
  top.centerAlignContent();
  const fire = top.addText(r.readToday ? "🔥" : "🌫️");
  fire.font = Font.systemFont(18);
  top.addSpacer(5);
  const streak = top.addText(String(r.streak) + "일 연속");
  streak.font = Font.boldSystemFont(18);
  streak.textColor = Color.white();
  top.addSpacer();
  const nm = top.addText(r.displayName ? r.displayName : "나의 서재");
  nm.font = Font.systemFont(11);
  nm.textColor = new Color("#FFFFFF", 0.55);

  w.addSpacer(10);
  const msg = w.addText(r.readToday ? "오늘 독서 완료!" : "오늘 아직이에요 - 읽어요!");
  msg.font = Font.semiboldSystemFont(13);
  msg.textColor = r.readToday ? new Color("#67E8F9") : new Color("#FDBA74");

  w.addSpacer(8);
  const pct = Math.max(0, Math.min(1, r.todayPages / Math.max(1, r.dailyGoal)));
  const bar = w.addImage(drawBar(pct));
  bar.imageSize = new Size(320, 10);
  bar.cornerRadius = 5;
  w.addSpacer(5);
  const goal = w.addText("오늘 " + r.todayPages + " / " + r.dailyGoal + "쪽");
  goal.font = Font.systemFont(11);
  goal.textColor = new Color("#FFFFFF", 0.7);

  w.addSpacer(10);
  const row = w.addStack();
  row.centerAlignContent();
  chip(row, "⚡ " + r.xp);
  row.addSpacer(8);
  chip(row, "Lv." + r.level);
  row.addSpacer(8);
  chip(row, "❄️ " + r.freezes);
}

function chip(stack, text) {
  const s = stack.addStack();
  s.backgroundColor = new Color("#FFFFFF", 0.12);
  s.cornerRadius = 8;
  s.setPadding(4, 8, 4, 8);
  const t = s.addText(text);
  t.font = Font.mediumSystemFont(12);
  t.textColor = new Color("#FFFFFF", 0.9);
}

function drawBar(p) {
  const W = 320, H = 10;
  const dc = new DrawContext();
  dc.size = new Size(W, H);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const bg = new Path();
  bg.addRoundedRect(new Rect(0, 0, W, H), 5, 5);
  dc.setFillColor(new Color("#FFFFFF", 0.18));
  dc.addPath(bg);
  dc.fillPath();
  const fw = Math.max(W * p, 8);
  const fp = new Path();
  fp.addRoundedRect(new Rect(0, 0, fw, H), 5, 5);
  dc.setFillColor(new Color("#22D3EE"));
  dc.addPath(fp);
  dc.fillPath();
  return dc.getImage();
}

Script.setWidget(w);
if (config.widgetFamily === "small") w.presentSmall();
else w.presentMedium();
Script.complete();
`;

export default function WidgetSetupCard() {
  const { signedIn, displayName, syncNow } = useAuth();
  const [token, setToken] = useState<string | null>(() => getWidgetToken());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'url' | 'script' | null>(null);
  const [open, setOpen] = useState(false);

  const url = token ? widgetDataUrl(token) : '';
  const script = token ? SCRIPT_TEMPLATE.replace('__URL__', url).replace('__OPEN__', window.location.origin) : '';

  async function handleEnable() {
    setBusy(true); setError('');
    try {
      // 화면엔 로그인돼 보여도 실제 구글 토큰이 만료됐을 수 있다(캐시 로그인).
      // 토큰이 없으면 사용자 제스처 안에서 조용히 재연결한 뒤, 토큰이 들어올 때까지 잠깐 기다린다.
      if (!getToken()) {
        void syncNow();
        for (let i = 0; i < 20 && !getToken(); i++) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      if (!getToken()) {
        setError('로그인 연결이 만료됐어요. 설정 맨 위 "지금 동기화"를 눌러 다시 연결한 뒤 시도해주세요');
        return;
      }
      const t = await enableWidget(displayName || '나의 서재');
      if (t) { setToken(t); setOpen(true); }
      else setError('토큰 발급에 실패했어요. 잠시 후 다시 시도해주세요');
    } catch {
      setError('연결에 실패했어요. 잠시 후 다시 시도해주세요');
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, which: 'url' | 'script') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch { /* ignore */ }
  }

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6" style={cs}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base leading-none">📱</span>
        <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#AEAEB2]">홈화면 위젯</h2>
      </div>
      <p className="text-[13px] text-[#1D1D1F] font-medium mb-1">아이패드·아이폰 홈화면에 독서 위젯 놓기</p>
      <p className="text-[12px] text-[#8E8E93] leading-relaxed mb-4">
        무료 앱 <b>Scriptable</b>로 연속일·XP·오늘 목표를 홈화면에서 바로 볼 수 있어요.
      </p>

      {!signedIn ? (
        <p className="text-[12px] text-[#AEAEB2]">로그인하면 홈화면 위젯을 쓸 수 있어요.</p>
      ) : !token ? (
        <>
          <button onClick={handleEnable} disabled={busy}
            className="w-full py-3 rounded-xl text-white text-sm font-bold active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#3B7DE8,#6C4DE8)' }}>
            {busy ? '준비 중...' : '홈화면 위젯 켜기'}
          </button>
          {error && <p className="text-[11px] text-red-500 mt-2">{error}</p>}
        </>
      ) : (
        <div className="space-y-3">
          {/* 개인 데이터 URL */}
          <div>
            <p className="text-[11px] font-semibold text-[#6E6E73] mb-1">① 내 위젯 주소 (비밀 URL)</p>
            <div className="flex gap-2">
              <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#F5F5F7] text-[11px] text-[#6E6E73] outline-none" />
              <button onClick={() => copy(url, 'url')}
                className="px-3 py-2 rounded-lg bg-[#1D1D1F] text-white text-[11px] font-bold flex-shrink-0 active:scale-95 transition-transform">
                {copied === 'url' ? '복사됨' : '복사'}
              </button>
            </div>
          </div>

          {/* 스크립트 복사 */}
          <div>
            <p className="text-[11px] font-semibold text-[#6E6E73] mb-1">② 위젯 스크립트 (내 주소가 이미 들어있어요)</p>
            <button onClick={() => copy(script, 'script')}
              className="w-full py-2.5 rounded-lg text-white text-[13px] font-bold active:scale-[0.98] transition-transform"
              style={{ background: 'linear-gradient(135deg,#22D3EE,#0EA5E9)' }}>
              {copied === 'script' ? '✓ 스크립트 복사됨!' : 'Scriptable 스크립트 복사'}
            </button>
          </div>

          {/* 설치 방법 */}
          <button onClick={() => setOpen((v) => !v)} className="text-[12px] font-semibold text-[#3B7DE8]">
            {open ? '설치 방법 접기' : '설치 방법 보기 ▾'}
          </button>
          {open && (
            <ol className="text-[12px] text-[#6E6E73] leading-relaxed space-y-1.5 list-decimal pl-4 pt-1">
              <li>App Store에서 <b>Scriptable</b>(무료) 설치</li>
              <li>Scriptable 열기 → 우측 상단 <b>＋</b> → 위 <b>스크립트 복사</b> 버튼 누른 내용을 붙여넣고 이름을 "나의 서재"로 저장</li>
              <li>홈화면 빈 곳 <b>길게 누르기</b> → 좌측 상단 <b>＋</b> → <b>Scriptable</b> 검색 → 중간/작은 위젯 추가</li>
              <li>추가된 위젯을 <b>길게 눌러 "위젯 편집"</b> → Script를 <b>"나의 서재"</b>로 선택</li>
              <li>끝! 앱을 가끔 열면 최신 기록이 위젯에 반영돼요 (iOS가 주기적으로 갱신).</li>
            </ol>
          )}

          <p className="text-[11px] text-[#AEAEB2] pt-1">
            ⚠️ 위젯 주소는 내 기록을 보여주는 개인 비밀 링크예요. 남에게 공유하지 마세요.
          </p>
        </div>
      )}
    </div>
  );
}
