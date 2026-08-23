import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFriends, useFriendActivity } from '@/hooks/useFriends';
import { FriendEntry, lookupByNickname } from '@/lib/social';
import LoginModal from '@/components/LoginModal';

const cs = { boxShadow: '0 2px 16px rgba(0,0,0,0.06)' };

function fmtAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const diff = Math.floor((Date.now() - t) / 1000);
  if (diff < 3600) return '방금 전';
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  const d = new Date(t);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

function activityText(status: string, currentPage: number, pages: number): string {
  if (status === 'done') return '완독했어요 🎉';
  if (status === 'reading') {
    const pct = pages > 0 ? Math.min(100, Math.round((currentPage / pages) * 100)) : 0;
    return pct > 0 ? `읽는 중 · ${pct}%` : '읽기 시작했어요';
  }
  if (status === 'want') return '서재에 담았어요';
  return '기록을 남겼어요';
}

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
  const { signedIn, signIn } = useAuth();
  const { friends, incoming, outgoing, loading, error, invite, accept, decline } = useFriends(signedIn);
  const activity = useFriendActivity(friends);
  const [inviteMode, setInviteMode] = useState<'email' | 'nickname'>('email');
  const [email, setEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [nicknameResults, setNicknameResults] = useState<FriendEntry[] | null>(null);
  const [nicknameBusy, setNicknameBusy] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

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

  async function handleNicknameSearch() {
    const n = nickname.trim();
    if (!n) return;
    setNicknameBusy(true);
    setNicknameResults(null);
    try {
      setNicknameResults(await lookupByNickname(n));
    } catch {
      setNicknameResults([]);
    } finally {
      setNicknameBusy(false);
    }
  }

  async function handleInviteFromSearch(target: string) {
    setBusyEmail(target);
    try {
      await invite(target);
      setNicknameResults((prev) => prev?.filter((u) => u.email !== target) ?? null);
    } finally {
      setBusyEmail(null);
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
            <div className="inline-flex w-12 h-12 rounded-2xl items-center justify-center mb-3"
              style={{ background: 'linear-gradient(135deg, #FFF1D0 0%, #F2CA8A 100%)', boxShadow: '0 4px 16px rgba(150,100,40,0.18)' }}>
              <span className="text-2xl">👥</span>
            </div>
            <p className="text-sm text-[#6E6E73] leading-relaxed">로그인하면 친구를 추가하고<br />서로의 독서 기록을 볼 수 있어요</p>
            <button onClick={() => setShowLogin(true)} className="inline-block mt-4 px-5 py-2.5 rounded-full bg-[#1D1D1F] text-white text-sm font-semibold hover:bg-[#3A3A3C] transition-colors">
              로그인해주세요
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 최근 활동 피드 */}
            {activity.length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden" style={cs}>
                <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#AEAEB2] px-5 pt-5 pb-2 sm:px-6">최근 활동</h2>
                {activity.map(({ friend, book }) => (
                  <Link key={`${friend.email}-${book.id}`} to={`/friends/${encodeURIComponent(friend.email)}`}
                    className="flex items-center gap-3 px-5 sm:px-6 py-3 border-t border-[#F5F5F7] hover:bg-[#FAFAFB] transition-colors">
                    <Avatar name={friend.name} picture={friend.picture} size={34} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#1D1D1F] leading-snug">
                        <span className="font-semibold">{friend.name}</span>님이{' '}
                        <span className="font-semibold">《{book.title}》</span>{activityText(book.status, book.currentPage, book.pages)}
                      </p>
                      <p className="text-[10.5px] text-[#AEAEB2] mt-0.5">{fmtAgo(book.updatedAt)}</p>
                    </div>
                    {book.coverUrl && (
                      <div className="w-8 rounded-md overflow-hidden flex-shrink-0" style={{ height: 46, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                        <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}

            {/* 초대 */}
            <div className="bg-white rounded-2xl p-5 sm:p-6" style={cs}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#AEAEB2]">친구 초대</h2>
                <div className="inline-flex p-0.5 rounded-lg gap-0.5" style={{ background: 'rgba(120,120,128,0.12)' }}>
                  {(['email', 'nickname'] as const).map((m) => (
                    <button key={m} onClick={() => setInviteMode(m)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${inviteMode === m ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#6E6E73]'}`}>
                      {m === 'email' ? '이메일' : '닉네임'}
                    </button>
                  ))}
                </div>
              </div>

              {inviteMode === 'email' ? (
                <>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleInvite())}
                      placeholder="친구의 구글 이메일 주소"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-[#F5F5F7] text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#3B7DE8] transition-all"
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
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNicknameSearch())}
                      placeholder="친구의 닉네임 (정확히 입력)"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-[#F5F5F7] text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#3B7DE8] transition-all"
                    />
                    <button onClick={handleNicknameSearch} disabled={nicknameBusy || !nickname.trim()}
                      className="px-4 py-2.5 rounded-xl bg-[#1D1D1F] text-white text-sm font-semibold hover:bg-[#3A3A3C] disabled:opacity-40 transition-colors flex-shrink-0">
                      찾기
                    </button>
                  </div>
                  {nicknameResults !== null && (
                    <div className="mt-3 space-y-1.5">
                      {nicknameResults.length === 0 ? (
                        <p className="text-[11px] text-[#AEAEB2] text-center py-2">일치하는 닉네임이 없어요</p>
                      ) : (
                        nicknameResults.map((u) => (
                          <div key={u.email} className="flex items-center gap-3 p-2 rounded-lg bg-[#FAFAFB]">
                            <Avatar name={u.name} picture={u.picture} size={32} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#1D1D1F] truncate">{u.name}</p>
                            </div>
                            <button disabled={busyEmail === u.email} onClick={() => handleInviteFromSearch(u.email)}
                              className="px-3 py-1 rounded-full bg-[#1D1D1F] text-white text-[11px] font-semibold hover:bg-[#3A3A3C] disabled:opacity-40 transition-colors">
                              초대
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-[#AEAEB2] mt-2 leading-relaxed">
                    닉네임은 설정 페이지에서 지정한 경우에만 검색돼요.
                  </p>
                </>
              )}
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
                <div className="px-5 sm:px-6 py-8 text-center border-t border-[#F5F5F7]">
                  <span className="text-3xl block mb-2">📚</span>
                  <p className="text-sm font-semibold text-[#1D1D1F] mb-1">아직 친구가 없어요</p>
                  <p className="text-[11.5px] text-[#AEAEB2] leading-relaxed">위에서 이메일이나 닉네임으로 친구를 초대하면<br />서로의 서재와 독서 기록을 구경할 수 있어요</p>
                </div>
              ) : (
                friends.map((f: FriendEntry) => (
                  <Link key={f.email} to={`/friends/${encodeURIComponent(f.email)}`}
                    className="flex items-center gap-3 px-5 sm:px-6 py-3 border-t border-[#F5F5F7] hover:bg-[#FAFAFB] transition-colors">
                    <Avatar name={f.name} picture={f.picture} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1D1D1F] truncate">{f.name}</p>
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

      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} onGoogle={() => { setShowLogin(false); signIn(); }} />
    </div>
  );
}
