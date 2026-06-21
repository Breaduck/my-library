interface Env {
  NAVER_CLIENT_ID: string;
  NAVER_CLIENT_SECRET: string;
  ALADIN_TTB_KEY: string;
}

function cleanTitle(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*\[[^\]]*\]\s*$/, '').trim();
}

function cleanNaverAuthor(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').split('^').map((s) => s.trim()).filter(Boolean).join(', ') || '저자 미상';
}

function cleanAladinAuthor(raw: string): string {
  return raw.replace(/\s*\([^)]*\)/g, '').split(',').map((s) => s.trim()).filter(Boolean).join(', ') || '저자 미상';
}

function upgradeAladinCover(url: string): string {
  if (!url) return '';
  return url.replace(/\/(coversum|cover_thumb|cover200|cover150)\//, '/cover500/');
}

function upgradeNaverCover(url: string): string {
  if (!url) return '';
  if (url.includes('shopping-phinf.pstatic.net') || url.includes('bookthumb-phinf.pstatic.net')) {
    return url.replace(/\?type=[^&]*/, '?type=f300x400');
  }
  return url;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const aladinKey = context.env.ALADIN_TTB_KEY;

  // 1순위: 알라딘 베스트셀러 (실제 베스트셀러 순위 + 고화질 표지)
  if (aladinKey) {
    try {
      const res = await fetch(
        `https://www.aladin.co.kr/ttb/api/ItemList.aspx?ttbkey=${aladinKey}&QueryType=Bestseller&MaxResults=20&start=1&SearchTarget=Book&output=js&Version=20131101&Cover=Big&OptResult=subInfo,authors,categoryIdList`
      );
      if (res.ok) {
        const data = await res.json() as { item?: Record<string, unknown>[] };
        if (Array.isArray(data.item) && data.item.length > 0) {
          const books = data.item.map((item) => ({
            title: cleanTitle(String(item.title || '')),
            author: cleanAladinAuthor(String(item.author || '')),
            coverUrl: upgradeAladinCover(String(item.cover || '')),
            isbn: String(item.isbn13 || item.isbn || ''),
            description: String(item.description || '').replace(/<[^>]+>/g, '').trim(),
            publisher: String(item.publisher || ''),
            pubdate: String(item.pubDate || ''),
            price: String(item.priceStandard || ''),
            discount: String(item.priceSales || ''),
          }));
          return new Response(JSON.stringify(books), { headers: { 'Content-Type': 'application/json' } });
        }
      }
    } catch {}
  }

  // 2순위: 네이버 책 검색 (베스트셀러 검색어로)
  const clientId = context.env.NAVER_CLIENT_ID;
  const clientSecret = context.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'No API credentials configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent('베스트셀러')}&display=20&sort=sim`,
      { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret } }
    );
    if (!res.ok) throw new Error(`Naver API error: ${res.status}`);
    const data = await res.json() as { items?: Record<string, string>[] };
    const books = (data.items || []).map((item) => ({
      title: cleanTitle(item.title),
      author: cleanNaverAuthor(item.author),
      coverUrl: upgradeNaverCover(item.image || ''),
      isbn: item.isbn?.split(' ').find((s) => s.length === 13) || item.isbn?.split(' ')[0] || '',
      description: item.description?.replace(/<[^>]+>/g, '').trim() || '',
      publisher: item.publisher || '',
      pubdate: item.pubdate || '',
      price: item.price || '',
      discount: item.discount || '',
    }));
    return new Response(JSON.stringify(books), { headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch bestsellers' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
