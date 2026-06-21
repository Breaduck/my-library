import { NextResponse } from 'next/server';

function cleanTitle(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s*\[[^\]]*\]\s*$/, '')
    .trim();
}

function cleanAuthor(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .split('^')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ') || '저자 미상';
}

export async function GET() {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Naver API credentials not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent('베스트셀러')}&display=20&sort=sim`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) {
      throw new Error(`Naver API error: ${res.status}`);
    }

    const data = await res.json();
    const books = (data.items || []).map((item: Record<string, string>) => ({
      title: cleanTitle(item.title),
      author: cleanAuthor(item.author),
      coverUrl: item.image || '',
      isbn: item.isbn?.split(' ').find((s: string) => s.length === 13) || item.isbn?.split(' ')[0] || '',
      description: item.description?.replace(/<[^>]+>/g, '').trim() || '',
      publisher: item.publisher || '',
      pubdate: item.pubdate || '',
      price: item.price || '',
      discount: item.discount || '',
    }));

    return NextResponse.json(books);
  } catch (error) {
    console.error('Bestsellers fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch bestsellers' }, { status: 500 });
  }
}
