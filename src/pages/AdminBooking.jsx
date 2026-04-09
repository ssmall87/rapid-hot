import { useState, useEffect } from 'react'
import ScheduleGrid from '../components/ScheduleGrid.jsx'

const API = '/api';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function formatSlot(slot) {
  const hours = Math.floor(slot / 2);
  const mins = (slot % 2) * 30;
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${h}:${mins === 0 ? '00' : '30'} ${period}`;
}

// Generate 3-hour time slot options
function getTimeSlots() {
  const slots = [];
  for (let start = 0; start <= 42; start += 2) { // step by 1 hour, last start at 9pm (slot 42)
    const end = start + 6;
    if (end <= 48) {
      slots.push({ start, end, label: `${formatSlot(start)} - ${formatSlot(end)}` });
    }
  }
  return slots;
}

export default function AdminBooking() {
  const [jobs, setJobs] = useState([]);
  const [locations, setLocations] = useState(null);
  const [allAvailability, setAllAvailability] = useState([]);
  const [plumbers, setPlumbers] = useState([]);

  // Booking form
  const [bookDay, setBookDay] = useState('0');
  const [bookSlot, setBookSlot] = useState('');
  const [bookState, setBookState] = useState('MA');
  const [bookTown, setBookTown] = useState('');
  const [townSearch, setTownSearch] = useState('');
  const [message, setMessage] = useState(null);

  const timeSlots = getTimeSlots();

  useEffect(() => {
    fetch(`${API}/jobs`).then(r => r.json()).then(setJobs);
    fetch(`${API}/locations`).then(r => r.json()).then(setLocations);
    fetch(`${API}/plumbers`).then(r => r.json()).then(async (plumbers) => {
      setPlumbers(plumbers);
      // Load all availability for the overview grid
      const allAvail = [];
      for (const p of plumbers) {
        const res = await fetch(`${API}/availability/${p.id}`);
        const avail = await res.json();
        allAvail.push(...avail.map(a => ({ ...a, plumber_name: p.name })));
      }
      setAllAvailability(allAvail);
    });
  }, []);

  const filteredTowns = locations?.towns?.[bookState]?.filter(
    t => t.name.toLowerCase().includes(townSearch.toLowerCase())
  )?.slice(0, 50) || [];

  const handleBook = async () => {
    setMessage(null);
    if (!bookSlot || !bookTown) {
      setMessage({ type: 'error', text: 'Please select a time slot and town' });
      return;
    }
    const slot = timeSlots[parseInt(bookSlot)];
    const res = await fetch(`${API}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day_of_week: parseInt(bookDay),
        start_slot: slot.start,
        end_slot: slot.end,
        location_town: bookTown,
        location_state: bookState
      })
    });
    const result = await res.json();
    if (res.ok) {
      setMessage({ type: 'success', text: result.message });
      // Refresh jobs
      fetch(`${API}/jobs`).then(r => r.json()).then(setJobs);
      setBookTown('');
      setTownSearch('');
    } else {
      setMessage({ type: 'error', text: result.error });
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Admin Job Booking</h2>
      </div>

      <div className="booking-panel">
        <h2>Book a Plumber</h2>
        <div className="booking-form">
          <div className="field">
            <label>Day</label>
            <select value={bookDay} onChange={e => setBookDay(e.target.value)}>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Time Slot (3 hours)</label>
            <select value={bookSlot} onChange={e => setBookSlot(e.target.value)}>
              <option value="">-- Select --</option>
              {timeSlots.map((s, i) => (
                <option key={i} value={i}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>State</label>
            <select value={bookState} onChange={e => { setBookState(e.target.value); setBookTown(''); setTownSearch(''); }}>
              <option value="MA">Massachusetts</option>
              <option value="NH">New Hampshire</option>
            </select>
          </div>

          <div className="field">
            <label>Town</label>
            <input
              type="text"
              placeholder="Search town..."
              value={townSearch}
              onChange={e => { setTownSearch(e.target.value); setBookTown(''); }}
              style={{ width: 200 }}
            />
            {townSearch && !bookTown && filteredTowns.length > 0 && (
              <div style={{
                position: 'absolute',
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                maxHeight: 200,
                overflowY: 'auto',
                zIndex: 10,
                width: 200,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                {filteredTowns.map(t => (
                  <div
                    key={t.name}
                    style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem' }}
                    onClick={() => { setBookTown(t.name); setTownSearch(t.name); }}
                    onMouseEnter={e => e.target.style.background = '#EDF2F7'}
                    onMouseLeave={e => e.target.style.background = 'white'}
                  >
                    {t.name} <span style={{ color: '#a0aec0' }}>({t.county})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="btn btn-primary" onClick={handleBook}>
            Book Cheapest Plumber
          </button>
        </div>

        {message && (
          <div className={`message message-${message.type}`}>{message.text}</div>
        )}
      </div>

      <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: 12 }}>
        Overview of all plumber availability (green) and booked jobs (red):
      </p>
      <ScheduleGrid
        availabilityBlocks={allAvailability}
        jobBlocks={jobs}
        mode="admin"
      />

      {jobs.length > 0 && (
        <div className="jobs-list">
          <h2>Booked Jobs</h2>
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Location</th>
                <th>Plumber</th>
                <th>Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id}>
                  <td>{DAYS[job.day_of_week]}</td>
                  <td>{formatSlot(job.start_slot)} - {formatSlot(job.end_slot)}</td>
                  <td>{job.location_town}, {job.location_state}</td>
                  <td>{job.plumber_name || 'Unassigned'}</td>
                  <td>${((job.hourly_rate || 0) / 100).toFixed(2)}/hr</td>
                  <td>
                    <span className={`status-badge status-${job.status}`}>
                      {job.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
