import { NextRequest, NextResponse } from 'next/server';

const GENRE_MAP: [RegExp, string][] = [
  [/소설|시\/희곡|시,희곡|fiction/i, '소설'],
  [/에세이|essay/i, '에세이'],
  [/자기계발|self.?help/i, '자기계발'],
  [/경제|경영|business|economics/i, '경제/경영'],
  [/역사|history/i, '역사'],
  [/과학|science/i, '과학'],
  [/철학|philosophy/i, '철학'],
  [/심리|psychology/i, '심리학'],
  [/사회|social/i, '사회'],
  [/예술|art/i, '예술'],
  [/여행|travel/i, '여행'],
  [/인문|humanities/i, '인문학'],
];

function mapGenre(category: string): string | undefined {
  for (const [re, genre] of GENRE_MAP) {
    if (re.test(category)) return genre;
  }
  return undefined;
}

// 네이버: "(한강 소설ㅣ2024년 노벨문학상 수상작가)" 같은 설명 제거
function cleanTitle(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s*\[[^\]]*\]\s*$/, '')
    .trim();
}

// 네이버: "한강^김영하" → "한강, 김영하"
function cleanNaverAuthor(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .split('^')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ') || '저자 미상';
}

// 알라딘: "한강 (지은이), 이름 (옮긴이)" → "한강"
function cleanAladinAuthor(raw: string): string {
  return raw
    .replace(/\s*\([^)]*\)/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ') || '저자 미상';
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  if (!query?.trim()) {
    return NextResponse.json([]);
  }

  const aladinKey = process.env.ALADIN_TTB_KEY;
  const naverClientId = process.env.NAVER_CLIENT_ID;
  const naverClientSecret = process.env.NAVER_CLIENT_SECRET;

  // 1. 알라딘 (페이지수 포함, 국내 서적 최적)
  if (aladinKey) {
    try {
      const res = await fetch(
        `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${aladinKey}&Query=${encodeURIComponent(query)}&QueryType=Keyword&MaxResults=10&start=1&SearchTarget=Book&output=js&Version=20131101&Cover=Big`
      );
      const data = await res.json();
      if (Array.isArray(data.item) && data.item.length > 0) {
        return NextResponse.json(
          data.item.map((item: Record<string, unknown>) => ({
            title: String(item.title || ''),
            author: cleanAladinAuthor(String(item.author || '')),
            coverUrl: String(item.cover || '').replace('coversum', 'cover200'),
            pages: typeof item.itemPage === 'number' && item.itemPage > 0 ? item.itemPage : undefined,
            isbn: String(item.isbn13 || item.isbn || ''),
            genre: mapGenre(String(item.categoryName || '')),
          }))
        );
      }
    } catch {}
  }

  // 2. 네이버 (커버 품질 좋음, 페이지수 없음)
  if (naverClientId && naverClientSecret) {
    try {
      const res = await fetch(
        `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(query)}&display=10`,
        {
          headers: {
            'X-Naver-Client-Id': naverClientId,
            'X-Naver-Client-Secret': naverClientSecret,
          },
        }
      );
      const data = await res.json();
      if (data.items?.length > 0) {
        return NextResponse.json(
          data.items.map((item: Record<string, string>) => ({
            title: cleanTitle(item.title),
            author: cleanNaverAuthor(item.author),
            coverUrl: item.image || '',
            isbn: item.isbn?.split(' ').find((s: string) => s.length === 13) || item.isbn?.split(' ')[0] || '',
          }))
        );
      }
    } catch {}
  }

  // 3. Open Library (해외 서적)
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&fields=title,author_name,cover_i`
    );
    const data = await res.json();
    const results = (data.docs || [])
      .filter((d: Record<string, unknown>) => d.title && d.cover_i)
      .map((d: Record<string, unknown>) => ({
        title: d.title as string,
        author: Array.isArray(d.author_name) ? (d.author_name[0] as string) : '저자 미상',
        coverUrl: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`,
      }));
    if (results.length > 0) return NextResponse.json(results);
  } catch {}

  // 4. Google Books (최후 수단)
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`
    );
    const data = await res.json();
    const results = ((data.items || []) as Record<string, unknown>[])
      .map((item) => {
        const info = item.volumeInfo as Record<string, unknown> | undefined;
        const links = info?.imageLinks as Record<string, string> | undefined;
        const cover =
          links?.extraLarge || links?.large || links?.medium || links?.thumbnail || '';
        const categories = info?.categories as string[] | undefined;
        return {
          title: (info?.title as string) || '',
          author: Array.isArray(info?.authors) ? (info.authors[0] as string) : '저자 미상',
          coverUrl: cover.replace('http://', 'https://'),
          pages: typeof info?.pageCount === 'number' && (info.pageCount as number) > 0
            ? (info.pageCount as number)
            : undefined,
          genre: mapGenre(categories?.[0] || '') || undefined,
        };
      })
      .filter((b) => b.title);
    return NextResponse.json(results);
  } catch {}

  return NextResponse.json([]);
}
