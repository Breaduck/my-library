import { useRef } from 'react';

type Preset = 'today' | 'yesterday' | 'week-ago' | 'two-weeks-ago';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets?: Preset[];
}

const PRESET_LABEL: Record<Preset, string> = {
  'today': '오늘',
  'yesterday': '어제',
  'week-ago': '1주 전',
  'two-weeks-ago': '2주 전',
};

function isoOffset(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function presetToIso(p: Preset): string {
  switch (p) {
    case 'today':          return isoOffset(0);
    case 'yesterday':      return isoOffset(1);
    case 'week-ago':       return isoOffset(7);
    case 'two-weeks-ago':  return isoOffset(14);
  }
}

function formatFriendly(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export default function DateField({ label, value, onChange, presets = ['today', 'yesterday', 'week-ago'] }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return; } catch {}
    }
    el.focus();
    el.click();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-[#6E6E73]">{label}</label>
        <div className="flex gap-1.5">
          {presets.map((p) => {
            const iso = presetToIso(p);
            const active = value === iso;
            return (
              <button key={p} type="button" onClick={() => onChange(iso)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  active
                    ? 'bg-[#1D1D1F] text-white'
                    : 'bg-[#F5F5F7] text-[#6E6E73] hover:bg-gray-200'
                }`}>
                {PRESET_LABEL[p]}
              </button>
            );
          })}
        </div>
      </div>
      <button type="button" onClick={openPicker}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#F5F5F7] hover:bg-gray-200 active:bg-gray-300 transition-colors text-left">
        <span className={`text-sm ${value ? 'text-[#1D1D1F] font-medium' : 'text-[#AEAEB2]'}`}>
          {value ? formatFriendly(value) : '날짜 선택'}
        </span>
        <div className="flex items-center gap-2">
          {value && (
            <span
              role="button"
              aria-label="날짜 지우기"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="w-6 h-6 flex items-center justify-center rounded-full text-[#AEAEB2] hover:text-[#6E6E73] hover:bg-white text-base cursor-pointer">×</span>
          )}
          <svg className="w-4 h-4 text-[#AEAEB2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
