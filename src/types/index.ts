export type ReadingStatus = 'want' | 'reading' | 'done' | 'stopped';

export interface Quote {
  id: string;
  text: string;
  page?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  status: ReadingStatus;
  oneLiner: string;
  startDate: string;
  endDate: string;
  review: string;
  quotes: Quote[];
  rating: number;
  createdAt: string;
  updatedAt?: string; // 동기화 충돌 해소용 — 변경 시 갱신
  totalReadingTime: number; // seconds
  pages?: number;
  currentPage?: number;
  genre?: string;
}

export interface BookSearchResult {
  title: string;
  author: string;
  coverUrl: string;
  pages?: number;
  isbn?: string;
  genre?: string;
}
