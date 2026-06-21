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
