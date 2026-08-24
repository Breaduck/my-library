import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';

const cs = { boxShadow: '0 2px 16px rgba(0,0,0,0.06)' };

function fmtAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const diff = Math.floor((Date.now() - t) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  const d = new Date(t);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

export default function NotificationsPage() {
  const { signedIn } = useAuth();
  const { items, markAllRead } = useNotifications(signedIn);

  // 이 페이지를 보면 전부 읽음 처리
  useEffect(() => {
    if (signedIn) markAllRead();
  }, [signedIn, items.length, markAllRead]);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-pt pb-32 sm:pb-12">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors flex-shrink-0" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}>
            <svg className="w-5 h-5 sm:w-4 sm:h-4 text-[#1D1D1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">알림</h1>
        </div>

        {!signedIn ? (
          <div className="bg-white rounded-2xl p-8 text-center" style={cs}>
            <p className="text-sm text-[#6E6E73]">로그인하면 친구가 남긴 댓글 알림을 볼 수 있어요</p>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center" style={cs}>
            <span className="text-3xl block mb-2">🔔</span>
            <p className="text-sm font-semibold text-[#1D1D1F] mb-1">아직 알림이 없어요</p>
            <p className="text-[11.5px] text-[#AEAEB2] leading-relaxed">친구가 내 책에 댓글을 남기면 여기에 표시돼요</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden" style={cs}>
            {items.map((n) => (
              <Link key={n.id} to={`/book/${n.bookId}`}
                className="flex items-start gap-3 px-5 sm:px-6 py-4 border-t border-[#F5F5F7] first:border-t-0 hover:bg-[#FAFAFB] transition-colors">
                {n.coverUrl ? (
                  <img src={n.coverUrl} alt="" className="w-9 rounded-md object-cover flex-shrink-0" style={{ height: 52, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
                ) : (
                  <div className="w-9 rounded-md bg-[#F0F0F5] flex-shrink-0" style={{ height: 52 }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#1D1D1F] leading-snug">
                    <span className="font-semibold">{n.authorName}</span>님이{' '}
                    <span className="font-semibold">《{n.bookTitle}》</span>에 댓글을 남겼어요
                  </p>
                  <p className="text-[12.5px] text-[#6E6E73] mt-1 line-clamp-2">{n.text}</p>
                  <p className="text-[10.5px] text-[#AEAEB2] mt-1">{fmtAgo(n.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
