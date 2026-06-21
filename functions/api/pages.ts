interface Env {
  ALADIN_TTB_KEY: string;
}

function json(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}

async function pagesByAladinIsbn(isbn: string, key: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${key}&itemIdType=ISBN13&ItemId=${isbn}&output=js&Version=20131101`
    );
    if (!res.ok) return null;
    const data = await res.json() as { item?: { itemPage?: number }[] };
    const page = data.item?.[0]?.itemPage;
    return typeof page === 'number' && page > 0 ? page : null;
  } catch {
    return null;
  }
}

async function pagesByOpenLibraryIsbn(isbn: string): Promise<number | null> {
  try {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    if (!res.ok) return null;
    const data = await res.json() as Record<string, { number_of_pages?: number }>;
    const pages = data[`ISBN:${isbn}`]?.number_of_pages;
    return typeof pages === 'number' ? pages : null;
  } catch {
    return null;
  }
}

async function pagesByTitle(title: string, author?: string): Promise<number | null> {
  try {
    const q = author ? `${title} ${author}` : title;
    const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5&fields=title,number_of_pages`);
    if (!res.ok) return null;
    const data = await res.json() as { docs?: { number_of_pages?: number }[] };
    const first = (data.docs ?? []).find((d) => (d.number_of_pages ?? 0) > 0);
    return first?.number_of_pages ?? null;
  } catch {
    return null;
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const isbn = url.searchParams.get('isbn')?.trim();
  const title = url.searchParams.get('title')?.trim();
  const author = url.searchParams.get('author')?.trim();
  const key = context.env.ALADIN_TTB_KEY;

  if (isbn) {
    const pages = (key ? await pagesByAladinIsbn(isbn, key) : null) ?? await pagesByOpenLibraryIsbn(isbn);
    if (pages) return json({ pages });
  }

  if (title) {
    const pages = await pagesByTitle(title, author);
    if (pages) return json({ pages });
  }

  return json({ pages: null });
};
