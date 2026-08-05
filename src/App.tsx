import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AddPage from './pages/AddPage';
import BookDetailPage from './pages/BookDetailPage';
import StatsPage from './pages/StatsPage';
import TimerPage from './pages/TimerPage';
import SettingsPage from './pages/SettingsPage';
import FriendsPage from './pages/FriendsPage';
import FriendDetailPage from './pages/FriendDetailPage';
import { AuthProvider } from './hooks/useAuth';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/add" element={<AddPage />} />
          <Route path="/book/:id" element={<BookDetailPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/timer/:id" element={<TimerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/friends/:email" element={<FriendDetailPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
