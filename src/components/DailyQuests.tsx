import { useState } from 'react';
import {
  getDailyQuests, claimQuest, tryClaimCombo, getGems,
  buyFreeze, FREEZE_COST, COMBO_BONUS, setGameMode,
} from '@/lib/game';
import { getStreakFreezes } from '@/lib/storage';

interface Props {
  onChanged?: () => void;   // 보석/보호막 등 상태가 바뀌었을 때 부모 갱신
  onTurnOff?: () => void;   // 게임 모드 끄기
}

// 일일 퀘스트 카드 — 듀오링고식 "오늘 할 일 3개 + 보상 받기".
// 게이미피케이션 카드와 같은 반투명 유리(glass) 톤으로 맞춘다.
export default function DailyQuests({ onChanged, onTurnOff }: Props) {
  const [, setTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const quests = getDailyQuests();
  const gems = getGems();
  const freezes = getStreakFreezes();
  const claimedCount = quests.filter((q) => q.claimed).length;
  const allClaimed = claimedCount === quests.length;

  function refresh() { setTick((n) => n + 1); onChanged?.(); }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  function handleClaim(id: string) {
    const got = claimQuest(id);
    if (got != null) {
      const combo = tryClaimCombo();
      showToast(combo != null ? `💎 +${got} · 올클리어 보너스 +${combo}!` : `💎 +${got} 획득!`);
      refresh();
    }
  }

  function handleBuyFreeze() {
    if (buyFreeze()) { showToast('❄️ 연속 보호막 획득!'); refresh(); }
  }

  return (
    <div className="mb-4 rounded-3xl overflow-hidden relative text-[#1D1D1F]"
      style={{
        background: 'radial-gradient(120% 90% at 0% 0%, rgba(34,211,238,0.16), transparent 46%), radial-gradient(110% 85% at 100% 0%, rgba(129,140,248,0.15), transparent 46%), rgba(255,255,255,0.72)',
        backdropFilter: 'blur(22px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.7)',
        border: '1px solid rgba(255,255,255,0.85)',
        boxShadow: '0 8px 32px rgba(80,90,130,0.14), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}>
      {/* 상단 광택 하이라이트 */}
      <div className="absolute -top-16 left-0 right-0 h-32 pointer-events-none" style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, transparent 100%)',
      }} />

      {/* 헤더: 제목 + 보석 잔액 + 끄기 */}
      <div className="relative flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">🎯</span>
          <p className="text-[13px] font-bold text-[#1D1D1F]">오늘의 퀘스트</p>
          <span className="text-[10px] font-semibold text-[#8E8E93] tabular-nums">{claimedCount}/{quests.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-[#0E7490] tabular-nums"
            style={{ background: 'rgba(34,211,238,0.14)', border: '1px solid rgba(34,211,238,0.30)' }}>
            💎 {gems.toLocaleString()}
          </span>
          {onTurnOff && (
            <button onClick={() => { setGameMode(false); onTurnOff(); }}
              className="text-[10px] text-[#AEAEB2] hover:text-[#6E6E73] transition-colors" aria-label="게임 모드 끄기">
              끄기
            </button>
          )}
        </div>
      </div>

      {/* 퀘스트 목록 */}
      <div className="relative px-3.5 pb-3 space-y-1.5">
        {quests.map((q) => {
          const pct = Math.round((q.progress / q.target) * 100);
          return (
            <div key={q.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
              style={{
                background: q.claimed ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.62)',
                border: '1px solid rgba(0,0,0,0.05)',
              }}>
              <span className="text-lg leading-none flex-shrink-0" style={{ opacity: q.claimed ? 0.4 : 1 }}>{q.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className={`text-[12px] font-semibold truncate ${q.claimed ? 'text-[#AEAEB2] line-through' : 'text-[#1D1D1F]'}`}>{q.title}</p>
                  <span className="text-[10px] text-[#8E8E93] tabular-nums flex-shrink-0 ml-2">{q.progress}/{q.target}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.07)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: q.done ? 'linear-gradient(90deg,#34D399,#10B981)' : 'linear-gradient(90deg,#FBBF24,#F59E0B)',
                    }} />
                </div>
              </div>
              {/* 보상 영역 */}
              {q.claimed ? (
                <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(52,211,153,0.16)' }}>
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </span>
              ) : q.done ? (
                <button onClick={() => handleClaim(q.id)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold text-white active:scale-95 transition-transform animate-pulse"
                  style={{ background: 'linear-gradient(135deg,#22D3EE,#0EA5E9)', boxShadow: '0 3px 12px rgba(14,165,233,0.40)' }}>
                  💎{q.reward} 받기
                </button>
              ) : (
                <span className="flex-shrink-0 text-[10px] font-bold text-[#AEAEB2] tabular-nums">💎{q.reward}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 올클리어 배너 or 안내 */}
      <div className="relative px-3.5 pb-3">
        {allClaimed ? (
          <div className="rounded-2xl px-3 py-2 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.12))', border: '1px solid rgba(245,158,11,0.28)' }}>
            <p className="text-[11px] font-bold text-amber-600">🏆 오늘 퀘스트 올클리어! 내일 새 퀘스트가 기다려요</p>
          </div>
        ) : (
          <p className="text-[10px] text-[#AEAEB2] text-center">퀘스트 3개를 모두 받으면 보너스 💎{COMBO_BONUS}</p>
        )}
      </div>

      {/* 상점 — 보석으로 연속 보호막 구매 */}
      <div className="relative flex items-center gap-3 px-5 py-3.5"
        style={{ background: 'rgba(255,255,255,0.45)', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <span className="text-lg leading-none flex-shrink-0">❄️</span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#1D1D1F]">연속 보호막 <span className="text-[#8E8E93] font-normal">보유 {freezes}/2</span></p>
          <p className="text-[10px] text-[#8E8E93] mt-0.5">하루 놓쳐도 스트릭이 안 끊겨요</p>
        </div>
        <button onClick={handleBuyFreeze} disabled={gems < FREEZE_COST || freezes >= 2}
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95 disabled:opacity-40"
          style={{
            background: gems >= FREEZE_COST && freezes < 2 ? 'rgba(34,211,238,0.15)' : 'rgba(0,0,0,0.04)',
            border: '1px solid rgba(14,165,233,0.35)', color: '#0369A1',
          }}>
          {freezes >= 2 ? '최대 보유' : `💎${FREEZE_COST} 구매`}
        </button>
      </div>

      {/* 보상 토스트 */}
      {toast && (
        <div className="absolute inset-x-0 top-2 flex justify-center pointer-events-none z-10">
          <span className="px-4 py-2 rounded-full text-[12px] font-bold text-[#78350F] animate-[questToast_1.8s_ease-out]"
            style={{ background: 'linear-gradient(135deg,#FDE68A,#FBBF24)', boxShadow: '0 6px 20px rgba(251,191,36,0.5)' }}>
            {toast}
          </span>
          <style>{`@keyframes questToast{0%{transform:translateY(-8px) scale(0.8);opacity:0}15%{transform:translateY(0) scale(1.05);opacity:1}25%{transform:scale(1)}80%{opacity:1}100%{opacity:0}}`}</style>
        </div>
      )}
    </div>
  );
}
