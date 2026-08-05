import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFriends, useFriendBooks, useFriendStats, useComments } from '@/hooks/useFriends';
import { SharedBook } from '@/lib/social';
import StarRating from '@/components/StarRating';
import FriendBookCard from '@/components/FriendBookCard';
import FriendBookStack from '@/components/FriendBookStack';
import FriendBookShelf from '@/components/FriendBookShelf';

const cs = { boxShadow: '0 2px 16px rgba(0,0,0,0.06)' };
type ViewMode = 'grid' | 'list' | 'shelf';

const STATUS_LABEL: Record<string, string> = {
  reading: '읽는 중', done: '읽음', want: '읽을 예정', stopped: '중단',
};

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

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function CommentThread({ owner, book, myName }: { owner: string; book: SharedBook; myName: string }) {
  const { comments, loading, add } = useComments(owner, book.id);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    try { await add(t, myName); setText(''); } finally { setBusy(false); }
  }

  return (
    <div>
      {loading ? (
        <p className="text-xs text-[#AEAEB2] py-3">불러오는 중...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-[#AEAEB2] py-3">아직 댓글이 없어요. 첫 댓글을 남겨보세요.</p>
      ) : (
        <div className="space-y-2.5 py-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-[#1D1D1F]">{c.authorName}</span>
                <span className="text-xs text-[#3A3A3C] ml-2 break-words">{c.text}</span>
              </div>
              <span className="text-[10px] text-[#AEAEB2] flex-shrink-0 mt-0.5">{fmtRelative(c.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submit())}
          placeholder="댓글 남기기..."
          className="flex-1 px-3 py-2 rounded-lg bg-[#F5F5F7] text-xs text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] transition-all" />
        <button onClick={submit} disabled={busy || !text.trim()}
          className="px-3 py-2 rounded-lg bg-[#1D1D1F] text-white text-xs font-semibold hover:bg-[#3A3A3C] disabled:opacity-40 transition-colors flex-shrink-0">
          등록
        </button>
      </div>
    </div>
  );
}

function BookOverlay({ book, owner, myName, onClose }: { book: SharedBook; owner: string; myName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 max-h-[85vh] overflow-y-auto"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />

        <div className="flex gap-4 mb-4">
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} className="w-20 h-28 rounded-lg object-cover flex-shrink-0" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }} />
          ) : (
            <div className="w-20 h-28 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-600 flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wide">{STATUS_LABEL[book.status] ?? book.status}</p>
            <h3 className="text-lg font-bold text-[#1D1D1F] leading-snug mt-0.5">{book.title}</h3>
            <p className="text-sm text-[#6E6E73] mt-0.5">{book.author}</p>
            {book.rating > 0 && <div className="mt-2"><StarRating value={book.rating} readonly size="sm" /></div>}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-[#F5F5F7] text-[#6E6E73] hover:bg-gray-200 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {book.review && (
          <div className="mb-4 p-4 rounded-xl bg-[#FAFAFB]">
            <p className="text-[11px] font-semibold text-[#AEAEB2] mb-1.5">독서록</p>
            <p className="text-sm text-[#3A3A3C] leading-relaxed whitespace-pre-wrap">{book.review}</p>
          </div>
        )}

        <div className="pt-3 border-t border-[#F5F5F7]">
          <p className="text-[11px] font-semibold text-[#AEAEB2] mb-1">댓글</p>
          <CommentThread owner={owner} book={book} myName={myName} />
        </div>
      </div>
    </div>
  );
}

