import { useRef, useState, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB safety cap for localStorage

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CoverInput({ value, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'pick' | 'url'>('pick');
  const [urlDraft, setUrlDraft] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode === 'url') setUrlDraft(value.startsWith('data:') ? '' : value);
  }, [mode, value]);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 올릴 수 있어요'); return; }
    if (file.size > MAX_BYTES) { setError('이미지가 너무 커요 (최대 4MB)'); return; }
    try {
      const dataUrl = await fileToDataURL(file);
      onChange(dataUrl);
      setError('');
    } catch {
      setError('이미지를 읽지 못했어요');
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        handleFile(file);
        return;
      }
    }
    // text fallback: if pasted text looks like an image URL, accept it
    const text = e.clipboardData.getData('text');
    if (text && /^https?:\/\/.+\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i.test(text.trim())) {
      e.preventDefault();
      onChange(text.trim());
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }

  function commitUrl() {
    const t = urlDraft.trim();
    if (!t) return;
    onChange(t);
  }

  if (value) {
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F5F5F7]">
        <img src={value} alt="cover preview" className="w-16 h-24 rounded-lg object-cover flex-shrink-0"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <p className="text-xs text-[#6E6E73] break-all line-clamp-2">
            {value.startsWith('data:') ? '내 컴퓨터에서 불러온 이미지' : value}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="text-xs px-2.5 py-1.5 rounded-md bg-white text-[#1D1D1F] font-medium hover:bg-gray-100 transition-colors">
              교체
            </button>
            <button type="button" onClick={() => { onChange(''); setError(''); }}
              className="text-xs px-2.5 py-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors">
              제거
            </button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={dropRef}
        tabIndex={0}
        onPaste={handlePaste}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-colors px-4 py-6 text-center outline-none focus:ring-2 focus:ring-[#0071E3] ${dragOver ? 'border-[#0071E3] bg-blue-50/40' : 'border-[#D1D1D6] bg-[#FAFAFB] hover:bg-[#F5F5F7]'}`}
      >
        <div className="flex flex-col items-center gap-1.5">
          <svg className="w-7 h-7 text-[#AEAEB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-xs text-[#1D1D1F] font-medium">파일 선택 · 끌어다 놓기 · 붙여넣기 (Ctrl+V)</p>
          <p className="text-[10px] text-[#AEAEB2]">PNG, JPG, WebP · 최대 4MB</p>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <div className="flex items-center gap-2">
        {mode === 'pick' ? (
          <button type="button" onClick={() => setMode('url')}
            className="text-xs text-[#AEAEB2] hover:text-[#6E6E73] transition-colors">
            URL로 입력
          </button>
        ) : (
          <>
            <input type="url" value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commitUrl())}
              onBlur={commitUrl}
              placeholder="https://..."
              autoFocus
              className="flex-1 px-3 py-2 rounded-lg bg-[#F5F5F7] text-sm text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] transition-all" />
            <button type="button" onClick={() => setMode('pick')}
              className="text-xs text-[#AEAEB2] hover:text-[#6E6E73] transition-colors">
              취소
            </button>
          </>
        )}
      </div>

      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
