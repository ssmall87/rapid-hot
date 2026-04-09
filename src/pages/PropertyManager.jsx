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

export default function PropertyManager({ user }) {
  const [units, setUnits] = useState([]);
  const [requests, setRequests] = useState([]);
  const [locations, setLocations] = useState(null);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [message, setMessage] = useState(null);

  // Add unit form
  const [address, setAddress] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [city, setCity] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [state, setState] = useState('MA');

  // Request form
  const [selectedUnit, setSelectedUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [emailPreview, setEmailPreview] = useState(null);

  useEffect(() => {
    fetch(`${API}/pm/units/${user.id}`).then(r => r.json()).then(setUnits);
    fetch(`${API}/pm/requests/${user.id}`).then(r => r.json()).then(setRequests);
    fetch(`${API}/locations`).then(r => r.json()).then(setLocations);
  }, [user.id]);

  const filteredTowns = locations?.towns?.[state]?.filter(
    t => t.name.toLowerCase().includes(citySearch.toLowerCase())
  )?.slice(0, 30) || [];

  const handleAddUnit = async () => {
    if (!address || !tenantName || !tenantEmail || !city) {
      setMessage({ type: 'error', text: 'Fill in all required fields' }); return;
    }
    const res = await fetch(`${API}/pm/units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_id: user.id, address, unit_number: unitNumber, tenant_name: tenantName, tenant_email: tenantEmail, city, state })
    });
    const data = await res.json();
    if (res.ok) {
      setUnits(prev => [...prev, data]);
      setAddress(''); setUnitNumber(''); setTenantName(''); setTenantEmail(''); setCity(''); setCitySearch('');
      setShowAddUnit(false);
      setMessage({ type: 'success', text: 'Unit added' });
    } else {
      setMessage({ type: 'error', text: data.error });
    }
  };

  const handleDeleteUnit = async (id) => {
    await fetch(`${API}/pm/units/${id}`, { method: 'DELETE' });
    setUnits(prev => prev.filter(u => u.id !== id));
  };

  const handleRequest = async () => {
    if (!selectedUnit) { setMessage({ type: 'error', text: 'Select a unit' }); return; }
    const res = await fetch(`${API}/pm/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pm_unit_id: parseInt(selectedUnit), manager_id: user.id, notes })
    });
    const data = await res.json();
    if (res.ok) {
      setEmailPreview(data);
      setNotes('');
      setSelectedUnit('');
      fetch(`${API}/pm/requests/${user.id}`).then(r => r.json()).then(setRequests);
      setMessage({ type: 'success', text: 'Service request created! Scheduling email simulated.' });
    } else {
      setMessage({ type: 'error', text: data.error });
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Property Manager Dashboard</h2>
        <span style={{ color: '#718096', fontSize: '0.9rem' }}>Welcome, {user.name}</span>
      </div>

      {message && <div className={`message message-${message.type}`}>{message.text}</div>}

      {/* My Units */}
      <div className="booking-panel" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2>My Units</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddUnit(!showAddUnit)}>
            + Add Unit
          </button>
        </div>

        {showAddUnit && (
          <div style={{ background: '#f7f8fa', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <div className="booking-form">
              <div className="field">
                <label>Address *</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St" style={{ width: 200 }} />
              </div>
              <div className="field">
                <label>Unit #</label>
                <input value={unitNumber} onChange={e => setUnitNumber(e.target.value)} placeholder="3A" style={{ width: 80 }} />
              </div>
              <div className="field">
                <label>Tenant Name *</label>
                <input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="John Doe" style={{ width: 160 }} />
              </div>
              <div className="field">
                <label>Tenant Email *</label>
                <input value={tenantEmail} onChange={e => setTenantEmail(e.target.value)} placeholder="john@email.com" style={{ width: 180 }} />
              </div>
              <div className="field">
                <label>State</label>
                <select value={state} onChange={e => { setState(e.target.value); setCity(''); setCitySearch(''); }}>
                  <option value="MA">MA</option>
                  <option value="NH">NH</option>
                </select>
              </div>
              <div className="field" style={{ position: 'relative' }}>
                <label>City *</label>
                <input value={citySearch} onChange={e => { setCitySearch(e.target.value); }} placeholder="Search city..." style={{ width: 160 }} />
                {citySearch && citySearch !== city && filteredTowns.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, maxHeight: 150, overflowY: 'auto', zIndex: 10, width: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
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
              <button className="btn btn-primary btn-sm" onClick={handleAddUnit} style={{ alignSelf: 'flex-end' }}>Save Unit</button>
            </div>
          </div>
        )}

        {units.length > 0 ? (
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>Unit</th>
                <th>Tenant</th>
                <th>Email</th>
                <th>City</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {units.map(u => (
                <tr key={u.id}>
                  <td>{u.address}</td>
                  <td>{u.unit_number || '—'}</td>
                  <td>{u.tenant_name}</td>
                  <td>{u.tenant_email}</td>
                  <td>{u.city}, {u.state}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteUnit(u.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ color: '#a0aec0', textAlign: 'center', padding: 20 }}>No units added yet</div>
        )}
      </div>

      {/* Request Service */}
      <div className="booking-panel" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 12 }}>Request Water Heater Replacement</h2>
        <div className="booking-form">
          <div className="field">
            <label>Select Unit</label>
            <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)} style={{ minWidth: 250 }}>
              <option value="">-- Select Unit --</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>
                  {u.address}{u.unit_number ? ` #${u.unit_number}` : ''} — {u.tenant_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. 40 gallon electric" style={{ width: 250 }} />
          </div>
          <button className="btn btn-primary" onClick={handleRequest} style={{ alignSelf: 'flex-end' }}>
            Request Replacement
          </button>
        </div>

        {emailPreview && (
          <div style={{ marginTop: 16, background: '#EBF8FF', border: '1px solid #BEE3F8', borderRadius: 8, padding: 16 }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: 8 }}>Simulated Email Sent</h3>
            <div style={{ fontSize: '0.85rem', color: '#2D3748' }}>
              <p><strong>To:</strong> {emailPreview.simulated_email.to}</p>
              <p><strong>Subject:</strong> {emailPreview.simulated_email.subject}</p>
              <pre style={{ whiteSpace: 'pre-wrap', background: 'white', padding: 12, borderRadius: 6, marginTop: 8, fontSize: '0.8rem' }}>
                {emailPreview.simulated_email.body}
              </pre>
              <p style={{ marginTop: 8 }}>
                <strong>Scheduling Link:</strong>{' '}
                <a href={emailPreview.scheduling_url} style={{ color: '#E53E3E' }}>
                  {window.location.origin}{emailPreview.scheduling_url}
                </a>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Requests History */}
      <div className="booking-panel">
        <h2 style={{ marginBottom: 12 }}>Service Requests</h2>
        {requests.length > 0 ? (
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>Tenant</th>
                <th>Status</th>
                <th>Scheduled</th>
                <th>Plumber</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  <td>{r.address}{r.unit_number ? ` #${r.unit_number}` : ''}</td>
                  <td>{r.tenant_name}</td>
                  <td>
                    <span className={`status-badge ${r.status === 'scheduled' ? 'status-assigned' : 'status-pending'}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{r.job_day !== null && r.job_day !== undefined ? `${DAYS[r.job_day]} ${formatSlot(r.job_start)}-${formatSlot(r.job_end)}` : '—'}</td>
                  <td>{r.plumber_name || '—'}</td>
                  <td>{r.job_rate ? `$${(r.job_rate / 100).toFixed(2)}/hr` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ color: '#a0aec0', textAlign: 'center', padding: 20 }}>No service requests yet</div>
        )}
      </div>
    </div>
  );
}
