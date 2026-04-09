import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import PlumberSchedule from './pages/PlumberSchedule.jsx'
import AdminBooking from './pages/AdminBooking.jsx'
import PropertyManager from './pages/PropertyManager.jsx'
import Homeowner from './pages/Homeowner.jsx'
import TenantSchedule from './pages/TenantSchedule.jsx'
import './styles/grid.css'

const TYPE_ROUTES = {
  admin: '/admin',
  plumber: '/plumber',
  homeowner: '/homeowner',
  property_manager: '/property-manager',
};

const TYPE_LABELS = {
  admin: 'Rapid Hot Admin',
  plumber: 'Plumber',
  homeowner: 'Homeowner',
  property_manager: 'Property Manager',
};

function Nav({ user, onLogout }) {
  const location = useLocation();
  if (!user) return null;

  const navLinks = {
    admin: [
      { to: '/admin', label: 'Job Booking' },
      { to: '/plumber', label: 'Plumber Availability' },
    ],
    plumber: [
      { to: '/plumber', label: 'My Schedule' },
    ],
    homeowner: [
      { to: '/homeowner', label: 'Book Service' },
    ],
    property_manager: [
      { to: '/property-manager', label: 'Dashboard' },
    ],
  };

  const links = navLinks[user.user_type] || [];

  return (
    <header className="app-header">
      <div className="header-left">
        <svg className="logo" viewBox="0 0 40 40" width="40" height="40">
          <circle cx="20" cy="20" r="19" fill="#E53E3E" />
          <path d="M20 8 C20 8, 14 14, 14 20 C14 23.3 16.7 26 20 26 C23.3 26 26 23.3 26 20 C26 14 20 8 20 8Z" fill="#FFF" />
          <rect x="18" y="24" width="4" height="8" rx="1" fill="#FFF" />
          <circle cx="20" cy="18" r="2" fill="#E53E3E" />
        </svg>
        <h1 className="app-title">Rapid Hot</h1>
      </div>
      <nav className="nav-links">
        {links.map(l => (
          <Link key={l.to} to={l.to} className={location.pathname === l.to ? 'active' : ''}>
            {l.label}
          </Link>
        ))}
        <span style={{ color: '#718096', fontSize: '0.8rem', padding: '8px 4px' }}>
          {user.name} ({TYPE_LABELS[user.user_type]})
        </span>
        <button onClick={onLogout} className="nav-logout">Sign Out</button>
      </nav>
    </header>
  );
}

function AppRoutes({ user, onLogin, onLogout }) {
  const navigate = useNavigate();

  const handleLogin = (userData) => {
    onLogin(userData);
    navigate(TYPE_ROUTES[userData.user_type] || '/');
  };

  return (
    <>
      <Nav user={user} onLogout={onLogout} />
      {user && <main className="app-main">
        <Routes>
          <Route path="/admin" element={<AdminBooking />} />
          <Route path="/plumber" element={<PlumberSchedule user={user} />} />
          <Route path="/property-manager" element={<PropertyManager user={user} />} />
          <Route path="/homeowner" element={<Homeowner user={user} />} />
          <Route path="/schedule/:token" element={<TenantSchedule />} />
          <Route path="*" element={<Landing onLogin={handleLogin} />} />
        </Routes>
      </main>}
      {!user && (
        <Routes>
          <Route path="/schedule/:token" element={
            <main className="app-main"><TenantSchedule /></main>
          } />
          <Route path="*" element={<Landing onLogin={handleLogin} />} />
        </Routes>
      )}
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const stored = sessionStorage.getItem('rapidhot_user');
    return stored ? JSON.parse(stored) : null;
  });

  const handleLogin = (userData) => {
    setUser(userData);
    sessionStorage.setItem('rapidhot_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('rapidhot_user');
  };

  return (
    <BrowserRouter>
      <AppRoutes user={user} onLogin={handleLogin} onLogout={handleLogout} />
    </BrowserRouter>
  );
}
