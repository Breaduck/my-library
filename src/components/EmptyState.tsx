import { Link } from 'react-router-dom';

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {/* Decorative book stack */}
      <div className="relative mb-8 select-none" style={{ width: 120, height: 100 }}>
        <div className="absolute bottom-0 left-6 w-16 h-24 rounded-lg rotate-[-8deg] origin-bottom"
          style={{ background: 'linear-gradient(135deg, #c7d2fe, #a5b4fc)', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }} />
        <div className="absolute bottom-0 left-12 w-16 h-24 rounded-lg rotate-[0deg] origin-bottom"
          style={{ background: 'linear-gradient(135deg, #fbcfe8, #f9a8d4)', boxShadow: '0 4px 16px rgba(236,72,153,0.3)' }} />
        <div className="absolute bottom-0 left-18 w-16 h-24 rounded-lg rotate-[8deg] origin-bottom"
          style={{ background: 'linear-gradient(135deg, #bbf7d0, #86efac)', boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }} />
      </div>

      <h2 className="text-2xl font-bold text-[#1D1D1F] tracking-tight mb-2">
        서재가 비어있어요
      </h2>
      <p className="text-[#6E6E73] mb-8 text-sm leading-relaxed max-w-[200px]">
        첫 번째 책을 추가해서<br />나만의 서재를 채워보세요
      </p>
      <Link
        to="/add"
        className="flex items-center gap-2 px-6 py-3.5 bg-[#1D1D1F] text-white rounded-full text-sm font-semibold hover:bg-[#3A3A3C] active:scale-[0.98] transition-all"
        style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        첫 번째 책 추가하기
      </Link>
    </div>
  );
}
