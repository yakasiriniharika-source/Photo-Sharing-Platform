import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Public customer gallery pages should show zero login/account UI
  if (location.pathname.startsWith('/gallery/')) {
    return null;
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
      <Link to="/dashboard" className="text-lg font-semibold text-gray-900">
        📸 PhotoShare
      </Link>
      {user && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {user.name} <span className="text-gray-400">· {user.role}</span>
          </span>
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}