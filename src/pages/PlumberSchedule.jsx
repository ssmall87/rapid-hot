import { useState, useEffect, useCallback } from 'react'
import ScheduleGrid from '../components/ScheduleGrid.jsx'

const API = '/api';

export default function PlumberSchedule() {
  const [locations, setLocations] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [selectedState, setSelectedState] = useState('MA');
  const [townSearch, setTownSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null); // { area_type, area_name, state }
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetch(`${API}/locations`).then(r => r.json()).then(setLocations);
  }, []);

  const loadAvailability = useCallback(() => {
    if (!selectedLocation) { setAvailability([]); return; }
    const params = new URLSearchParams(selectedLocation);
    fetch(`${API}/availability/by-location?${params}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAvailability(data);
        else setAvailability([]);
      });
  }, [selectedLocation]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  const filteredTowns = locations?.towns?.[selectedState]?.filter(
    t => t.name.toLowerCase().includes(townSearch.toLowerCase())
  )?.slice(0, 50) || [];

  const filteredCounties = locations?.counties?.[selectedState] || [];

  const handleSelectTown = (townName) => {
    setSelectedLocation({ area_type: 'town', area_name: townName, state: selectedState });
    setTownSearch(townName);
  };

  const handleSelectCounty = (countyName) => {
    setSelectedLocation({ area_type: 'county', area_name: countyName, state: selectedState });
    setTownSearch('');
  };

  const handleSelectState = () => {
    setSelectedLocation({ area_type: 'state', area_name: selectedState, state: selectedState });
    setTownSearch('');
  };

  const locationLabel = selectedLocation
    ? selectedLocation.area_type === 'state'
      ? selectedLocation.state
      : selectedLocation.area_type === 'county'
        ? `${selectedLocation.area_name} County, ${selectedLocation.state}`
        : `${selectedLocation.area_name}, ${selectedLocation.state}`
    : null;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Plumber Availability by Location</h2>
      </div>

      <div className="booking-panel">
        <h2>Select Location</h2>
        <div className="booking-form">
          <div className="field">
            <label>State</label>
            <select value={selectedState} onChange={e => { setSelectedState(e.target.value); setSelectedLocation(null); setTownSearch(''); }}>
              <option value="MA">Massachusetts</option>
              <option value="NH">New Hampshire</option>
            </select>
          </div>

          <div className="field" style={{ position: 'relative' }}>
            <label>Town</label>
            <input
              type="text"
              placeholder="Search town..."
              value={townSearch}
              onChange={e => { setTownSearch(e.target.value); }}
              style={{ width: 220 }}
            />
            {townSearch && townSearch !== selectedLocation?.area_name && filteredTowns.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                maxHeight: 200,
                overflowY: 'auto',
                zIndex: 10,
                width: 220,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                {filteredTowns.map(t => (
                  <div
                    key={t.name}
                    style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem' }}
                    onClick={() => handleSelectTown(t.name)}
                    onMouseEnter={e => e.target.style.background = '#EDF2F7'}
                    onMouseLeave={e => e.target.style.background = 'white'}
                  >
                    {t.name} <span style={{ color: '#a0aec0' }}>({t.county})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="field">
            <label>Or County</label>
            <select onChange={e => { if (e.target.value) handleSelectCounty(e.target.value); }} value={selectedLocation?.area_type === 'county' ? selectedLocation.area_name : ''}>
              <option value="">-- Select County --</option>
              {filteredCounties.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Or Entire State</label>
            <button className="btn btn-secondary" onClick={handleSelectState}>
              All of {selectedState}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className={`message message-${message.type}`}>{message.text}</div>
      )}

      {selectedLocation ? (
        <>
          <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: 12 }}>
            Showing all plumber availability in <strong>{locationLabel}</strong> — sorted by lowest rate:
          </p>
          {availability.length > 0 ? (
            <>
              <ScheduleGrid
                availabilityBlocks={availability}
                mode="view"
              />
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>Available Plumbers</h3>
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th>Plumber</th>
                      <th>Day</th>
                      <th>Time</th>
                      <th>Rate</th>
                      <th>Crews</th>
                      <th>Service Areas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availability.map(a => (
                      <tr key={a.id}>
                        <td>{a.plumber_name}</td>
                        <td>{['Monday','Tuesday','Wednesday','Thursday','Friday'][a.day_of_week]}</td>
                        <td>{formatSlot(a.start_slot)} - {formatSlot(a.end_slot)}</td>
                        <td>${(a.hourly_rate / 100).toFixed(2)}/hr</td>
                        <td>{a.num_crews || 1}</td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {a.service_areas?.map(sa =>
                            sa.area_type === 'state' ? sa.state : `${sa.area_name}, ${sa.state}`
                          ).join('; ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#a0aec0' }}>
              No plumbers currently available in {locationLabel}
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 60, color: '#a0aec0' }}>
          Select a location to see available plumbers
        </div>
      )}
    </div>
  );
}

function formatSlot(slot) {
  const hours = Math.floor(slot / 2);
  const mins = (slot % 2) * 30;
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${h}:${mins === 0 ? '00' : '30'} ${period}`;
}
