import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

const API = '/api';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function formatSlot(slot) {
  const hours = Math.floor(slot / 2);
  const mins = (slot % 2) * 30;
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${h}:${mins === 0 ? '00' : '30'} ${period}`;
}

// Generate 3-hour windows within an availability block
function getWindowsFromSlot(avail) {
  const windows = [];
  for (let start = avail.start_slot; start + 6 <= avail.end_slot; start += 2) {
    windows.push({
      availability_id: avail.availability_id,
      day_of_week: avail.day_of_week,
      start_slot: start,
      end_slot: start + 6,
      hourly_rate: avail.hourly_rate,
      plumber_name: avail.plumber_name,
    });
  }
  return windows;
}

export default function TenantSchedule() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    fetch(`${API}/schedule/${token}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load'); setLoading(false); });
  }, [token]);

  const handleBook = async (window) => {
    setBooking(true);
    setError('');
    const res = await fetch(`${API}/schedule/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day_of_week: window.day_of_week,
        start_slot: window.start_slot,
        end_slot: window.end_slot,
      })
    });
    const result = await res.json();
    if (res.ok) {
      setBooked({ ...result, window });
    } else {
      setError(result.error);
    }
    setBooking(false);
  };

  if (loading) return <div className="landing-page"><p>Loading...</p></div>;

  if (data?.already_scheduled) {
    return (
      <div className="landing-page">
        <div className="landing-hero">
          <svg className="landing-logo" viewBox="0 0 60 60" width="60" height="60">
            <circle cx="30" cy="30" r="29" fill="#48BB78" />
            <path d="M20 30 L27 37 L40 24" stroke="#FFF" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 style={{ fontSize: '1.5rem', marginTop: 12 }}>Already Scheduled</h1>
          <p className="landing-subtitle">This water heater replacement has already been scheduled.</p>
        </div>
      </div>
    );
  }

  if (booked) {
    return (
      <div className="landing-page">
        <div className="landing-hero">
          <svg className="landing-logo" viewBox="0 0 60 60" width="60" height="60">
            <circle cx="30" cy="30" r="29" fill="#48BB78" />
            <path d="M20 30 L27 37 L40 24" stroke="#FFF" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 style={{ fontSize: '1.5rem', marginTop: 12 }}>Scheduled!</h1>
          <p className="landing-subtitle">Your water heater replacement is booked.</p>
        </div>
        <div className="booking-panel" style={{ maxWidth: 500, margin: '20px auto' }}>
          <table className="jobs-table">
            <tbody>
              <tr><td><strong>Day</strong></td><td>{DAYS[booked.window.day_of_week]}</td></tr>
              <tr><td><strong>Time</strong></td><td>{formatSlot(booked.window.start_slot)} - {formatSlot(booked.window.end_slot)}</td></tr>
              <tr><td><strong>Plumber</strong></td><td>{booked.plumber_name}</td></tr>
              <tr><td><strong>Rate</strong></td><td>${(booked.hourly_rate / 100).toFixed(2)}/hr</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const request = data?.request;
  const slots = data?.available_slots || [];

  // Generate all possible 3-hour windows from available slots
  const allWindows = slots.flatMap(getWindowsFromSlot);

  // Group by day
  const byDay = {};
  for (const w of allWindows) {
    if (!byDay[w.day_of_week]) byDay[w.day_of_week] = [];
    byDay[w.day_of_week].push(w);
  }

  return (
    <div className="landing-page" style={{ paddingBottom: 40 }}>
      <div className="landing-hero" style={{ marginBottom: 20 }}>
        <svg className="landing-logo" viewBox="0 0 60 60" width="60" height="60">
          <circle cx="30" cy="30" r="29" fill="#E53E3E" />
          <path d="M30 12 C30 12, 21 21, 21 30 C21 35 25 39 30 39 C35 39 39 35 39 30 C39 21 30 12 30 12Z" fill="#FFF" />
          <rect x="27" y="36" width="6" height="12" rx="2" fill="#FFF" />
          <circle cx="30" cy="27" r="3" fill="#E53E3E" />
        </svg>
        <h1 style={{ fontSize: '1.3rem', marginTop: 12 }}>Schedule Your Water Heater Replacement</h1>
        {request && (
          <p className="landing-subtitle">
            {request.address}{request.unit_number ? ` Unit ${request.unit_number}` : ''}, {request.city}, {request.state}
          </p>
        )}
      </div>

      {error && <div className="message message-error" style={{ maxWidth: 500, margin: '0 auto 16px' }}>{error}</div>}

      {allWindows.length > 0 ? (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', color: '#718096', marginBottom: 16, fontSize: '0.9rem' }}>
            Select a 3-hour time slot for your installation:
          </p>
          {Object.entries(byDay).map(([day, windows]) => (
            <div key={day} style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 8, color: '#2D3748' }}>{DAYS[day]}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {windows.map((w, i) => (
                  <button
                    key={i}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem' }}
                    onClick={() => handleBook(w)}
                    disabled={booking}
                  >
                    {formatSlot(w.start_slot)} - {formatSlot(w.end_slot)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#a0aec0' }}>
          No available time slots at this time. Please check back later.
        </div>
      )}
    </div>
  );
}