export default function FriendDetailPage() {
  const { email: rawEmail } = useParams<{ email: string }>();
  const email = decodeURIComponent(rawEmail ?? '');
  const navigate = useNavigate();
  const { signedIn, profile } = useAuth();
  const { friends, loading: friendsLoading, remove } = useFriends(signedIn);
  const { books, loading: booksLoading, error } = useFriendBooks(signedIn ? email : undefined);
  const { stats } = useFriendStats(signedIn ? email : undefined);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [openBook, setOpenBook] = useState<SharedBook | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const friend = friends.find((f) => f.email === email);
  const reading = books.filter((b) => b.status === 'reading');

  async function handleRemove() {
    setRemoving(true);
    try { await remove(email); navigate('/friends'); } finally { setRemoving(false); }
  }

  if (!signedIn) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <p className="text-sm text-[#6E6E73]">로그인이 필요해요</p>
      </div>
    );
  }

  if (!friendsLoading && !friend) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-[#6E6E73]">친구가 아니거나 요청이 아직 대기 중이에요</p>
        <Link to="/friends" className="text-sm font-semibold text-[#0071E3]">친구 목록으로</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 page-pt pb-32 sm:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/friends" className="flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors flex-shrink-0" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}>
            <svg className="w-5 h-5 sm:w-4 sm:h-4 text-[#1D1D1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          {friend && <Avatar name={friend.name} picture={friend.picture} />}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[#1D1D1F] truncate">{friend?.name ?? email}</h1>
            <p className="text-xs text-[#AEAEB2] truncate">{email}</p>
          </div>
          <button onClick={() => setConfirmRemove(true)} className="text-xs text-red-400 hover:text-red-500 flex-shrink-0 px-2 py-1">
            친구 끊기
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="bg-white rounded-2xl p-4 text-center" style={cs}>
              <p className="text-xl font-bold text-[#1D1D1F]">{stats.doneBooks}</p>
              <p className="text-[11px] text-[#AEAEB2] mt-0.5">완독</p>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center" style={cs}>
              <p className="text-xl font-bold text-[#1D1D1F]">{stats.avgRating > 0 ? stats.avgRating : '-'}</p>
              <p className="text-[11px] text-[#AEAEB2] mt-0.5">평균 별점</p>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center" style={cs}>
              <p className="text-xl font-bold text-[#1D1D1F]">{stats.totalPages.toLocaleString()}</p>
              <p className="text-[11px] text-[#AEAEB2] mt-0.5">읽은 페이지</p>
            </div>
          </div>
        )}

        {reading.length > 0 && (
          <div className="mb-6">
            <h2 className="text-[13px] font-semibold text-[#86848A] tracking-wide uppercase mb-3 px-1">지금 읽고 있는 책</h2>
            <div className="space-y-2">
              {reading.map((b) => {
                const pct = b.pages > 0 ? Math.min(100, Math.round((b.currentPage / b.pages) * 100)) : null;
                return (
                  <button key={b.id} onClick={() => setOpenBook(b)}
                    className="w-full bg-white rounded-2xl flex items-center gap-3 p-3 text-left active:scale-[0.99] transition-transform" style={cs}>
                    <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 50, height: 74, boxShadow: '0 3px 10px rgba(0,0,0,0.14)' }}>
                      {b.coverUrl ? <img src={b.coverUrl} alt={b.title} className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center"><span className="text-white font-bold text-sm">{b.title.slice(0, 2)}</span></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#1D1D1F] text-[14px] truncate leading-tight">{b.title}</p>
                      <p className="text-[#86848A] text-[11.5px] mt-0.5 truncate">{b.author}</p>
                      {pct !== null && (
                        <div className="relative h-[16px] bg-[#F0F0F5] rounded-full overflow-hidden mt-2">
                          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #4F8EF7, #3B7DE8)' }} />
                          <div className="absolute inset-0 flex items-center px-2">
                            <span className={`text-[9.5px] font-bold ${pct >= 35 ? 'text-white' : 'text-[#1D1D1F]'}`}>{pct}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-[13px] font-semibold text-[#86848A] tracking-wide uppercase">전체 책 · 평점</h2>
          <div className="flex bg-white rounded-xl overflow-hidden flex-shrink-0" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            {(['grid', 'list', 'shelf'] as ViewMode[]).map((mode, i) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`flex items-center justify-center w-9 h-9 transition-colors ${viewMode === mode ? 'bg-[#1D1D1F] text-white' : 'text-[#AEAEB2] hover:text-[#6E6E73]'}`}>
                {i === 0 && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z" /></svg>}
                {i === 1 && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M6 12h12M5 17h14" /></svg>}
                {i === 2 && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6V4m0 2v8m0 0v2M8 14h8M16 6V4m0 2v8m0 0v2M4 20h16M4 4h2M18 4h2" /></svg>}
              </button>
            ))}
          </div>
        </div>

        {booksLoading ? (
          <p className="text-sm text-[#AEAEB2] text-center py-10">불러오는 중...</p>
        ) : error ? (
          <p className="text-sm text-red-500 text-center py-10">{error}</p>
        ) : books.length === 0 ? (
          <p className="text-sm text-[#AEAEB2] text-center py-10">아직 등록된 책이 없어요</p>
        ) : viewMode === 'shelf' ? (
          <div className="rounded-3xl p-2" style={{ background: 'linear-gradient(180deg, #f5ede3 0%, #ede0d0 100%)' }}>
            <FriendBookShelf books={books} onOpen={setOpenBook} />
          </div>
        ) : viewMode === 'list' ? (
          <FriendBookStack books={books} onOpen={setOpenBook} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5">
            {books.map((b) => <FriendBookCard key={b.id} book={b} onOpen={() => setOpenBook(b)} />)}
          </div>
        )}
      </div>

      {openBook && <BookOverlay book={openBook} owner={email} myName={profile?.name ?? ''} onClose={() => setOpenBook(null)} />}

      {confirmRemove && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 sm:p-8"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
            <h3 className="text-lg font-semibold text-[#1D1D1F] mb-2">친구를 끊을까요?</h3>
            <p className="text-[#6E6E73] text-sm mb-6">{friend?.name ?? email}님과 더 이상 서로의 책을 볼 수 없어요.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRemove(false)} className="flex-1 py-3.5 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] text-sm font-medium active:bg-gray-200 transition-colors">취소</button>
              <button onClick={handleRemove} disabled={removing} className="flex-1 py-3.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 active:bg-red-700 disabled:opacity-50 transition-colors">끊기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
