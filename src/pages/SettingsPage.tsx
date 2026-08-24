import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBooks } from '@/hooks/useBooks';
import LoginModal from '@/components/LoginModal';
import { Book } from '@/types';
import {
  exportData, importData, localDate, getVisibility, setVisibility, Visibility, getSharedBookIds, toggleSharedBookId,
  getShareReviews, setShareReviews, getShareStats, setShareStats,
  getTombstones, setTombstones, clearReadingRecords,
} from '@/lib/storage';
import { resizeImageFile } from '@/lib/image';

const VISIBILITY_OPTIONS: { key: Visibility; label: string; desc: string }[] = [
  { key: 'private', label: '나만 보기', desc: '친구에게 내 책과 평점을 전혀 보여주지 않아요' },
  { key: 'all', label: '전체 공개', desc: '모든 책과 평점을 친구에게 보여줘요' },
  { key: 'select', label: '일부 공개', desc: '직접 선택한 책만 친구에게 보여줘요' },
];

function formatTime(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtRelative(d: Date | null): string {
  if (!d) return '아직 없음';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `오늘 ${formatTime(d)}`;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const cs = { boxShadow: '0 2px 16px rgba(0,0,0,0.06)' };

export default function SettingsPage() {
  const { enabled, state, signedIn, profile, displayName, lastSync, avatarUrl, updateCustomPicture, updateCustomName, signIn, signOut, syncNow } = useAuth();
  const { books } = useBooks();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [visibility, setVisibilityState] = useState<Visibility>(() => getVisibility());
  const [sharedIds, setSharedIdsState] = useState<string[]>(() => getSharedBookIds());
  const [shareReviews, setShareReviewsState] = useState(() => getShareReviews());
  const [shareStats, setShareStatsState] = useState(() => getShareStats());
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameBusy, setNameBusy] = useState(false);

  const showSyncCard = signedIn;

  function handleVisibilityChange(v: Visibility) {
    setVisibility(v);
    setVisibilityState(v);
  }

  function handleToggleShared(bookId: string, shared: boolean) {
    toggleSharedBookId(bookId, shared);
    setSharedIdsState(getSharedBookIds());
  }

  function handleToggleShareReviews(v: boolean) {
    setShareReviews(v);
    setShareReviewsState(v);
  }

  function handleToggleShareStats(v: boolean) {
    setShareStats(v);
    setShareStatsState(v);
  }

  function startEditName() {
    setNameDraft(displayName);
    setEditingName(true);
  }

  async function saveName() {
    const t = nameDraft.trim();
    if (!t) { setEditingName(false); return; }
    setNameBusy(true);
    try {
      await updateCustomName(t);
      setEditingName(false);
    } finally {
      setNameBusy(false);
    }
  }

  const hasCustomPicture = !!avatarUrl && avatarUrl !== profile?.picture;

  async function handleAvatarPick(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setAvatarError('이미지 파일만 올릴 수 있어요'); return; }
    setAvatarBusy(true);
    setAvatarError('');
    try {
      const dataUrl = await resizeImageFile(file);
      await updateCustomPicture(dataUrl);
    } catch {
      setAvatarError('사진을 저장하지 못했어요');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarReset() {
    setAvatarBusy(true);
    setAvatarError('');
    try {
      await updateCustomPicture(null);
    } catch {
      setAvatarError('되돌리지 못했어요');
    } finally {
      setAvatarBusy(false);
    }
  }

  function handleExport() {
    // 책 + 일별 기록 + 목표까지 전체 백업
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-library-${localDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File | null | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const count = Array.isArray(parsed) ? parsed.length : (parsed?.books?.length ?? 0);
      // 안전 우선: 기존 책은 유지하고 합쳐서(merge) 불러옴 — 어떤 책도 사라지지 않음
      const ok = window.confirm(`${count}권을 현재 목록에 합쳐서 불러올까요?\n(기존 책은 그대로 유지됩니다)`);
      if (!ok) return;
      const res = importData(text, 'merge');
      alert(`가져오기 완료 · 총 ${res.books}권`);
    } catch (e) {
      alert(`가져오기 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
  }

  function handleReset() {
    // 모든 책을 툼스톤에 남겨서 Drive/다른 기기와 병합될 때 부활하지 않게 한다
    setTombstones([...getTombstones(), ...books.map((b) => b.id)]);
    localStorage.removeItem('book-tracker');
    clearReadingRecords();
    // ★ 먼저 권위 있는 초기화를 알린다 — 이걸 books:replace보다 앞서 보내야
    // 뒤따르는 books:changed('[]')가 병합 저장을 건너뛰어 개인 기록이 되살아나지 않는다.
    window.dispatchEvent(new CustomEvent('account:wipe'));
    window.dispatchEvent(new CustomEvent<Book[]>('books:replace', { detail: [] }));
    window.dispatchEvent(new CustomEvent('books:changed', { detail: [] }));
    setConfirmReset(false);
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-pt pb-32 sm:pb-12">

        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors flex-shrink-0" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}>
            <svg className="w-5 h-5 sm:w-4 sm:h-4 text-[#1D1D1F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">내 설정</h1>
        </div>

        <div className="space-y-4">
          {/* 계정 카드 */}
          <div className="bg-white rounded-2xl p-5 sm:p-6" style={cs}>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#AEAEB2] mb-3">계정</h2>
            {signedIn && profile ? (
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-14 h-14 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, #818CF8, #C084FC)' }}>
                      {(displayName?.[0] ?? '?').toUpperCase()}
                    </div>
                  )}
                  <button type="button" onClick={() => avatarFileRef.current?.click()} disabled={avatarBusy}
                    aria-label="프로필 사진 변경"
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#1D1D1F] text-white flex items-center justify-center border-2 border-white active:scale-95 transition-transform disabled:opacity-50">
                    {avatarBusy ? (
                      <div className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    )}
                  </button>
                  <input ref={avatarFileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { handleAvatarPick(e.target.files?.[0]); e.target.value = ''; }} />
                </div>
                <div className="flex-1 min-w-0">
                  {editingName ? (
                    <div className="flex items-center gap-1.5">
                      <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                        autoFocus maxLength={20}
                        className="min-w-0 flex-1 px-2 py-1 rounded-lg bg-[#F5F5F7] text-[15px] font-semibold text-[#1D1D1F] outline-none focus:ring-2 focus:ring-[#3B7DE8]" />
                      <button onClick={saveName} disabled={nameBusy} className="text-xs font-semibold text-[#3B7DE8] disabled:opacity-40 flex-shrink-0">저장</button>
                      <button onClick={() => setEditingName(false)} className="text-xs text-[#AEAEB2] flex-shrink-0">취소</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <p className="text-[15px] font-semibold text-[#1D1D1F] truncate">{displayName}</p>
                      <button type="button" onClick={startEditName} aria-label="이름 수정" className="text-[#AEAEB2] hover:text-[#6E6E73] flex-shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-[#6E6E73] truncate">{profile.email}</p>
                  <p className="text-[11px] text-[#AEAEB2] mt-1 flex items-center gap-1.5">
                    <svg className="w-3 h-3" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google 계정으로 로그인됨
                  </p>
                  {hasCustomPicture && (
                    <button type="button" onClick={handleAvatarReset} disabled={avatarBusy}
                      className="text-[11px] text-[#3B7DE8] hover:text-[#2E68C5] mt-1 disabled:text-[#AEAEB2]">
                      Google 사진으로 되돌리기
                    </button>
                  )}
                  {avatarError && <p className="text-[11px] text-red-500 mt-1">{avatarError}</p>}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#F5F5F7] flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-[#AEAEB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#1D1D1F]">로그인되지 않음</p>
                  <p className="text-xs text-[#6E6E73] mt-0.5">기록은 이 브라우저에만 저장돼요</p>
                </div>
                {enabled ? (
                  <button onClick={() => setShowLogin(true)}
                    className="px-4 py-2 rounded-full bg-[#1D1D1F] text-white text-xs font-semibold hover:bg-[#3A3A3C] transition-colors flex-shrink-0">
                    로그인
                  </button>
                ) : (
                  <span className="text-[11px] text-[#AEAEB2]">미설정</span>
                )}
              </div>
            )}
          </div>

          {signedIn && (
            <Link to="/friends" className="flex items-center justify-between bg-white rounded-2xl p-5 sm:p-6 hover:bg-[#FAFAFB] active:bg-[#F5F5F7] transition-colors" style={cs}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F5F5F7] flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#6E6E73]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-2a3 3 0 10-2-5.24" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[#1D1D1F]">친구</p>
              </div>
              <svg className="w-4 h-4 text-[#AEAEB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}

          {signedIn && (
            <div className="bg-white rounded-2xl p-5 sm:p-6" style={cs}>
              <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#AEAEB2] mb-3">독서 기록 공개 범위</h2>
              <div className="space-y-2">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <button key={opt.key} onClick={() => handleVisibilityChange(opt.key)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${visibility === opt.key ? 'bg-[#F0F6FF]' : 'hover:bg-[#FAFAFB]'}`}>
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${visibility === opt.key ? 'border-[#3B7DE8]' : 'border-[#D1D1D6]'}`}>
                      {visibility === opt.key && <div className="w-2 h-2 rounded-full bg-[#3B7DE8]" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1D1D1F]">{opt.label}</p>
                      <p className="text-[11px] text-[#AEAEB2] mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {visibility === 'select' && (
                <div className="mt-3 pt-3 border-t border-[#F5F5F7] max-h-64 overflow-y-auto space-y-1">
                  {books.length === 0 ? (
                    <p className="text-xs text-[#AEAEB2] text-center py-3">등록된 책이 없어요</p>
                  ) : (
                    books.map((b) => (
                      <label key={b.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#FAFAFB] cursor-pointer">
                        <input type="checkbox" checked={sharedIds.includes(b.id)}
                          onChange={(e) => handleToggleShared(b.id, e.target.checked)}
                          className="w-4 h-4 rounded accent-[#3B7DE8] flex-shrink-0" />
                        <span className="text-sm text-[#1D1D1F] truncate">{b.title}</span>
                      </label>
                    ))
                  )}
                </div>
              )}

              {visibility !== 'private' && (
                <div className="mt-3 pt-3 border-t border-[#F5F5F7] space-y-1">
                  <label className="flex items-center justify-between gap-3 px-1 py-2 cursor-pointer">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">독서록(리뷰) 함께 공개</p>
                      <p className="text-[11px] text-[#AEAEB2]">끄면 책·평점만 보이고 작성한 글은 안 보여요</p>
                    </div>
                    <input type="checkbox" checked={shareReviews} onChange={(e) => handleToggleShareReviews(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#3B7DE8] flex-shrink-0" />
                  </label>
                  <label className="flex items-center justify-between gap-3 px-1 py-2 cursor-pointer">
                    <div>
                      <p className="text-sm text-[#1D1D1F]">독서 통계 공개</p>
                      <p className="text-[11px] text-[#AEAEB2]">완독 수·평균 별점·읽은 페이지를 친구에게 보여줘요</p>
                    </div>
                    <input type="checkbox" checked={shareStats} onChange={(e) => handleToggleShareStats(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#3B7DE8] flex-shrink-0" />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* 동기화 카드 */}
          {showSyncCard && (
            <div className="bg-white rounded-2xl p-5 sm:p-6" style={cs}>
              <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#AEAEB2] mb-3">동기화</h2>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  {state === 'saving' ? (
                    <div className="w-2.5 h-2.5 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  ) : state === 'error' ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-[#1D1D1F]">
                      {state === 'saving' ? '저장 중...' : state === 'error' ? '오류' : '최신 상태'}
                    </p>
                    <p className="text-[11px] text-[#AEAEB2]">마지막 동기화: {fmtRelative(lastSync)}</p>
                  </div>
                </div>
                <button onClick={() => void syncNow()} disabled={state === 'saving'}
                  className="text-xs font-semibold text-[#3B7DE8] hover:text-[#2E68C5] disabled:text-[#AEAEB2] transition-colors">
                  지금 동기화
                </button>
              </div>
              <p className="text-[11px] text-[#AEAEB2] leading-relaxed">
                현재 {books.length}권의 책이 안전하게 백업되어 있어요.
              </p>
            </div>
          )}

          {/* 데이터 관리 */}
          <div className="bg-white rounded-2xl overflow-hidden" style={cs}>
            <h2 className="text-[11px] font-semibold tracking-widest uppercase text-[#AEAEB2] px-5 pt-5 pb-2 sm:px-6">데이터</h2>
            <button onClick={handleExport}
              className="w-full flex items-center justify-between px-5 sm:px-6 py-4 hover:bg-[#FAFAFB] active:bg-[#F5F5F7] transition-colors text-left border-t border-[#F5F5F7]">
              <div>
                <p className="text-sm font-medium text-[#1D1D1F]">JSON으로 내보내기</p>
                <p className="text-[11px] text-[#AEAEB2] mt-0.5">책·일별 기록·목표 전체를 파일로 백업</p>
              </div>
              <svg className="w-4 h-4 text-[#AEAEB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-between px-5 sm:px-6 py-4 hover:bg-[#FAFAFB] active:bg-[#F5F5F7] transition-colors text-left border-t border-[#F5F5F7]">
              <div>
                <p className="text-sm font-medium text-[#1D1D1F]">JSON에서 가져오기</p>
                <p className="text-[11px] text-[#AEAEB2] mt-0.5">백업 파일을 현재 목록에 합쳐서 복원(안전)</p>
              </div>
              <svg className="w-4 h-4 text-[#AEAEB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
              onChange={(e) => { handleImport(e.target.files?.[0]); e.target.value = ''; }} />
            <button onClick={() => setConfirmReset(true)}
              className="w-full flex items-center justify-between px-5 sm:px-6 py-4 hover:bg-red-50/50 active:bg-red-50 transition-colors text-left border-t border-[#F5F5F7]">
              <div>
                <p className="text-sm font-medium text-red-500">모든 책 기록 초기화</p>
                <p className="text-[11px] text-[#AEAEB2] mt-0.5">이 브라우저의 로컬 기록을 모두 삭제</p>
              </div>
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
              </svg>
            </button>
          </div>

          {signedIn && (
            <div className="bg-white rounded-2xl overflow-hidden" style={cs}>
              <button onClick={() => setConfirmSignOut(true)}
                className="w-full flex items-center justify-center gap-2 py-4 text-sm font-semibold text-red-500 hover:bg-red-50/50 active:bg-red-50 transition-colors">
                로그아웃
              </button>
            </div>
          )}

          {/* 정보 */}
          <div className="text-center pt-3">
            <p className="text-[11px] text-[#AEAEB2]">My Library · v1.0</p>
          </div>
        </div>
      </div>

      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} onGoogle={() => { setShowLogin(false); signIn(); }} />

      {confirmReset && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 sm:p-8"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
            <h3 className="text-lg font-semibold text-[#1D1D1F] mb-2">정말 모두 삭제할까요?</h3>
            <p className="text-[#6E6E73] text-sm mb-6">모든 책과 기록이 사라집니다. {signedIn ? '로그인된 상태라면 Drive에도 동기화되어 다른 기기에서도 사라져요.' : '되돌릴 수 없어요.'}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmReset(false)} className="flex-1 py-3.5 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] text-sm font-medium active:bg-gray-200 transition-colors">취소</button>
              <button onClick={handleReset} className="flex-1 py-3.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 active:bg-red-700 transition-colors">모두 삭제</button>
            </div>
          </div>
        </div>
      )}

      {confirmSignOut && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 sm:p-8"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
            <h3 className="text-lg font-semibold text-[#1D1D1F] mb-2">로그아웃할까요?</h3>
            <p className="text-[#6E6E73] text-sm mb-6">책 기록은 Drive에 안전하게 보관되어 있어요. 다시 로그인하면 그대로 불러옵니다.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSignOut(false)} className="flex-1 py-3.5 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] text-sm font-medium active:bg-gray-200 transition-colors">취소</button>
              <button onClick={() => { signOut(); setConfirmSignOut(false); }} className="flex-1 py-3.5 rounded-xl bg-[#1D1D1F] text-white text-sm font-medium hover:bg-[#3A3A3C] transition-colors">로그아웃</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
