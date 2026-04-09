import { useState, useMemo } from 'react'

export default function LocationPicker({ locations, selectedAreas, onChange }) {
  const [search, setSearch] = useState('');
  const [expandedGroup, setExpandedGroup] = useState(null);

  const toggleArea = (area) => {
    const key = `${area.area_type}:${area.area_name}:${area.state}`;
    const exists = selectedAreas.find(
      a => `${a.area_type}:${a.area_name}:${a.state}` === key
    );
    if (exists) {
      onChange(selectedAreas.filter(
        a => `${a.area_type}:${a.area_name}:${a.state}` !== key
      ));
    } else {
      onChange([...selectedAreas, area]);
    }
  };

  const isSelected = (area) => {
    return selectedAreas.some(
      a => a.area_type === area.area_type && a.area_name === area.area_name && a.state === area.state
    );
  };

  const filteredLocations = useMemo(() => {
    if (!locations) return [];
    const items = [];
    const q = search.toLowerCase();

    // States
    for (const state of locations.states || []) {
      if (!q || state.toLowerCase().includes(q)) {
        items.push({ group: 'States', area_type: 'state', area_name: state, state, label: state });
      }
    }

    // Counties
    for (const [state, counties] of Object.entries(locations.counties || {})) {
      for (const county of counties) {
        if (!q || county.toLowerCase().includes(q) || state.toLowerCase().includes(q)) {
          items.push({ group: `${state} Counties`, area_type: 'county', area_name: county, state, label: `${county} County, ${state}` });
        }
      }
    }

    // Towns (only show when searching to avoid overwhelming the list)
    if (q.length >= 2) {
      for (const [state, towns] of Object.entries(locations.towns || {})) {
        for (const town of towns) {
          if (town.name.toLowerCase().includes(q)) {
            items.push({ group: `${state} Towns`, area_type: 'town', area_name: town.name, state, label: `${town.name}, ${state}` });
          }
        }
      }
    }

    return items;
  }, [locations, search]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const item of filteredLocations) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    }
    return groups;
  }, [filteredLocations]);

  return (
    <div>
      <input
        type="text"
        className="location-search"
        placeholder="Search towns, counties, or states... (type 2+ chars for towns)"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {selectedAreas.length > 0 && (
        <div className="selected-areas">
          {selectedAreas.map((a, i) => (
            <span key={i} className="area-tag">
              {a.area_name}{a.area_type !== 'state' ? `, ${a.state}` : ''}
              <button onClick={() => toggleArea(a)}>&times;</button>
            </span>
          ))}
        </div>
      )}

      <div className="location-picker" style={{ marginTop: 8 }}>
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="location-group">
            <div
              className="location-group-header"
              style={{ cursor: 'pointer' }}
              onClick={() => setExpandedGroup(expandedGroup === group ? null : group)}
            >
              {group} ({items.length}) {expandedGroup === group ? '−' : '+'}
            </div>
            {expandedGroup === group && items.map((item, i) => (
              <label key={i} className="location-item">
                <input
                  type="checkbox"
                  checked={isSelected(item)}
                  onChange={() => toggleArea(item)}
                />
                {item.label}
              </label>
            ))}
          </div>
        ))}
        {filteredLocations.length === 0 && (
          <div style={{ padding: 12, color: '#a0aec0', fontSize: '0.85rem' }}>
            {search.length < 2 ? 'Type 2+ characters to search towns' : 'No results found'}
          </div>
        )}
      </div>
    </div>
  );
}
