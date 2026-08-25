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

// 홈 화면의 일일 퀘스트 카드 — 듀오링고식 "오늘 할 일 3개 + 보상 받기"
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
    <div className="mb-4 rounded-2xl overflow-hidden relative"
      style={{ background: 'linear-gradient(160deg, #1E2A4A 0%, #16203A 100%)', boxShadow: '0 4px 20px rgba(22,32,58,0.35)' }}>
      {/* 헤더: 제목 + 보석 잔액 + 끄기 */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">🎯</span>
          <p className="text-white text-[13px] font-bold">오늘의 퀘스트</p>
          <span className="text-[10px] font-semibold text-white/40 tabular-nums">{claimedCount}/{quests.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold text-cyan-200 tabular-nums"
            style={{ background: 'rgba(103,232,249,0.12)', border: '1px solid rgba(103,232,249,0.25)' }}>
            💎 {gems.toLocaleString()}
          </span>
          {onTurnOff && (
            <button onClick={() => { setGameMode(false); onTurnOff(); }}
              className="text-[10px] text-white/35 hover:text-white/60 transition-colors" aria-label="게임 모드 끄기">
              끄기
            </button>
          )}
        </div>
      </div>

      {/* 퀘스트 목록 */}
      <div className="px-3 pb-3 space-y-1.5">
        {quests.map((q) => {
          const pct = Math.round((q.progress / q.target) * 100);
          return (
            <div key={q.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: q.claimed ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)' }}>
              <span className="text-lg leading-none flex-shrink-0" style={{ opacity: q.claimed ? 0.4 : 1 }}>{q.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className={`text-[12px] font-semibold truncate ${q.claimed ? 'text-white/35 line-through' : 'text-white/90'}`}>{q.title}</p>
                  <span className="text-[10px] text-white/40 tabular-nums flex-shrink-0 ml-2">{q.progress}/{q.target}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.10)' }}>
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
                  style={{ background: 'rgba(52,211,153,0.15)' }}>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </span>
              ) : q.done ? (
                <button onClick={() => handleClaim(q.id)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold text-[#16203A] active:scale-95 transition-transform animate-pulse"
                  style={{ background: 'linear-gradient(135deg,#67E8F9,#22D3EE)', boxShadow: '0 0 14px rgba(34,211,238,0.45)' }}>
                  💎{q.reward} 받기
                </button>
              ) : (
                <span className="flex-shrink-0 text-[10px] font-bold text-white/30 tabular-nums">💎{q.reward}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 올클리어 배너 or 상점 */}
      <div className="px-3 pb-3">
        {allClaimed ? (
          <div className="rounded-xl px-3 py-2 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.10))', border: '1px solid rgba(251,191,36,0.25)' }}>
            <p className="text-[11px] font-bold text-amber-300">🏆 오늘 퀘스트 올클리어! 내일 새 퀘스트가 기다려요</p>
          </div>
        ) : (
          <p className="text-[10px] text-white/30 text-center">퀘스트 3개를 모두 받으면 보너스 💎{COMBO_BONUS}</p>
        )}
      </div>

      {/* 상점 — 보석으로 연속 보호막 구매 */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'rgba(0,0,0,0.18)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-lg leading-none flex-shrink-0">❄️</span>
        <div className="flex-1 min-w-0">
          <p className="text-white/85 text-[12px] font-semibold">연속 보호막 <span className="text-white/40 font-normal">보유 {freezes}/2</span></p>
          <p className="text-white/35 text-[10px] mt-0.5">하루 놓쳐도 스트릭이 안 끊겨요</p>
        </div>
        <button onClick={handleBuyFreeze} disabled={gems < FREEZE_COST || freezes >= 2}
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95 disabled:opacity-35"
          style={{
            background: gems >= FREEZE_COST && freezes < 2 ? 'rgba(103,232,249,0.15)' : 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(103,232,249,0.3)', color: '#A5F3FC',
          }}>
          {freezes >= 2 ? '최대 보유' : `💎${FREEZE_COST} 구매`}
        </button>
      </div>

      {/* 보상 토스트 */}
      {toast && (
        <div className="absolute inset-x-0 top-2 flex justify-center pointer-events-none z-10">
          <span className="px-4 py-2 rounded-full text-[12px] font-bold text-[#16203A] animate-[questToast_1.8s_ease-out]"
            style={{ background: 'linear-gradient(135deg,#FDE68A,#FBBF24)', boxShadow: '0 6px 20px rgba(251,191,36,0.5)' }}>
            {toast}
          </span>
          <style>{`@keyframes questToast{0%{transform:translateY(-8px) scale(0.8);opacity:0}15%{transform:translateY(0) scale(1.05);opacity:1}25%{transform:scale(1)}80%{opacity:1}100%{opacity:0}}`}</style>
        </div>
      )}
    </div>
  );
}
