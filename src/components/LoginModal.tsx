interface Props {
  open: boolean;
  onClose: () => void;
  onGoogle: () => void;
}

export default function LoginModal({ open, onClose, onGoogle }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 sm:p-7"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />

        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-2xl items-center justify-center mb-3"
            style={{ background: 'linear-gradient(135deg, #FFF1D0 0%, #F2CA8A 100%)', boxShadow: '0 4px 16px rgba(150,100,40,0.18)' }}>
            <span className="text-2xl">📚</span>
          </div>
          <h3 className="text-lg font-bold text-[#1D1D1F] mb-1">내 서재에 로그인</h3>
          <p className="text-[13px] text-[#6E6E73] leading-relaxed">
            로그인하면 책 기록이 안전하게 백업되고<br />다른 기기에서도 이어볼 수 있어요.
          </p>
        </div>

        <button onClick={onGoogle}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white text-[#1D1D1F] text-sm font-semibold border border-[#E5E5EA] hover:bg-[#FAFAFB] active:scale-[0.98] transition-all">
          <GoogleIcon />
          Google로 계속하기
        </button>

        <button onClick={onClose}
          className="w-full mt-4 py-3 text-sm font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">
          나중에
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
