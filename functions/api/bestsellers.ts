interface Env {
  NAVER_CLIENT_ID: string;
  NAVER_CLIENT_SECRET: string;
}

function cleanTitle(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*\[[^\]]*\]\s*$/, '').trim();
}

function cleanAuthor(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').split('^').map((s) => s.trim()).filter(Boolean).join(', ') || '저자 미상';
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clientId = context.env.NAVER_CLIENT_ID;
  const clientSecret = context.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'Naver API credentials not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
      author: cleanAuthor(item.author),
      coverUrl: item.image || '',
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
