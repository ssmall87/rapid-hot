import { useState } from 'react'

const API = '/api';

const USER_TYPES = [
  { value: 'admin', label: 'Rapid Hot Team Member', icon: '🔥' },
  { value: 'plumber', label: 'Plumber', icon: '🔧' },
  { value: 'homeowner', label: 'Home Owner', icon: '🏠' },
  { value: 'property_manager', label: 'Property Manager', icon: '🏢' },
];

const TYPE_ROUTES = {
  admin: '/admin',
  plumber: '/plumber',
  homeowner: '/homeowner',
  property_manager: '/property-manager',
};

export default function Landing({ onLogin }) {
  const [mode, setMode] = useState(null); // 'signin' or 'register'
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [userType, setUserType] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) { setError('Enter your email'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/by-email/${encodeURIComponent(trimmedEmail)}`);
      if (res.ok) {
        const user = await res.json();
        onLogin(user);
      } else {
        setError('No account found with that email. Try registering.');
      }
    } catch {
      setError('Connection error');
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    setError('');
    if (!name || !email || !userType) { setError('Fill in all fields'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, user_type: userType })
      });
      const user = await res.json();
      if (res.ok) {
        onLogin(user);
      } else {
        setError(user.error || 'Registration failed');
      }
    } catch {
      setError('Connection error');
    }
    setLoading(false);
  };

  const handleSeedData = async () => {
    await fetch(`${API}/seed`, { method: 'POST' });
    setError('');
    alert('Mock data loaded! You can now sign in with:\n\n- shane@rapidhot.com (Admin)\n- mike@plumbing.com (Plumber)\n- sarah@plumbing.com (Plumber)\n- tom@properties.com (Property Manager)\n- jane@home.com (Homeowner)');
  };

  return (
    <div className="landing-page">
      <div className="landing-hero">
        <svg className="landing-logo" viewBox="0 0 60 60" width="80" height="80">
          <circle cx="30" cy="30" r="29" fill="#E53E3E" />
          <path d="M30 12 C30 12, 21 21, 21 30 C21 35 25 39 30 39 C35 39 39 35 39 30 C39 21 30 12 30 12Z" fill="#FFF" />
          <rect x="27" y="36" width="6" height="12" rx="2" fill="#FFF" />
          <circle cx="30" cy="27" r="3" fill="#E53E3E" />
        </svg>
        <h1 className="landing-title">Rapid Hot</h1>
        <p className="landing-subtitle">Water Heater Replacement Service</p>
      </div>

      {!mode && (
        <div className="landing-options">
          <button className="landing-btn" onClick={() => setMode('signin')}>
            Sign In
          </button>
          <button className="landing-btn landing-btn-outline" onClick={() => setMode('register')}>
            Create Account
          </button>
          <button className="landing-btn-seed" onClick={handleSeedData}>
            Load Demo Data
          </button>
        </div>
      )}

      {mode === 'signin' && (
        <div className="landing-form">
          <h2>Sign In</h2>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSignIn()}
          />
          {error && <div className="message message-error">{error}</div>}
          <div className="landing-form-actions">
            <button className="btn btn-secondary" onClick={() => { setMode(null); setError(''); }}>Back</button>
            <button className="btn btn-primary" onClick={handleSignIn} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </div>
      )}

      {mode === 'register' && (
        <div className="landing-form">
          <h2>Create Account</h2>
          <div className="user-type-grid">
            {USER_TYPES.map(t => (
              <div
                key={t.value}
                className={`user-type-card ${userType === t.value ? 'selected' : ''}`}
                onClick={() => setUserType(t.value)}
              >
                <span className="user-type-icon">{t.icon}</span>
                <span className="user-type-label">{t.label}</span>
              </div>
            ))}
          </div>
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
          />
          {error && <div className="message message-error">{error}</div>}
          <div className="landing-form-actions">
            <button className="btn btn-secondary" onClick={() => { setMode(null); setError(''); }}>Back</button>
            <button className="btn btn-primary" onClick={handleRegister} disabled={loading || !userType}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
