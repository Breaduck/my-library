export type ReadingStatus = 'want' | 'reading' | 'done' | 'stopped';

export interface Quote {
  id: string;
  text: string;
  page?: string;
}

export interface Postit {
  id: string;
  text: string;
  color: string; // 포스트잇 배경색 키 (yellow/pink/blue/green/purple)
  date?: string; // 작성일 (YYYY.MM.DD)
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
  postits?: Postit[];
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
