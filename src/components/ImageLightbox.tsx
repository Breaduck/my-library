import { useEffect } from 'react';

// 구글 프로필 사진은 URL 끝의 =s96-c 같은 크기 지정을 더 큰 값으로 바꾸면 고해상도로 받는다.
function hiRes(src: string): string {
  if (src.includes('googleusercontent.com')) {
    return src.replace(/=s\d+(-c)?$/, '=s960$1').replace(/=w\d+-h\d+(-c)?$/, '=s960$1');
  }
  return src;
}

// 프로필 사진 등을 크게 확대해서 보여주는 오버레이. 배경/닫기 버튼을 누르면 닫힌다.
export default function ImageLightbox({ src, alt = '', onClose }: { src: string; alt?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}>
      <img src={hiRes(src)} alt={alt} referrerPolicy="no-referrer"
        className="rounded-3xl object-cover"
        style={{ width: 'min(92vw, 78vh)', height: 'min(92vw, 78vh)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()} />
      <button onClick={onClose} aria-label="닫기"
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center backdrop-blur-md active:scale-95 transition-transform">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
