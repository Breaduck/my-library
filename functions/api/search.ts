interface Env {
  ALADIN_TTB_KEY: string;
  NAVER_CLIENT_ID: string;
  NAVER_CLIENT_SECRET: string;
}

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

function cleanTitle(raw: string): string {
  let t = raw.replace(/<[^>]+>/g, '').trim();
  const dash = t.indexOf(' - ');
  if (dash > 0) t = t.slice(0, dash).trim();
  return t.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*\[[^\]]*\]\s*$/, '').replace(/^\[[^\]]+\]\s*/, '').trim();
}

function cleanNaverAuthor(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').split('^').map((s) => s.trim()).filter(Boolean).join(', ') || '저자 미상';
}

/* "마이클 샌델 (지은이), 김명철 (옮긴이), 김선욱 (감수)" → "마이클 샌델"
   역할 마커가 있으면 (지은이)만 추리고, 없으면 첫 사람만 남긴다. */
function cleanAladinAuthor(raw: string): string {
  if (!raw) return '저자 미상';
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const writers = parts.filter((p) => /\(지은이\)/.test(p)).map((p) => p.replace(/\s*\([^)]*\)\s*/g, '').trim()).filter(Boolean);
  if (writers.length > 0) return writers.join(', ');
  const stripped = parts.map((p) => p.replace(/\s*\([^)]*\)\s*/g, '').trim()).filter(Boolean);
  return stripped[0] || '저자 미상';
}

/* "정의란 무엇인가 - 한국 200만 부 돌파, 37개국..." → "정의란 무엇인가"
   "[큰글자] 책 제목" → 책 제목 (선행 [태그] 제거) */
function cleanAladinTitle(raw: string): string {
  if (!raw) return '';
  let t = raw.replace(/<[^>]+>/g, '').trim();
  const dash = t.indexOf(' - ');
  if (dash > 0) t = t.slice(0, dash).trim();
  t = t.replace(/^\[[^\]]+\]\s*/, '').trim();
  return t;
}

/* 알라딘 표지: coversum / cover200 → cover500 (고화질) */
function upgradeAladinCover(url: string): string {
  if (!url) return '';
  return url.replace(/\/(coversum|cover_thumb|cover200|cover150)\//, '/cover500/');
}

/* 네이버 표지: ?type=m1 등 작은 사이즈를 큰 사이즈로 */
function upgradeNaverCover(url: string): string {
  if (!url) return '';
  if (url.includes('shopping-phinf.pstatic.net') || url.includes('bookthumb-phinf.pstatic.net')) {
    return url.replace(/\?type=[^&]*/, '?type=f300x400');
  }
  return url;
}

function pickAladinPages(item: Record<string, unknown>): number | undefined {
  if (typeof item.itemPage === 'number' && item.itemPage > 0) return item.itemPage;
  const sub = item.subInfo as Record<string, unknown> | undefined;
  if (sub && typeof sub.itemPage === 'number' && sub.itemPage > 0) return sub.itemPage;
  return undefined;
}

function json(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const query = url.searchParams.get('q');
  if (!query?.trim()) return json([]);

  const aladinKey = context.env.ALADIN_TTB_KEY;
  const naverClientId = context.env.NAVER_CLIENT_ID;
  const naverClientSecret = context.env.NAVER_CLIENT_SECRET;

  if (aladinKey) {
    try {
      // OptResult=subInfo → itemPage 포함, Cover=Big → 큰 이미지
      const res = await fetch(
        `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${aladinKey}&Query=${encodeURIComponent(query)}&QueryType=Keyword&MaxResults=10&start=1&SearchTarget=Book&output=js&Version=20131101&Cover=Big&OptResult=subInfo,authors,categoryIdList`
      );
      const data = await res.json() as { item?: Record<string, unknown>[] };
      if (Array.isArray(data.item) && data.item.length > 0) {
        return json(data.item.map((item) => ({
          title: cleanAladinTitle(String(item.title || '')),
          author: cleanAladinAuthor(String(item.author || '')),
          coverUrl: upgradeAladinCover(String(item.cover || '')),
          pages: pickAladinPages(item),
          isbn: String(item.isbn13 || item.isbn || ''),
          genre: mapGenre(String(item.categoryName || '')),
        })));
      }
    } catch {}
  }

  if (naverClientId && naverClientSecret) {
    try {
      const res = await fetch(
        `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(query)}&display=10`,
        { headers: { 'X-Naver-Client-Id': naverClientId, 'X-Naver-Client-Secret': naverClientSecret } }
      );
      const data = await res.json() as { items?: Record<string, string>[] };
      if (data.items && data.items.length > 0) {
        return json(data.items.map((item) => ({
          title: cleanTitle(item.title),
          author: cleanNaverAuthor(item.author),
          coverUrl: upgradeNaverCover(item.image || ''),
          isbn: item.isbn?.split(' ').find((s) => s.length === 13) || item.isbn?.split(' ')[0] || '',
        })));
      }
    } catch {}
  }

  try {
    const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&fields=title,author_name,cover_i`);
    const data = await res.json() as { docs?: Record<string, unknown>[] };
    const results = (data.docs || []).filter((d) => d.title && d.cover_i).map((d) => ({
      title: d.title as string,
      author: Array.isArray(d.author_name) ? (d.author_name[0] as string) : '저자 미상',
      coverUrl: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`,
    }));
    if (results.length > 0) return json(results);
  } catch {}

  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`);
    const data = await res.json() as { items?: Record<string, unknown>[] };
    const results = (data.items || []).map((item) => {
      const info = item.volumeInfo as Record<string, unknown> | undefined;
      const links = info?.imageLinks as Record<string, string> | undefined;
      const categories = info?.categories as string[] | undefined;
      const cover = links?.extraLarge || links?.large || links?.medium || links?.thumbnail || '';
      return {
        title: (info?.title as string) || '',
        author: Array.isArray(info?.authors) ? (info.authors[0] as string) : '저자 미상',
        coverUrl: cover.replace('http://', 'https://'),
        pages: typeof info?.pageCount === 'number' && (info.pageCount as number) > 0 ? (info.pageCount as number) : undefined,
        genre: mapGenre(categories?.[0] || '') || undefined,
      };
    }).filter((b) => b.title);
    return json(results);
  } catch {}

  return json([]);
};
