import { useState } from 'react';
import { useComments } from '@/hooks/useFriends';

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// 책 한 권의 댓글 스레드. owner는 책 주인 이메일, 나(myEmail)는 내 이메일.
// 내 책이든 친구 책이든(친구 사이면) 서로 댓글을 주고받을 수 있다.
export default function CommentThread({
  owner, bookId, myName, myEmail,
}: { owner: string; bookId: string; myName: string; myEmail?: string }) {
  const { comments, loading, add } = useComments(owner, bookId);
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
          {comments.map((c) => {
            const mine = !!myEmail && c.authorEmail === myEmail;
            return (
              <div key={c.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-[#1D1D1F]">{mine ? '나' : c.authorName}</span>
                  <span className="text-xs text-[#3A3A3C] ml-2 break-words">{c.text}</span>
                </div>
                <span className="text-[10px] text-[#AEAEB2] flex-shrink-0 mt-0.5">{fmtRelative(c.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submit())}
          placeholder="댓글 남기기..."
          className="flex-1 px-3 py-2 rounded-lg bg-[#F5F5F7] text-xs text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#3B7DE8] transition-all" />
        <button onClick={submit} disabled={busy || !text.trim()}
          className="px-3 py-2 rounded-lg bg-[#1D1D1F] text-white text-xs font-semibold hover:bg-[#3A3A3C] disabled:opacity-40 transition-colors flex-shrink-0">
          등록
        </button>
      </div>
    </div>
  );
}
