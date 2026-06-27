import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AddPage from './pages/AddPage';
import BookDetailPage from './pages/BookDetailPage';
import StatsPage from './pages/StatsPage';
import TimerPage from './pages/TimerPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/add" element={<AddPage />} />
        <Route path="/book/:id" element={<BookDetailPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/timer/:id" element={<TimerPage />} />
      </Routes>
    </BrowserRouter>
  );
}
