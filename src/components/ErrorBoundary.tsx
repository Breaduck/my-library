import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

// 렌더 오류가 나도 화면 전체가 하얗게 되지 않도록 감싼다.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <span className="text-3xl">📚</span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#1D1D1F]">잠시 문제가 생겼어요</h1>
          <p className="text-sm text-[#6E6E73] mt-1.5 leading-relaxed">
            기록은 안전하게 저장돼 있어요.<br />새로고침하면 대부분 해결됩니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-full bg-[#1D1D1F] text-white text-sm font-semibold active:scale-95 transition-transform">
            새로고침
          </button>
          <button onClick={() => { window.location.href = '/'; }}
            className="px-5 py-2.5 rounded-full bg-white text-[#1D1D1F] text-sm font-semibold active:scale-95 transition-transform" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
            홈으로
          </button>
        </div>
      </div>
    );
  }
}
