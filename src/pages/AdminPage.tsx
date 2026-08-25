import { useEffect, useState, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getAdminStats, AdminStats } from '@/lib/social';

const cardShadow = { boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)' };

function fmtDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function fmtMinutes(m: number): string {
  if (!m) return '0분';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0 && min > 0) return `${h}시간 ${min}분`;
  if (h > 0) return `${h}시간`;
  return `${min}분`;
}

// 이름/이메일 기반의 안정적인 아바타 색상
function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function initials(name: string): string {
  const clean = (name || '').replace(/\s+/g, '');
  if (!clean) return '?';
  return /[가-힣]/.test(clean[0]) ? clean.slice(0, 1) : clean.slice(0, 2).toUpperCase();
}

// 최근 접속 상태 — 24시간 이내 초록, 7일 이내 노랑, 그 외 회색
function activityColor(iso: string | null): string {
  if (!iso) return '#C7C7CC';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '#C7C7CC';
  if (diff < 86400_000) return '#34C759';
  if (diff < 7 * 86400_000) return '#FF9500';
  return '#C7C7CC';
}

/* ── 지표 카드 ── */
function StatCard({ icon, label, value, sub, accent }: {
  icon: ReactNode; label: string; value: string | number; sub?: string; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col gap-2.5" style={cardShadow}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}14`, color: accent }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-[#1D1D1F] tabular-nums leading-none">{value}</p>
        <p className="text-[12px] text-[#6E6E73] mt-1.5">{label}</p>
        {sub && <p className="text-[11px] text-[#AEAEB2] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const ICONS = {
  users: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-2.5-1.34" /></svg>,
  pulse: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12h4l2 6 4-14 2 8h6" /></svg>,
  friends: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8a3 3 0 100-6 3 3 0 000 6zm0 2c-3 0-6 1.5-6 4v2h12v-2c0-2.5-3-4-6-4z" /></svg>,
  comment: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8M8 14h5m-9 6l3-3h9a3 3 0 003-3V7a3 3 0 00-3-3H6a3 3 0 00-3 3v13z" /></svg>,
  book: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.5C10.5 5.5 8 5 5 5v12c3 0 5.5.5 7 1.5 1.5-1 4-1.5 7-1.5V5c-3 0-5.5.5-7 1.5zm0 0V18" /></svg>,
};

export default function AdminPage() {
  const { signedIn, state } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state === 'idle') { setLoading(false); return; }
    // 새로고침 직후 등 토큰이 아직 조용히 재연결되는 중이면(connecting/saving) 기다렸다가 요청한다.
    if (state === 'connecting' || state === 'saving') { setLoading(true); return; }
    let cancelled = false;
    if (state === 'error') {
      setLoading(false);
      setError('로그인 연결에 실패했어요. 설정에서 동기화를 눌러보세요');
      return () => { cancelled = true; };
    }
    setLoading(true);
    getAdminStats()
      .then((s) => { if (!cancelled) { setStats(s); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e?.message === 'social-error-403' ? '관리자 권한이 없어요' : '불러오지 못했어요'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [state]);

  if (!signedIn) {
    return <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center"><p className="text-sm text-[#6E6E73]">로그인이 필요해요</p></div>;
  }
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-[#D1D1D6] border-t-[#3B7DE8] rounded-full animate-spin" />
      </div>
    );
  }
  if (error || !stats) {
    return <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-6"><p className="text-sm text-red-500 text-center">{error ?? '오류'}</p></div>;
  }

  const maxDay = Math.max(...stats.signupsByDay.map((d) => d.c), 1);
  const peakDay = stats.signupsByDay.reduce<{ day: string; c: number } | null>((a, d) => (a && a.c >= d.c ? a : d), null);
  const periodTotal = stats.signupsByDay.reduce((s, d) => s + d.c, 0);
  const retention = stats.totalUsers > 0 ? Math.round((stats.active30d / stats.totalUsers) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 page-pt pb-16">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="flex items-center justify-center w-9 h-9 rounded-full bg-white hover:bg-gray-50 transition-colors flex-shrink-0" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}>
            <svg className="w-4 h-4 text-[#1D1D1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight leading-none">관리자 대시보드</h1>
            <p className="text-[12px] text-[#AEAEB2] mt-1">서비스 현황 한눈에 보기</p>
          </div>
        </div>

        {/* 히어로 — 총 가입자 */}
        <div className="rounded-3xl p-6 mb-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #3B7DE8 0%, #6C4DE8 100%)', boxShadow: '0 10px 30px rgba(59,125,232,0.25)' }}>
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
          <div className="absolute -right-2 top-10 w-24 h-24 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <p className="text-white/70 text-[13px] font-medium relative">총 가입자</p>
          <div className="flex items-end gap-3 mt-1 relative">
            <p className="text-white text-5xl font-bold tabular-nums leading-none">{stats.totalUsers}</p>
            <p className="text-white/80 text-sm font-medium pb-1">명</p>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 relative">
            <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold text-white" style={{ background: 'rgba(255,255,255,0.18)' }}>
              최근 7일 +{stats.newUsers7d}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold text-white" style={{ background: 'rgba(255,255,255,0.18)' }}>
              최근 30일 +{stats.newUsers30d}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold text-white" style={{ background: 'rgba(255,255,255,0.18)' }}>
              30일 재방문율 {retention}%
            </span>
          </div>
        </div>

        {/* 활동 지표 */}
        <p className="text-[13px] font-semibold text-[#6E6E73] px-1 mb-2 mt-6">활동</p>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <StatCard icon={ICONS.pulse} accent="#34C759" label="최근 7일 활동" value={stats.active7d} sub="다시 접속한 유저" />
          <StatCard icon={ICONS.pulse} accent="#30B0C7" label="최근 30일 활동" value={stats.active30d} sub="다시 접속한 유저" />
        </div>

        {/* 소셜 지표 */}
        <p className="text-[13px] font-semibold text-[#6E6E73] px-1 mb-2 mt-6">소셜</p>
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={ICONS.friends} accent="#AF52DE" label="친구 관계" value={stats.totalFriendships} />
          <StatCard icon={ICONS.comment} accent="#FF9500" label="댓글" value={stats.totalComments} />
          <StatCard icon={ICONS.book} accent="#3B7DE8" label="책 공유" value={stats.totalSharedBooks} />
        </div>

        {/* 가입 추이 차트 */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 mt-6" style={cardShadow}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-[#1D1D1F]">최근 30일 가입 추이</h2>
            <span className="text-[12px] text-[#AEAEB2]">총 {periodTotal}명</span>
          </div>
          {peakDay && peakDay.c > 0 && (
            <p className="text-[11px] text-[#AEAEB2] mb-4">최다 가입 {fmtDate(peakDay.day)} · {peakDay.c}명</p>
          )}
          {stats.signupsByDay.length === 0 || periodTotal === 0 ? (
            <p className="text-xs text-[#AEAEB2] text-center py-8">최근 30일 신규 가입이 없어요</p>
          ) : (
            <>
              <div className="flex items-end gap-[3px]" style={{ height: 110 }}>
                {stats.signupsByDay.map((d) => {
                  const isPeak = peakDay && d.day === peakDay.day && d.c > 0;
                  return (
                    <div key={d.day} className="group flex-1 flex flex-col items-center justify-end h-full" title={`${fmtDate(d.day)} · ${d.c}명`}>
                      <div className="w-full rounded-md transition-all"
                        style={{
                          height: `${Math.max((d.c / maxDay) * 100, d.c > 0 ? 6 : 2)}%`,
                          maxWidth: 14,
                          background: d.c === 0
                            ? '#EDEDF0'
                            : isPeak
                              ? 'linear-gradient(180deg, #6C4DE8, #3B7DE8)'
                              : 'linear-gradient(180deg, #7DA6F0, #3B7DE8)',
                        }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-[#C7C7CC]">{fmtDate(stats.signupsByDay[0]?.day).slice(5)}</span>
                <span className="text-[10px] text-[#C7C7CC]">{fmtDate(stats.signupsByDay[stats.signupsByDay.length - 1]?.day).slice(5)}</span>
              </div>
            </>
          )}
        </div>

        {/* 최근 가입 유저 */}
        <div className="bg-white rounded-2xl overflow-hidden mt-6" style={cardShadow}>
          <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3">
            <h2 className="text-sm font-semibold text-[#1D1D1F]">최근 가입 유저</h2>
            <span className="text-[12px] text-[#AEAEB2]">{stats.recentUsers.length}명</span>
          </div>
          <div className="divide-y divide-[#F2F2F4]">
            {stats.recentUsers.length === 0 ? (
              <p className="text-xs text-[#AEAEB2] text-center py-8">아직 가입 유저가 없어요</p>
            ) : (
              stats.recentUsers.map((u) => {
                const hue = hueFromString(u.email || u.name);
                return (
                  <div key={u.email} className="flex items-center gap-3 px-5 sm:px-6 py-3">
                    {/* 아바타 */}
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ background: `hsl(${hue} 62% 55%)` }}>
                        {initials(u.name)}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                        style={{ background: activityColor(u.lastSeenAt) }} title="최근 접속 상태" />
                    </div>
                    {/* 이름/이메일 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#1D1D1F] truncate">{u.name}</p>
                      <p className="text-[12px] text-[#AEAEB2] truncate">{u.email}</p>
                    </div>
                    {/* 우측 메타 */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-[12px] text-[#6E6E73] whitespace-nowrap">{fmtRelative(u.lastSeenAt)}</p>
                      <p className="text-[11px] text-[#AEAEB2] whitespace-nowrap mt-0.5">
                        가입 {fmtDate(u.createdAt)} · {fmtMinutes(u.activeMinutes)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <p className="text-[11px] text-[#AEAEB2] text-center mt-4 leading-relaxed">
          우측 점은 최근 접속 상태예요 (초록 24시간 · 주황 7일 이내).<br />
          "누적 사용"은 앱 탭이 화면에 보이는 동안만 30초 단위로 집계한 근사치예요.
        </p>
      </div>
    </div>
  );
}
