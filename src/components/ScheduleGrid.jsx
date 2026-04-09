import { useState, useCallback, useRef } from 'react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SLOTS = 48; // 30-min blocks from 12:00 AM to 11:30 PM

function formatSlot(slot) {
  const hours = Math.floor(slot / 2);
  const mins = (slot % 2) * 30;
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${h}:${mins === 0 ? '00' : '30'}${period}`;
}

function formatSlotShort(slot) {
  const hours = Math.floor(slot / 2);
  if (slot % 2 !== 0) return '';
  const period = hours >= 12 ? 'p' : 'a';
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${h}${period}`;
}

export default function ScheduleGrid({
  availabilityBlocks = [],
  jobBlocks = [],
  onSelect,
  onBlockClick,
  mode = 'plumber'
}) {
  const [selecting, setSelecting] = useState(false);
  const [selDay, setSelDay] = useState(null);
  const [selStart, setSelStart] = useState(null);
  const [selEnd, setSelEnd] = useState(null);
  const gridRef = useRef(null);

  const handleMouseDown = useCallback((day, slot) => {
    setSelecting(true);
    setSelDay(day);
    setSelStart(slot);
    setSelEnd(slot);
  }, []);

  const handleMouseEnter = useCallback((day, slot) => {
    if (selecting && day === selDay) {
      setSelEnd(slot);
    }
  }, [selecting, selDay]);

  const handleMouseUp = useCallback(() => {
    if (selecting && selDay !== null && selStart !== null && selEnd !== null) {
      const start = Math.min(selStart, selEnd);
      const end = Math.max(selStart, selEnd) + 1;
      if (onSelect) {
        onSelect(selDay, start, end);
      }
    }
    setSelecting(false);
    setSelDay(null);
    setSelStart(null);
    setSelEnd(null);
  }, [selecting, selDay, selStart, selEnd, onSelect]);

  const isInSelection = (day, slot) => {
    if (!selecting || day !== selDay) return false;
    const start = Math.min(selStart, selEnd);
    const end = Math.max(selStart, selEnd);
    return slot >= start && slot <= end;
  };

  const getAvailBlock = (day, slot) => {
    return availabilityBlocks.find(
      b => b.day_of_week === day && slot >= b.start_slot && slot < b.end_slot
    );
  };

  const getJobBlock = (day, slot) => {
    return jobBlocks.find(
      b => b.day_of_week === day && slot >= b.start_slot && slot < b.end_slot
    );
  };

  const gridCols = `80px repeat(${SLOTS}, minmax(28px, 1fr))`;

  return (
    <div className="schedule-container">
      <div
        ref={gridRef}
        className="schedule-grid"
        style={{ gridTemplateColumns: gridCols }}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { if (selecting) handleMouseUp(); }}
      >
        {/* Header row */}
        <div className="grid-corner">Day / Time</div>
        {Array.from({ length: SLOTS }, (_, i) => (
          <div
            key={`h-${i}`}
            className={`grid-time-header ${i % 2 === 0 ? 'hour-start' : ''}`}
          >
            {formatSlotShort(i)}
          </div>
        ))}

        {/* Day rows */}
        {DAYS.map((dayName, dayIdx) => (
          <div key={dayName} style={{ display: 'contents' }}>
            <div className="grid-day-label">{dayName}</div>
            {Array.from({ length: SLOTS }, (_, slot) => {
              const avail = getAvailBlock(dayIdx, slot);
              const job = getJobBlock(dayIdx, slot);
              const inSel = isInSelection(dayIdx, slot);
              const isFirstOfAvail = avail && slot === avail.start_slot;
              const isFirstOfJob = job && slot === job.start_slot;

              return (
                <div
                  key={`${dayIdx}-${slot}`}
                  className={`grid-cell ${slot % 2 === 0 ? 'hour-start' : ''} ${inSel ? 'selecting' : ''} ${avail ? 'available' : ''} ${job ? 'job-booked' : ''}`}
                  onMouseDown={() => !avail && !job && handleMouseDown(dayIdx, slot)}
                  onMouseEnter={() => handleMouseEnter(dayIdx, slot)}
                >
                  {isFirstOfAvail && (
                    <div
                      className="avail-block"
                      style={{ width: `${(avail.end_slot - avail.start_slot) * 100}%` }}
                      onClick={(e) => { e.stopPropagation(); onBlockClick && onBlockClick(avail); }}
                      title={`$${(avail.hourly_rate / 100).toFixed(2)}/hr | ${avail.num_crews || 1} crew(s) | ${formatSlot(avail.start_slot)} - ${formatSlot(avail.end_slot)}`}
                    >
                      ${(avail.hourly_rate / 100).toFixed(0)}/hr {(avail.num_crews || 1) > 1 ? `(${avail.num_crews}x)` : ''}
                    </div>
                  )}
                  {isFirstOfJob && (
                    <div
                      className="job-block"
                      style={{ width: `${(job.end_slot - job.start_slot) * 100}%` }}
                      title={`${job.location_town}, ${job.location_state} | ${job.plumber_name || 'Unassigned'}`}
                    >
                      {job.location_town}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
