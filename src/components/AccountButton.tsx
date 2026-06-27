import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LoginModal from './LoginModal';

function initialsFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const ch = trimmed[0];
  return ch.toUpperCase();
}

export default function AccountButton() {
  const { enabled, state, profile, signIn } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();

  if (!enabled) return null;

  const signedIn = state === 'synced' || state === 'saving' || (state === 'connecting' && !!profile);
  const showSpinner = state === 'connecting' || state === 'saving';

  function handleClick() {
    if (signedIn) {
      navigate('/settings');
    } else {
      setShowLogin(true);
    }
  }

  function handleGoogle() {
    setShowLogin(false);
    signIn();
  }

  return (
    <>
      <button
        onClick={handleClick}
        title={signedIn ? '내 설정' : '로그인'}
        className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white overflow-hidden active:scale-95 transition-transform"
        style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}
      >
        {signedIn && profile?.picture ? (
          <img src={profile.picture} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : signedIn ? (
          <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #818CF8, #C084FC)' }}>
            {initialsFromName(profile?.name ?? '?')}
          </div>
        ) : (
          <svg className="w-5 h-5 text-[#6E6E73]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
        {showSpinner && (
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#0071E3] animate-spin pointer-events-none" />
        )}
        {state === 'error' && !signedIn && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
        )}
      </button>

      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} onGoogle={handleGoogle} />
    </>
  );
}
