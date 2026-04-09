import { useState, useEffect, useCallback } from 'react'
import ScheduleGrid from '../components/ScheduleGrid.jsx'
import AvailabilityModal from '../components/AvailabilityModal.jsx'

const API = '/api';

export default function PlumberSchedule({ user }) {
  const [plumberId, setPlumberId] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [locations, setLocations] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  // Look up the plumber record for this user
  useEffect(() => {
    if (!user) return;
    fetch(`${API}/plumbers/by-user/${user.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.id) setPlumberId(data.id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    fetch(`${API}/locations`).then(r => r.json()).then(setLocations);
  }, [user]);

  const loadAvailability = useCallback(() => {
    if (!plumberId) return;
    fetch(`${API}/availability/${plumberId}`)
      .then(r => r.json())
      .then(setAvailability);
  }, [plumberId]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  const handleGridSelect = (day, start, end) => {
    setModalData({ day, startSlot: start, endSlot: end, existingBlock: null });
    setShowModal(true);
  };

  const handleBlockClick = (block) => {
    setModalData({
      day: block.day_of_week,
      startSlot: block.start_slot,
      endSlot: block.end_slot,
      existingBlock: block
    });
    setShowModal(true);
  };

  const handleSave = async (data) => {
    setMessage(null);
    const res = await fetch(`${API}/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, plumber_id: plumberId })
    });
    const result = await res.json();
    if (res.ok) {
      setShowModal(false);
      loadAvailability();
      setMessage({ type: 'success', text: 'Availability saved!' });
    } else {
      setMessage({ type: 'error', text: result.error });
    }
  };

  const handleDelete = async (id) => {
    const res = await fetch(`${API}/availability/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (res.ok) {
      setShowModal(false);
      loadAvailability();
      setMessage({ type: 'success', text: 'Availability removed' });
    } else {
      setMessage({ type: 'error', text: result.error });
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#a0aec0' }}>Loading...</div>;

  if (!plumberId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#a0aec0' }}>
        No plumber profile found for your account. Please contact an admin.
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">My Schedule</h2>
        <span style={{ color: '#718096', fontSize: '0.9rem' }}>Welcome, {user?.name}</span>
      </div>

      {message && (
        <div className={`message message-${message.type}`}>{message.text}</div>
      )}

      <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: 12 }}>
        Click and drag on the grid to add an availability block (minimum 3 hours).
        Set your hourly rate, number of crews, and service areas for each block.
        Click an existing block to edit or delete.
      </p>

      <ScheduleGrid
        availabilityBlocks={availability}
        onSelect={handleGridSelect}
        onBlockClick={handleBlockClick}
      />

      {availability.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>My Availability</h3>
          <table className="jobs-table">
            <thead>
              <tr>
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
      )}

      {showModal && modalData && locations && (
        <AvailabilityModal
          day={modalData.day}
          startSlot={modalData.startSlot}
          endSlot={modalData.endSlot}
          existingBlock={modalData.existingBlock}
          locations={locations}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setShowModal(false)}
        />
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
