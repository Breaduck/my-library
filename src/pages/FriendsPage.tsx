import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { FriendEntry } from '@/lib/social';

const cs = { boxShadow: '0 2px 16px rgba(0,0,0,0.06)' };

function Avatar({ name, picture, size = 44 }: { name: string; picture: string; size?: number }) {
  return picture ? (
    <img src={picture} alt={name} className="rounded-full object-cover flex-shrink-0" referrerPolicy="no-referrer"
      style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #818CF8, #C084FC)', fontSize: size * 0.4 }}>
      {(name?.[0] ?? '?').toUpperCase()}
    </div>
  );
}

export default function FriendsPage() {
  const { signedIn } = useAuth();
  const { friends, incoming, outgoing, loading, error, invite, accept, decline } = useFriends(signedIn);
  const [email, setEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  async function handleInvite() {
    const target = email.trim();
    if (!target) return;
    setInviteBusy(true);
    setInviteMsg('');
    try {
      await invite(target);
      setEmail('');
      setInviteMsg('요청을 보냈어요');
    } catch {
      setInviteMsg('요청을 보내지 못했어요. 이메일을 확인해주세요');
    } finally {
      setInviteBusy(false);
    }
  }

  async function run(fn: (email: string) => Promise<void>, target: string) {
    setBusyEmail(target);
    try { await fn(target); } finally { setBusyEmail(null); }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-pt pb-32 sm:pb-12">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/settings" className="flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors flex-shrink-0" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}>
            <svg className="w-5 h-5 sm:w-4 sm:h-4 text-[#1D1D1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">친구</h1>
        </div>

        {!signedIn ? (
          <div className="bg-white rounded-2xl p-8 text-center" style={cs}>
            <p className="text-sm text-[#6E6E73]">로그인 후 친구를 추가할 수 있어요</p>
            <Link to="/settings" className="inline-block mt-4 px-5 py-2.5 rounded-full bg-[#1D1D1F] text-white text-sm font-semibold hover:bg-[#3A3A3C] transition-colors">
              설정으로 이동
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 초대 */}
            <div className="bg-white rounded-2xl p-5 sm:p-6" style={cs}>
              <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#AEAEB2] mb-3">친구 초대</h2>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleInvite())}
                  placeholder="친구의 구글 이메일 주소"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#F5F5F7] text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] transition-all"
                />
                <button onClick={handleInvite} disabled={inviteBusy || !email.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#1D1D1F] text-white text-sm font-semibold hover:bg-[#3A3A3C] disabled:opacity-40 transition-colors flex-shrink-0">
                  초대
                </button>
              </div>
              {inviteMsg && <p className="text-[11px] text-[#6E6E73] mt-2">{inviteMsg}</p>}
              <p className="text-[11px] text-[#AEAEB2] mt-2 leading-relaxed">
                친구가 이 이메일로 로그인한 적이 있어야 요청을 받을 수 있어요. 서로 초대하면 바로 친구가 돼요.
              </p>
            </div>

            {/* 받은 요청 */}
            {incoming.length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden" style={cs}>
                <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#AEAEB2] px-5 pt-5 pb-2 sm:px-6">받은 요청</h2>
                {incoming.map((f: FriendEntry) => (
                  <div key={f.email} className="flex items-center gap-3 px-5 sm:px-6 py-3 border-t border-[#F5F5F7]">
                    <Avatar name={f.name} picture={f.picture} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1D1D1F] truncate">{f.name}</p>
                      <p className="text-[11px] text-[#AEAEB2] truncate">{f.email}</p>
                    </div>
                    <button disabled={busyEmail === f.email} onClick={() => run(accept, f.email)}
                      className="px-3 py-1.5 rounded-full bg-[#1D1D1F] text-white text-xs font-semibold hover:bg-[#3A3A3C] disabled:opacity-40 transition-colors">
                      수락
                    </button>
                    <button disabled={busyEmail === f.email} onClick={() => run(decline, f.email)}
                      className="px-3 py-1.5 rounded-full bg-[#F5F5F7] text-[#6E6E73] text-xs font-semibold hover:bg-gray-200 disabled:opacity-40 transition-colors">
                      거절
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 보낸 요청 */}
            {outgoing.length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden" style={cs}>
                <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#AEAEB2] px-5 pt-5 pb-2 sm:px-6">보낸 요청</h2>
                {outgoing.map((f: FriendEntry) => (
                  <div key={f.email} className="flex items-center gap-3 px-5 sm:px-6 py-3 border-t border-[#F5F5F7]">
                    <Avatar name={f.name} picture={f.picture} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1D1D1F] truncate">{f.name}</p>
                      <p className="text-[11px] text-[#AEAEB2] truncate">{f.email}</p>
                    </div>
                    <span className="text-[11px] text-[#AEAEB2] mr-1">대기중</span>
                    <button disabled={busyEmail === f.email} onClick={() => run(decline, f.email)}
                      className="px-3 py-1.5 rounded-full bg-[#F5F5F7] text-[#6E6E73] text-xs font-semibold hover:bg-gray-200 disabled:opacity-40 transition-colors">
                      취소
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 친구 목록 */}
            <div className="bg-white rounded-2xl overflow-hidden" style={cs}>
              <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#AEAEB2] px-5 pt-5 pb-2 sm:px-6">
                친구 {friends.length > 0 && `· ${friends.length}`}
              </h2>
              {loading && friends.length === 0 ? (
                <p className="text-sm text-[#AEAEB2] px-5 sm:px-6 py-6 text-center">불러오는 중...</p>
              ) : friends.length === 0 ? (
                <p className="text-sm text-[#AEAEB2] px-5 sm:px-6 py-6 text-center">아직 친구가 없어요</p>
              ) : (
                friends.map((f: FriendEntry) => (
                  <Link key={f.email} to={`/friends/${encodeURIComponent(f.email)}`}
                    className="flex items-center gap-3 px-5 sm:px-6 py-3 border-t border-[#F5F5F7] hover:bg-[#FAFAFB] transition-colors">
                    <Avatar name={f.name} picture={f.picture} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1D1D1F] truncate">{f.name}</p>
                      <p className="text-[11px] text-[#AEAEB2] truncate">{f.email}</p>
                    </div>
                    <svg className="w-4 h-4 text-[#AEAEB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))
              )}
            </div>

            {error && <p className="text-[11px] text-red-500 text-center">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
