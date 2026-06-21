import { useState } from 'react';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md';
}

export default function StarRating({ value, onChange, readonly = false, size = 'md' }: Props) {
  const [hover, setHover] = useState(0);
  const textSize = size === 'sm' ? 'text-lg' : 'text-2xl';

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={`${textSize} transition-transform leading-none ${
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          }`}
        >
          <span className={(hover || value) >= star ? 'text-amber-400' : 'text-gray-200'}>
            ★
          </span>
        </button>
      ))}
    </div>
  );
}
