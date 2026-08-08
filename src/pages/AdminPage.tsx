import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getAdminStats, AdminStats } from '@/lib/social';

const cs = { boxShadow: '0 2px 16px rgba(0,0,0,0.06)' };

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

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4" style={cs}>
      <p className="text-[11px] text-[#AEAEB2]">{label}</p>
      <p className="text-2xl font-bold text-[#1D1D1F] mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-[#AEAEB2] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminPage() {
  const { signedIn, state } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state === 'idle') { setLoading(false); return; }
    // 새로고침 직후 등 토큰이 아직 조용히 재연결되는 중이면(connecting/saving) 기다렸다가 요청한다.
    // signedIn만 보고 바로 요청하면 토큰이 아직 없어서 "불러오지 못했어요"로 잘못 표시됐었음.
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
    return <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center"><p className="text-sm text-[#AEAEB2]">불러오는 중...</p></div>;
  }
  if (error || !stats) {
    return <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center"><p className="text-sm text-red-500">{error ?? '오류'}</p></div>;
  }

  const maxDay = Math.max(...stats.signupsByDay.map((d) => d.c), 1);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 page-pt pb-16">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="flex items-center justify-center w-9 h-9 rounded-full bg-white hover:bg-gray-50 transition-colors flex-shrink-0" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}>
            <svg className="w-4 h-4 text-[#1D1D1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">관리자 대시보드</h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <StatTile label="총 가입자" value={stats.totalUsers} />
          <StatTile label="최근 7일 가입" value={stats.newUsers7d} />
          <StatTile label="최근 30일 가입" value={stats.newUsers30d} />
          <StatTile label="최근 7일 활동" value={stats.active7d} sub="다시 접속한 유저 수" />
          <StatTile label="최근 30일 활동" value={stats.active30d} />
          <StatTile label="친구 관계" value={stats.totalFriendships} />
          <StatTile label="댓글 수" value={stats.totalComments} />
          <StatTile label="책 공유 중인 유저" value={stats.totalSharedBooks} />
        </div>

        <div className="bg-white rounded-2xl p-5 sm:p-6 mb-6" style={cs}>
          <h2 className="text-sm font-semibold text-[#1D1D1F] mb-4">최근 30일 가입 추이</h2>
          {stats.signupsByDay.length === 0 ? (
            <p className="text-xs text-[#AEAEB2] text-center py-6">최근 30일 신규 가입이 없어요</p>
          ) : (
            <div className="flex items-end gap-1" style={{ height: 100 }}>
              {stats.signupsByDay.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${d.day} · ${d.c}명`}>
                  <div className="w-full rounded" style={{ height: Math.max((d.c / maxDay) * 80, 3), background: '#3B7DE8', maxWidth: 16 }} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl overflow-hidden" style={cs}>
          <h2 className="text-sm font-semibold text-[#1D1D1F] px-5 sm:px-6 pt-5 pb-3">최근 가입 유저</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#AEAEB2] border-t border-[#F5F5F7]">
                  <th className="text-left font-medium px-5 sm:px-6 py-2">이름</th>
                  <th className="text-left font-medium px-2 py-2">이메일</th>
                  <th className="text-left font-medium px-2 py-2">가입일</th>
                  <th className="text-left font-medium px-2 py-2">최근 접속</th>
                  <th className="text-right font-medium px-5 sm:px-6 py-2">누적 사용</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentUsers.map((u) => (
                  <tr key={u.email} className="border-t border-[#F5F5F7]">
                    <td className="px-5 sm:px-6 py-2.5 font-medium text-[#1D1D1F] whitespace-nowrap">{u.name}</td>
                    <td className="px-2 py-2.5 text-[#6E6E73] whitespace-nowrap">{u.email}</td>
                    <td className="px-2 py-2.5 text-[#6E6E73] whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                    <td className="px-2 py-2.5 text-[#6E6E73] whitespace-nowrap">{fmtRelative(u.lastSeenAt)}</td>
                    <td className="px-5 sm:px-6 py-2.5 text-right text-[#6E6E73] whitespace-nowrap">{u.activeMinutes}분</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[11px] text-[#AEAEB2] text-center mt-4">
          "체류시간"은 앱 탭이 실제로 화면에 보이는 동안만 30초 단위로 집계한 근사치예요.
        </p>
      </div>
    </div>
  );
}
