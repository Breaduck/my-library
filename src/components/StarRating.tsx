import { useState } from 'react';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md';
}

// 슬롯(별 하나)의 픽셀 크기. 반쪽 탭 영역이 손가락으로도 눌리도록 넉넉히.
const SIZE_PX = { sm: 22, md: 34 };

export default function StarRating({ value, onChange, readonly = false, size = 'md' }: Props) {
  // hover는 마우스에서만 미리보기. 터치에서는 tap(click)으로 바로 확정된다.
  const [hover, setHover] = useState<number | null>(null);
  const px = SIZE_PX[size];
  const shown = hover ?? value;

  function pick(v: number) {
    if (readonly) return;
    onChange?.(v);
  }

  return (
    <div className="flex items-center" style={{ touchAction: 'manipulation' }}>
      <div className="flex" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((star) => {
          // 이 별이 채워지는 비율: 0, 0.5, 1
          const fill = Math.max(0, Math.min(1, shown - (star - 1)));
          return (
            <div key={star} className="relative select-none" style={{ width: px, height: px }}>
              {/* 바탕(빈 별) */}
              <span
                className="absolute inset-0 flex items-center justify-center leading-none text-gray-200"
                style={{ fontSize: px }}
              >
                ★
              </span>
              {/* 채워진 별 — 왼쪽부터 fill 비율만큼만 보이도록 클립 */}
              <span
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ width: `${fill * 100}%` }}
              >
                <span
                  className="flex items-center justify-center leading-none text-amber-400"
                  style={{ width: px, height: px, fontSize: px }}
                >
                  ★
                </span>
              </span>
              {/* 좌/우 반쪽 탭 영역 — 왼쪽 절반은 .5점, 오른쪽 절반은 1점 */}
              {!readonly && (
                <>
                  <button
                    type="button"
                    aria-label={`${star - 0.5}점`}
                    onClick={() => pick(star - 0.5)}
                    onMouseEnter={() => setHover(star - 0.5)}
                    className="absolute top-0 left-0 h-full cursor-pointer"
                    style={{ width: '50%' }}
                  />
                  <button
                    type="button"
                    aria-label={`${star}점`}
                    onClick={() => pick(star)}
                    onMouseEnter={() => setHover(star)}
                    className="absolute top-0 right-0 h-full cursor-pointer"
                    style={{ width: '50%' }}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
      {!readonly && shown > 0 && (
        <span className="ml-2 text-xs font-medium text-[#AEAEB2] tabular-nums">{shown.toFixed(1)}</span>
      )}
    </div>
  );
}
