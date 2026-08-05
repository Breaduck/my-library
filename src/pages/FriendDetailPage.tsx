import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFriends, useFriendBooks, useComments } from '@/hooks/useFriends';
import { SharedBook } from '@/lib/social';
import StarRating from '@/components/StarRating';

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
    try {
      await add(t, myName);
      setText('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 sm:px-5 pb-4 pt-1 bg-[#FAFAFB] border-t border-[#F0F0F2]">
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
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submit())}
          placeholder="댓글 남기기..."
          className="flex-1 px-3 py-2 rounded-lg bg-white text-xs text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] transition-all"
        />
        <button onClick={submit} disabled={busy || !text.trim()}
          className="px-3 py-2 rounded-lg bg-[#1D1D1F] text-white text-xs font-semibold hover:bg-[#3A3A3C] disabled:opacity-40 transition-colors flex-shrink-0">
          등록
        </button>
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const friend = friends.find((f) => f.email === email);
  const reading = books.filter((b) => b.status === 'reading');
  const others = books.filter((b) => b.status !== 'reading');

  async function handleRemove() {
    setRemoving(true);
    try {
      await remove(email);
      navigate('/friends');
    } finally {
      setRemoving(false);
    }
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

  function BookRow({ b }: { b: SharedBook }) {
    const isOpen = expanded === b.id;
    return (
      <div className="border-t border-[#F5F5F7]">
        <button onClick={() => setExpanded(isOpen ? null : b.id)}
          className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-[#FAFAFB] transition-colors text-left">
          {b.coverUrl ? (
            <img src={b.coverUrl} alt={b.title} className="w-9 rounded object-cover flex-shrink-0" style={{ height: 52 }} />
          ) : (
            <div className="w-9 rounded bg-[#F5F5F7] flex-shrink-0" style={{ height: 52 }} />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1D1D1F] truncate">{b.title}</p>
            <p className="text-[11px] text-[#AEAEB2] truncate">{b.author}</p>
            {b.rating > 0 && <div className="mt-1"><StarRating value={b.rating} readonly size="sm" /></div>}
          </div>
          <svg className={`w-4 h-4 text-[#AEAEB2] flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {isOpen && <CommentThread owner={email} book={b} myName={profile?.name ?? ''} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-pt pb-32 sm:pb-12">
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
          <button onClick={() => setConfirmRemove(true)}
            className="text-xs text-red-400 hover:text-red-500 flex-shrink-0 px-2 py-1">
            친구 끊기
          </button>
        </div>

        {booksLoading ? (
          <p className="text-sm text-[#AEAEB2] text-center py-10">불러오는 중...</p>
        ) : error ? (
          <p className="text-sm text-red-500 text-center py-10">{error}</p>
        ) : books.length === 0 ? (
          <p className="text-sm text-[#AEAEB2] text-center py-10">아직 등록된 책이 없어요</p>
        ) : (
          <div className="space-y-4">
            {reading.length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden" style={cs}>
                <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#AEAEB2] px-4 sm:px-5 pt-4 pb-1">지금 읽고 있는 책</h2>
                {reading.map((b) => <BookRow key={b.id} b={b} />)}
              </div>
            )}
            {others.length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden" style={cs}>
                <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#AEAEB2] px-4 sm:px-5 pt-4 pb-1">전체 책 · 평점</h2>
                {others.map((b) => <BookRow key={b.id} b={b} />)}
              </div>
            )}
          </div>
        )}
      </div>

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
