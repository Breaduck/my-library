import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

// PWA 서비스 워커 등록 (설치 가능 + 오프라인 캐시)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* 무시 */ });
  });
}

// 저장소 영구 보존 요청 — 브라우저가 공간 부족이나 장기 미사용을 이유로 localStorage를
// 임의로 비우는 것을 막는다(Chrome/Firefox는 이 요청을 존중, Safari는 무시할 수 있음).
// 독서 기록이 이 브라우저에만 있는 비로그인 사용자에게 특히 중요하다.
if (navigator.storage?.persist) {
  navigator.storage.persisted?.()
    .then((already) => (already ? true : navigator.storage.persist()))
    .catch(() => { /* 지원하지 않는 브라우저 — 무시 */ });
}
