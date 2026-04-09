import { useState } from 'react'
import LocationPicker from './LocationPicker.jsx'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function formatSlot(slot) {
  const hours = Math.floor(slot / 2);
  const mins = (slot % 2) * 30;
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${h}:${mins === 0 ? '00' : '30'} ${period}`;
}

export default function AvailabilityModal({
  day,
  startSlot,
  endSlot,
  existingBlock,
  locations,
  onSave,
  onDelete,
  onClose
}) {
  const [hourlyRate, setHourlyRate] = useState(
    existingBlock ? (existingBlock.hourly_rate / 100).toFixed(2) : '75.00'
  );
  const [numCrews, setNumCrews] = useState(
    existingBlock?.num_crews?.toString() || '1'
  );
  const [serviceAreas, setServiceAreas] = useState(
    existingBlock?.service_areas || []
  );
  const [error, setError] = useState('');

  const slotCount = endSlot - startSlot;
  const hours = slotCount / 2;

  const handleSave = () => {
    setError('');
    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate <= 0) {
      setError('Please enter a valid hourly rate');
      return;
    }
    if (serviceAreas.length === 0) {
      setError('Please select at least one service area');
      return;
    }
    if (slotCount < 6) {
      setError('Block must be at least 3 hours');
      return;
    }
    onSave({
      day_of_week: day,
      start_slot: startSlot,
      end_slot: endSlot,
      hourly_rate: Math.round(rate * 100),
      num_crews: Math.max(1, parseInt(numCrews) || 1),
      service_areas: serviceAreas
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{existingBlock ? 'Edit Availability' : 'Set Availability'}</h2>

        <div className="modal-field">
          <label>Day & Time</label>
          <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>
            {DAYS[day]}: {formatSlot(startSlot)} &ndash; {formatSlot(endSlot)}
            <span style={{ color: '#718096', marginLeft: 8 }}>({hours} hours)</span>
          </div>
          {slotCount < 6 && (
            <div style={{ color: '#E53E3E', fontSize: '0.8rem', marginTop: 4 }}>
              Minimum 3 hours required. Please select a larger block.
            </div>
          )}
        </div>

        <div className="modal-field">
          <label>Hourly Rate ($)</label>
          <input
            type="number"
            step="0.50"
            min="1"
            value={hourlyRate}
            onChange={e => setHourlyRate(e.target.value)}
            placeholder="75.00"
          />
          <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: 4 }}>
            Total for this block: ${(parseFloat(hourlyRate || 0) * hours).toFixed(2)}
          </div>
        </div>

        <div className="modal-field">
          <label>Number of Crews Available</label>
          <input
            type="number"
            min="1"
            max="20"
            value={numCrews}
            onChange={e => setNumCrews(e.target.value)}
            placeholder="1"
          />
          <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: 4 }}>
            How many crews can work simultaneously during this time block
          </div>
        </div>

        <div className="modal-field">
          <label>Service Areas</label>
          <LocationPicker
            locations={locations}
            selectedAreas={serviceAreas}
            onChange={setServiceAreas}
          />
        </div>

        {error && (
          <div className="message message-error">{error}</div>
        )}

        <div className="modal-actions">
          {existingBlock && (
            <button className="btn btn-danger" onClick={() => onDelete(existingBlock.id)}>
              Delete
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={slotCount < 6}>
            {existingBlock ? 'Update' : 'Save Availability'}
          </button>
        </div>
      </div>
    </div>
  );
}
