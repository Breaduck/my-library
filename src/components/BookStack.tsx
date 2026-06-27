import { Link } from 'react-router-dom';
import { Book } from '@/types';

const STACK_COLORS = [
  { bg: '#F4C2C7', text: '#7B3A45' },   // dusty rose
  { bg: '#F8D7DA', text: '#7C3F46' },   // soft pink
  { bg: '#FBE2D7', text: '#7E4A35' },   // peach
  { bg: '#F5DAB3', text: '#6E5224' },   // honey
  { bg: '#E8DAB6', text: '#5E4A1F' },   // beige
  { bg: '#E4E8C8', text: '#5A6532' },   // sage
  { bg: '#CFE2E5', text: '#365860' },   // mist
  { bg: '#D6D6EB', text: '#3E3E78' },   // lavender
];

function hashIdx(id: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % mod;
}

const DEFAULT_PAGES = 280;

function estimateThicknessMm(pages: number): number {
  // 1 page ≈ 0.1mm of book thickness (real-world avg)
  return pages * 0.1;
}

export default function BookStack({ books }: { books: Book[] }) {
  if (books.length === 0) return null;

  const totalMm = books.reduce((s, b) => s + estimateThicknessMm(b.pages ?? DEFAULT_PAGES), 0);
  const totalCm = (totalMm / 10).toFixed(1);

  const maxLen = Math.max(...books.map((b) => b.title.length), 1);

  return (
    <div className="flex flex-col items-center">
      {/* 상단 캐릭터 + 높이 */}
      <div className="relative mb-2">
        <div className="bg-white text-[#1D1D1F] text-[12px] font-semibold px-4 py-1.5 rounded-full"
          style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.10)' }}>
          내 책장 ({totalCm}cm)
        </div>
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0"
          style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #fff' }} />
      </div>

      {/* 책 더미 */}
      <div className="flex flex-col items-center w-full max-w-sm mx-auto" style={{ gap: 3 }}>
        {books.map((book) => {
          // pill width by title length (40~92%)
          const widthPct = Math.max(40, Math.min(92, 42 + (book.title.length / maxLen) * 50));
          const color = STACK_COLORS[hashIdx(book.id, STACK_COLORS.length)];
          const thicknessMm = estimateThicknessMm(book.pages ?? DEFAULT_PAGES);
          const pillHeight = Math.max(24, Math.min(40, thicknessMm * 1.2 + 18));

          return (
            <Link
              key={book.id}
              to={`/book/${book.id}`}
              title={`${book.title}${book.pages ? ` · ${book.pages}쪽` : ''}`}
              className="rounded-full flex items-center justify-center text-center active:scale-[0.97] transition-transform overflow-hidden"
              style={{
                width: `${widthPct}%`,
                height: pillHeight,
                background: color.bg,
                color: color.text,
                fontSize: 12.5,
                fontWeight: 600,
                paddingLeft: 16,
                paddingRight: 16,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}>
              <span className="truncate">{book.title}</span>
            </Link>
          );
        })}
      </div>

      <p className="text-center text-[10px] text-[#AEAEB2] mt-4">
        책의 두께는 페이지 수에 비례해요
      </p>
    </div>
  );
}
