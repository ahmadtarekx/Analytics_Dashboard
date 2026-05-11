/**
 * App.jsx — Root component
 *
 * Wraps the entire tree in AuthProvider (Observer Pattern).
 * Route guards now read from AuthContext instead of localStorage directly.
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login     from './features/auth/Login';
import Dashboard from './pages/Dashboard';

// ── Route guards ───────────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { user }   = useAuth();
  const location   = useLocation();
  if (!user) return <Navigate to="/" replace state={{ from: location }} />;
  return children;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

// ── Routes ─────────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      <Route path="/"          element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
