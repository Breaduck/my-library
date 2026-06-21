import { NextRequest, NextResponse } from 'next/server';

async function pagesByAladinIsbn(isbn: string): Promise<number | null> {
  const key = process.env.ALADIN_TTB_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${key}&itemIdType=ISBN13&ItemId=${isbn}&output=js&Version=20131101`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const page = data.item?.[0]?.itemPage;
    return typeof page === 'number' && page > 0 ? page : null;
  } catch {
    return null;
  }
}

async function pagesByOpenLibraryIsbn(isbn: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data[`ISBN:${isbn}`]?.number_of_pages;
    return typeof pages === 'number' ? pages : null;
  } catch {
    return null;
  }
}

async function pagesByTitle(title: string, author?: string): Promise<number | null> {
  try {
    const q = author ? `${title} ${author}` : title;
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5&fields=title,number_of_pages`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const docs = (data.docs ?? []) as Array<{ number_of_pages?: number }>;
    const first = docs.find((d) => (d.number_of_pages ?? 0) > 0);
    return first?.number_of_pages ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const isbn  = req.nextUrl.searchParams.get('isbn')?.trim();
  const title = req.nextUrl.searchParams.get('title')?.trim();
  const author = req.nextUrl.searchParams.get('author')?.trim();

  if (isbn) {
    const pages = await pagesByAladinIsbn(isbn) ?? await pagesByOpenLibraryIsbn(isbn);
    if (pages) return NextResponse.json({ pages });
  }

  if (title) {
    const pages = await pagesByTitle(title, author);
    if (pages) return NextResponse.json({ pages });
  }

  return NextResponse.json({ pages: null });
}
