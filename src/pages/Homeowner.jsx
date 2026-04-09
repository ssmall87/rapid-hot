import { useState, useEffect } from 'react'

const API = '/api';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function formatSlot(slot) {
  const hours = Math.floor(slot / 2);
  const mins = (slot % 2) * 30;
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${h}:${mins === 0 ? '00' : '30'} ${period}`;
}

function getWindowsFromSlot(avail) {
  const windows = [];
  for (let start = avail.start_slot; start + 6 <= avail.end_slot; start += 2) {
    windows.push({
      day_of_week: avail.day_of_week,
      start_slot: start,
      end_slot: start + 6,
      hourly_rate: avail.hourly_rate,
      plumber_name: avail.plumber_name,
    });
  }
  return windows;
}

export default function Homeowner({ user }) {
  const [locations, setLocations] = useState(null);
  const [state, setState] = useState('MA');
  const [citySearch, setCitySearch] = useState('');
  const [city, setCity] = useState('');
  const [availability, setAvailability] = useState([]);
  const [message, setMessage] = useState(null);
  const [booked, setBooked] = useState(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    fetch(`${API}/locations`).then(r => r.json()).then(setLocations);
  }, []);

  const filteredTowns = locations?.towns?.[state]?.filter(
    t => t.name.toLowerCase().includes(citySearch.toLowerCase())
  )?.slice(0, 30) || [];

  const handleSearch = async () => {
    if (!city) { setMessage({ type: 'error', text: 'Select a city' }); return; }
    const params = new URLSearchParams({ area_type: 'town', area_name: city, state });
    const res = await fetch(`${API}/availability/by-location?${params}`);
    const data = await res.json();
    setAvailability(Array.isArray(data) ? data : []);
    if (Array.isArray(data) && data.length === 0) {
      setMessage({ type: 'error', text: 'No plumbers available in this area right now' });
    } else {
      setMessage(null);
    }
  };

  const handleBook = async (window) => {
    setBooking(true);
    setMessage(null);
    const res = await fetch(`${API}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day_of_week: window.day_of_week,
        start_slot: window.start_slot,
        end_slot: window.end_slot,
        location_town: city,
        location_state: state,
      })
    });
    const result = await res.json();
    if (res.ok) {
      setBooked({ ...result, window });
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    setBooking(false);
  };

  if (booked) {
    return (
      <div>
        <div className="page-header"><h2 className="page-title">Booking Confirmed!</h2></div>
        <div className="booking-panel" style={{ maxWidth: 500 }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <svg viewBox="0 0 60 60" width="60" height="60">
              <circle cx="30" cy="30" r="29" fill="#48BB78" />
              <path d="M20 30 L27 37 L40 24" stroke="#FFF" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <table className="jobs-table">
            <tbody>
              <tr><td><strong>Location</strong></td><td>{city}, {state}</td></tr>
              <tr><td><strong>Day</strong></td><td>{DAYS[booked.window.day_of_week]}</td></tr>
              <tr><td><strong>Time</strong></td><td>{formatSlot(booked.window.start_slot)} - {formatSlot(booked.window.end_slot)}</td></tr>
              <tr><td><strong>Plumber</strong></td><td>{booked.assigned_plumber}</td></tr>
              <tr><td><strong>Rate</strong></td><td>${(booked.hourly_rate / 100).toFixed(2)}/hr</td></tr>
            </tbody>
          </table>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => { setBooked(null); setAvailability([]); }}>
              Book Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allWindows = availability.flatMap(getWindowsFromSlot);
  const byDay = {};
  for (const w of allWindows) {
    if (!byDay[w.day_of_week]) byDay[w.day_of_week] = [];
    byDay[w.day_of_week].push(w);
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Book a Water Heater Replacement</h2>
        <span style={{ color: '#718096', fontSize: '0.9rem' }}>Welcome, {user.name}</span>
      </div>

      <div className="booking-panel" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 12 }}>Your Location</h2>
        <div className="booking-form">
          <div className="field">
            <label>State</label>
            <select value={state} onChange={e => { setState(e.target.value); setCity(''); setCitySearch(''); setAvailability([]); }}>
              <option value="MA">Massachusetts</option>
              <option value="NH">New Hampshire</option>
            </select>
          </div>
          <div className="field" style={{ position: 'relative' }}>
            <label>City / Town</label>
            <input value={citySearch} onChange={e => setCitySearch(e.target.value)} placeholder="Search..." style={{ width: 200 }} />
            {citySearch && citySearch !== city && filteredTowns.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, maxHeight: 180, overflowY: 'auto', zIndex: 10, width: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                {filteredTowns.map(t => (
                  <div key={t.name} style={{ padding: '5px 10px', cursor: 'pointer', fontSize: '0.85rem' }}
                    onClick={() => { setCity(t.name); setCitySearch(t.name); }}
                    onMouseEnter={e => e.target.style.background = '#EDF2F7'}
                    onMouseLeave={e => e.target.style.background = 'white'}>
                    {t.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={handleSearch} style={{ alignSelf: 'flex-end' }}>
            Find Available Times
          </button>
        </div>
      </div>

      {message && <div className={`message message-${message.type}`}>{message.text}</div>}

      {allWindows.length > 0 && (
        <div className="booking-panel">
          <h2 style={{ marginBottom: 12 }}>Available Time Slots in {city}, {state}</h2>
          <p style={{ color: '#718096', marginBottom: 16, fontSize: '0.85rem' }}>
            Select a 3-hour window for your installation:
          </p>
          {Object.entries(byDay).map(([day, windows]) => (
            <div key={day} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: 8, color: '#2D3748' }}>{DAYS[day]}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {windows.map((w, i) => (
                  <button key={i} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}
                    onClick={() => handleBook(w)} disabled={booking}>
                    {formatSlot(w.start_slot)} - {formatSlot(w.end_slot)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
