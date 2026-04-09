import { Router } from 'express';
import db from './db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

const locations = JSON.parse(
  readFileSync(join(__dirname, 'data', 'locations.json'), 'utf-8')
);

// --- Plumber CRUD ---

router.get('/plumbers', (req, res) => {
  const plumbers = db.prepare('SELECT * FROM plumbers ORDER BY name').all();
  res.json(plumbers);
});

router.post('/plumbers', (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  try {
    const result = db.prepare('INSERT INTO plumbers (name, email) VALUES (?, ?)').run(name, email);
    res.json({ id: result.lastInsertRowid, name, email });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    throw e;
  }
});

// --- Locations ---

router.get('/locations', (req, res) => {
  res.json(locations);
});

// --- Availability ---

function slotToTime(slot) {
  const hours = Math.floor(slot / 2);
  const mins = (slot % 2) * 30;
  return { hours, mins };
}

function getSlotDatetime(dayOfWeek, slot) {
  const now = new Date();
  const currentDay = now.getDay();
  // Convert: 0=Mon..4=Fri in our system, JS Date: 0=Sun..6=Sat
  const targetJsDay = dayOfWeek + 1; // Mon=1..Fri=5
  let daysAhead = targetJsDay - currentDay;
  if (daysAhead < 0) daysAhead += 7;
  if (daysAhead === 0) {
    // same day
  }
  const target = new Date(now);
  target.setDate(now.getDate() + daysAhead);
  const { hours, mins } = slotToTime(slot);
  target.setHours(hours, mins, 0, 0);
  return target;
}

function checkLeadTime(dayOfWeek, startSlot) {
  const slotTime = getSlotDatetime(dayOfWeek, startSlot);
  const now = new Date();
  const diffMs = slotTime - now;
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours >= 2;
}

// Get all availability for a specific location (town, county, or state)
router.get('/availability/by-location', (req, res) => {
  const { area_type, area_name, state } = req.query;
  if (!area_type || !area_name || !state) {
    return res.status(400).json({ error: 'area_type, area_name, and state required' });
  }

  let conditions;
  let params;

  if (area_type === 'town') {
    const townData = locations.towns[state]?.find(
      t => t.name.toLowerCase() === area_name.toLowerCase()
    );
    const county = townData?.county || '';
    conditions = `
      (sa.area_type = 'town' AND LOWER(sa.area_name) = LOWER(?) AND sa.state = ?)
      OR (sa.area_type = 'county' AND LOWER(sa.area_name) = LOWER(?) AND sa.state = ?)
      OR (sa.area_type = 'state' AND sa.state = ?)
    `;
    params = [area_name, state, county, state, state];
  } else if (area_type === 'county') {
    conditions = `
      (sa.area_type = 'county' AND LOWER(sa.area_name) = LOWER(?) AND sa.state = ?)
      OR (sa.area_type = 'state' AND sa.state = ?)
    `;
    params = [area_name, state, state];
  } else {
    conditions = `sa.area_type = 'state' AND sa.state = ?`;
    params = [state];
  }

  const rows = db.prepare(`
    SELECT a.*, p.name as plumber_name, p.email as plumber_email,
      json_group_array(json_object(
        'id', sa.id, 'area_type', sa.area_type, 'area_name', sa.area_name, 'state', sa.state
      )) as service_areas
    FROM plumber_availability a
    JOIN plumbers p ON p.id = a.plumber_id
    JOIN plumber_service_areas sa ON sa.availability_id = a.id
    WHERE (${conditions})
    GROUP BY a.id
    ORDER BY a.hourly_rate ASC, a.day_of_week, a.start_slot
  `).all(...params);

  const availability = rows.map(r => ({
    ...r,
    service_areas: JSON.parse(r.service_areas).filter(sa => sa.id !== null)
  }));
  res.json(availability);
});

router.get('/availability/:plumberId', (req, res) => {
  const { plumberId } = req.params;
  const rows = db.prepare(`
    SELECT a.*, json_group_array(json_object(
      'id', sa.id, 'area_type', sa.area_type, 'area_name', sa.area_name, 'state', sa.state
    )) as service_areas
    FROM plumber_availability a
    LEFT JOIN plumber_service_areas sa ON sa.availability_id = a.id
    WHERE a.plumber_id = ?
    GROUP BY a.id
    ORDER BY a.day_of_week, a.start_slot
  `).all(plumberId);

  const availability = rows.map(r => ({
    ...r,
    service_areas: JSON.parse(r.service_areas).filter(sa => sa.id !== null)
  }));
  res.json(availability);
});

router.post('/availability', (req, res) => {
  const { plumber_id, day_of_week, start_slot, end_slot, hourly_rate, num_crews, service_areas } = req.body;

  if (day_of_week < 0 || day_of_week > 4) {
    return res.status(400).json({ error: 'Day must be Monday (0) through Friday (4)' });
  }
  if ((end_slot - start_slot) < 6) {
    return res.status(400).json({ error: 'Availability blocks must be at least 3 hours (6 slots)' });
  }
  if (!hourly_rate || hourly_rate <= 0) {
    return res.status(400).json({ error: 'Hourly rate must be positive' });
  }
  if (!service_areas || service_areas.length === 0) {
    return res.status(400).json({ error: 'At least one service area required' });
  }

  // Check for overlapping availability
  const overlaps = db.prepare(`
    SELECT id FROM plumber_availability
    WHERE plumber_id = ? AND day_of_week = ?
    AND start_slot < ? AND end_slot > ?
  `).all(plumber_id, day_of_week, end_slot, start_slot);

  if (overlaps.length > 0) {
    return res.status(409).json({ error: 'Overlaps with existing availability block' });
  }

  const crewCount = Math.max(1, parseInt(num_crews) || 1);

  const insertAvail = db.prepare(`
    INSERT INTO plumber_availability (plumber_id, day_of_week, start_slot, end_slot, hourly_rate, num_crews)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertArea = db.prepare(`
    INSERT INTO plumber_service_areas (availability_id, area_type, area_name, state)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    const result = insertAvail.run(plumber_id, day_of_week, start_slot, end_slot, hourly_rate, crewCount);
    const availId = result.lastInsertRowid;
    for (const area of service_areas) {
      insertArea.run(availId, area.area_type, area.area_name, area.state);
    }
    return availId;
  });

  try {
    const availId = transaction();
    res.json({ id: availId, message: 'Availability created' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/availability/:id', (req, res) => {
  const { id } = req.params;
  const avail = db.prepare('SELECT * FROM plumber_availability WHERE id = ?').get(id);
  if (!avail) return res.status(404).json({ error: 'Not found' });

  if (!checkLeadTime(avail.day_of_week, avail.start_slot)) {
    return res.status(400).json({ error: 'Cannot modify availability within 2 hours of start time' });
  }

  db.prepare('DELETE FROM plumber_availability WHERE id = ?').run(id);
  res.json({ message: 'Deleted' });
});

// --- Jobs ---

router.get('/jobs', (req, res) => {
  const jobs = db.prepare(`
    SELECT j.*, p.name as plumber_name, p.email as plumber_email
    FROM jobs j
    LEFT JOIN plumbers p ON p.id = j.assigned_plumber_id
    ORDER BY j.day_of_week, j.start_slot
  `).all();
  res.json(jobs);
});

router.post('/jobs', (req, res) => {
  const { day_of_week, start_slot, end_slot, location_town, location_state } = req.body;

  if (day_of_week < 0 || day_of_week > 4) {
    return res.status(400).json({ error: 'Day must be Monday (0) through Friday (4)' });
  }
  if ((end_slot - start_slot) !== 6) {
    return res.status(400).json({ error: 'Jobs must be exactly 3 hours (6 slots)' });
  }
  if (!location_town || !location_state) {
    return res.status(400).json({ error: 'Location required' });
  }

  // Find the town's county
  const townData = locations.towns[location_state]?.find(
    t => t.name.toLowerCase() === location_town.toLowerCase()
  );
  const county = townData?.county || null;

  // Find available plumbers: match by town, county, or state
  // Also check that the plumber has remaining crew capacity for this time slot
  const candidates = db.prepare(`
    SELECT a.id as availability_id, a.plumber_id, a.hourly_rate, a.num_crews, p.name as plumber_name,
      (SELECT COUNT(*) FROM jobs j
       WHERE j.availability_id = a.id
       AND j.status IN ('assigned', 'pending')
       AND j.start_slot < ? AND j.end_slot > ?
      ) as booked_crews
    FROM plumber_availability a
    JOIN plumbers p ON p.id = a.plumber_id
    JOIN plumber_service_areas sa ON sa.availability_id = a.id
    WHERE a.day_of_week = ?
      AND a.start_slot <= ?
      AND a.end_slot >= ?
      AND (
        (sa.area_type = 'town' AND LOWER(sa.area_name) = LOWER(?) AND sa.state = ?)
        OR (sa.area_type = 'county' AND LOWER(sa.area_name) = LOWER(?) AND sa.state = ?)
        OR (sa.area_type = 'state' AND sa.state = ?)
      )
    GROUP BY a.id
    HAVING booked_crews < a.num_crews
    ORDER BY a.hourly_rate ASC
    LIMIT 1
  `).get(end_slot, start_slot, day_of_week, start_slot, end_slot, location_town, location_state, county || '', location_state, location_state);

  if (!candidates) {
    return res.status(404).json({ error: 'No plumbers available for this time and location (all crews booked)' });
  }

  const result = db.prepare(`
    INSERT INTO jobs (day_of_week, start_slot, end_slot, location_town, location_county, location_state, assigned_plumber_id, hourly_rate, status, availability_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'assigned', ?)
  `).run(day_of_week, start_slot, end_slot, location_town, county, location_state, candidates.plumber_id, candidates.hourly_rate, candidates.availability_id);

  res.json({
    id: result.lastInsertRowid,
    assigned_plumber: candidates.plumber_name,
    hourly_rate: candidates.hourly_rate,
    crews_remaining: candidates.num_crews - candidates.booked_crews - 1,
    message: `Assigned to ${candidates.plumber_name} at $${(candidates.hourly_rate / 100).toFixed(2)}/hr (${candidates.num_crews - candidates.booked_crews - 1} crews remaining)`
  });
});

// =====================
// --- Users ---
// =====================

router.post('/users', (req, res) => {
  const { name, email, user_type } = req.body;
  if (!name || !email || !user_type) return res.status(400).json({ error: 'Name, email, and user_type required' });
  const validTypes = ['admin', 'plumber', 'homeowner', 'property_manager'];
  if (!validTypes.includes(user_type)) return res.status(400).json({ error: 'Invalid user type' });
  try {
    const result = db.prepare('INSERT INTO users (name, email, user_type) VALUES (?, ?, ?)').run(name, email, user_type);
    const user = { id: result.lastInsertRowid, name, email, user_type };

    // If plumber, also create a plumber record linked to this user
    if (user_type === 'plumber') {
      const pr = db.prepare('INSERT INTO plumbers (name, email, user_id) VALUES (?, ?, ?)').run(name, email, user.id);
      user.plumber_id = pr.lastInsertRowid;
    }

    res.json(user);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      // Email exists — treat as sign-in
      const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (existing) return res.json(existing);
      return res.status(409).json({ error: 'Email already exists' });
    }
    throw e;
  }
});

router.get('/plumbers/by-user/:userId', (req, res) => {
  const plumber = db.prepare('SELECT * FROM plumbers WHERE user_id = ?').get(req.params.userId);
  if (!plumber) {
    // Try matching by email via users table
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
    if (user) {
      const byEmail = db.prepare('SELECT * FROM plumbers WHERE email = ?').get(user.email);
      if (byEmail) {
        // Link them
        db.prepare('UPDATE plumbers SET user_id = ? WHERE id = ?').run(user.id, byEmail.id);
        return res.json(byEmail);
      }
    }
    return res.status(404).json({ error: 'Plumber record not found' });
  }
  res.json(plumber);
});

router.get('/users/by-email/:email', (req, res) => {
  const email = decodeURIComponent(req.params.email).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// =====================
// --- Property Manager ---
// =====================

router.get('/pm/units/:managerId', (req, res) => {
  const units = db.prepare('SELECT * FROM pm_units WHERE manager_id = ? ORDER BY address, unit_number').all(req.params.managerId);
  res.json(units);
});

router.post('/pm/units', (req, res) => {
  const { manager_id, address, unit_number, tenant_name, tenant_email, city, state } = req.body;
  if (!manager_id || !address || !tenant_name || !tenant_email || !city || !state) {
    return res.status(400).json({ error: 'All fields required' });
  }
  const result = db.prepare(
    'INSERT INTO pm_units (manager_id, address, unit_number, tenant_name, tenant_email, city, state) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(manager_id, address, unit_number || null, tenant_name, tenant_email, city, state);
  res.json({ id: result.lastInsertRowid, manager_id, address, unit_number, tenant_name, tenant_email, city, state });
});

router.delete('/pm/units/:id', (req, res) => {
  db.prepare('DELETE FROM pm_units WHERE id = ?').run(req.params.id);
  res.json({ message: 'Unit deleted' });
});

// Create a service request — generates scheduling token and simulates email
router.post('/pm/request', (req, res) => {
  const { pm_unit_id, manager_id, notes } = req.body;
  if (!pm_unit_id || !manager_id) return res.status(400).json({ error: 'Unit and manager required' });

  const unit = db.prepare('SELECT * FROM pm_units WHERE id = ?').get(pm_unit_id);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });

  // Generate unique token
  const token = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

  const result = db.prepare(
    'INSERT INTO service_requests (pm_unit_id, manager_id, scheduling_token, notes) VALUES (?, ?, ?, ?)'
  ).run(pm_unit_id, manager_id, token, notes || null);

  const schedulingUrl = `/schedule/${token}`;

  res.json({
    id: result.lastInsertRowid,
    token,
    scheduling_url: schedulingUrl,
    simulated_email: {
      to: unit.tenant_email,
      subject: 'Schedule Your Water Heater Replacement',
      body: `Hi ${unit.tenant_name},\n\nYour property manager has requested a water heater replacement at ${unit.address}${unit.unit_number ? ` Unit ${unit.unit_number}` : ''}, ${unit.city}, ${unit.state}.\n\nPlease click the link below to schedule your installation:\n${schedulingUrl}\n\nThank you,\nRapid Hot`
    }
  });
});

router.get('/pm/requests/:managerId', (req, res) => {
  const requests = db.prepare(`
    SELECT sr.*, u.address, u.unit_number, u.tenant_name, u.tenant_email, u.city, u.state,
      j.day_of_week as job_day, j.start_slot as job_start, j.end_slot as job_end,
      p.name as plumber_name, j.hourly_rate as job_rate
    FROM service_requests sr
    JOIN pm_units u ON u.id = sr.pm_unit_id
    LEFT JOIN jobs j ON j.id = sr.job_id
    LEFT JOIN plumbers p ON p.id = j.assigned_plumber_id
    WHERE sr.manager_id = ?
    ORDER BY sr.created_at DESC
  `).all(req.params.managerId);
  res.json(requests);
});

// =====================
// --- Tenant Scheduling (public via token) ---
// =====================

router.get('/schedule/:token', (req, res) => {
  const sr = db.prepare(`
    SELECT sr.*, u.address, u.unit_number, u.tenant_name, u.tenant_email, u.city, u.state
    FROM service_requests sr
    JOIN pm_units u ON u.id = sr.pm_unit_id
    WHERE sr.scheduling_token = ?
  `).get(req.params.token);

  if (!sr) return res.status(404).json({ error: 'Invalid scheduling link' });
  if (sr.status !== 'pending_schedule') {
    return res.json({ ...sr, already_scheduled: true });
  }

  // Find available plumbers for this location
  const townData = locations.towns[sr.state]?.find(
    t => t.name.toLowerCase() === sr.city.toLowerCase()
  );
  const county = townData?.county || '';

  const available = db.prepare(`
    SELECT DISTINCT a.id as availability_id, a.day_of_week, a.start_slot, a.end_slot, a.hourly_rate, a.num_crews,
      p.name as plumber_name, a.plumber_id,
      (SELECT COUNT(*) FROM jobs j WHERE j.availability_id = a.id AND j.status IN ('assigned','pending')) as booked_crews
    FROM plumber_availability a
    JOIN plumbers p ON p.id = a.plumber_id
    JOIN plumber_service_areas sa ON sa.availability_id = a.id
    WHERE (
      (sa.area_type = 'town' AND LOWER(sa.area_name) = LOWER(?) AND sa.state = ?)
      OR (sa.area_type = 'county' AND LOWER(sa.area_name) = LOWER(?) AND sa.state = ?)
      OR (sa.area_type = 'state' AND sa.state = ?)
    )
    GROUP BY a.id
    HAVING booked_crews < a.num_crews
    ORDER BY a.hourly_rate ASC, a.day_of_week, a.start_slot
  `).all(sr.city, sr.state, county, sr.state, sr.state);

  res.json({ request: sr, available_slots: available });
});

router.post('/schedule/:token', (req, res) => {
  const { day_of_week, start_slot, end_slot } = req.body;

  const sr = db.prepare(`
    SELECT sr.*, u.city, u.state
    FROM service_requests sr
    JOIN pm_units u ON u.id = sr.pm_unit_id
    WHERE sr.scheduling_token = ?
  `).get(req.params.token);

  if (!sr) return res.status(404).json({ error: 'Invalid scheduling link' });
  if (sr.status !== 'pending_schedule') return res.status(400).json({ error: 'Already scheduled' });

  if ((end_slot - start_slot) !== 6) return res.status(400).json({ error: 'Must be a 3-hour slot' });

  // Find cheapest plumber for this slot+location
  const townData = locations.towns[sr.state]?.find(
    t => t.name.toLowerCase() === sr.city.toLowerCase()
  );
  const county = townData?.county || '';

  const candidate = db.prepare(`
    SELECT a.id as availability_id, a.plumber_id, a.hourly_rate, a.num_crews, p.name as plumber_name,
      (SELECT COUNT(*) FROM jobs j WHERE j.availability_id = a.id AND j.status IN ('assigned','pending')
       AND j.start_slot < ? AND j.end_slot > ?) as booked_crews
    FROM plumber_availability a
    JOIN plumbers p ON p.id = a.plumber_id
    JOIN plumber_service_areas sa ON sa.availability_id = a.id
    WHERE a.day_of_week = ? AND a.start_slot <= ? AND a.end_slot >= ?
      AND (
        (sa.area_type = 'town' AND LOWER(sa.area_name) = LOWER(?) AND sa.state = ?)
        OR (sa.area_type = 'county' AND LOWER(sa.area_name) = LOWER(?) AND sa.state = ?)
        OR (sa.area_type = 'state' AND sa.state = ?)
      )
    GROUP BY a.id
    HAVING booked_crews < a.num_crews
    ORDER BY a.hourly_rate ASC
    LIMIT 1
  `).get(end_slot, start_slot, day_of_week, start_slot, end_slot, sr.city, sr.state, county, sr.state, sr.state);

  if (!candidate) return res.status(404).json({ error: 'No plumbers available for this slot' });

  const jobResult = db.prepare(`
    INSERT INTO jobs (day_of_week, start_slot, end_slot, location_town, location_county, location_state, assigned_plumber_id, hourly_rate, status, availability_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'assigned', ?)
  `).run(day_of_week, start_slot, end_slot, sr.city, county, sr.state, candidate.plumber_id, candidate.hourly_rate, candidate.availability_id);

  db.prepare('UPDATE service_requests SET status = ?, job_id = ? WHERE id = ?')
    .run('scheduled', jobResult.lastInsertRowid, sr.id);

  res.json({
    message: `Scheduled! ${candidate.plumber_name} assigned at $${(candidate.hourly_rate / 100).toFixed(2)}/hr`,
    plumber_name: candidate.plumber_name,
    hourly_rate: candidate.hourly_rate,
    job_id: jobResult.lastInsertRowid
  });
});

// =====================
// --- Seed / Mock Data ---
// =====================

router.post('/seed', (req, res) => {
  const transaction = db.transaction(() => {
    // Create demo users
    const adminUser = db.prepare("INSERT OR IGNORE INTO users (name, email, user_type) VALUES ('Shane (Admin)', 'shane@rapidhot.com', 'admin')").run();
    const adminUser2 = db.prepare("INSERT OR IGNORE INTO users (name, email, user_type) VALUES ('Delince (Admin)', 'delince@rapidhot.com', 'admin')").run();
    const plumberUser1 = db.prepare("INSERT OR IGNORE INTO users (name, email, user_type) VALUES ('Mike Johnson', 'mike@plumbing.com', 'plumber')").run();
    const plumberUser2 = db.prepare("INSERT OR IGNORE INTO users (name, email, user_type) VALUES ('Sarah Davis', 'sarah@plumbing.com', 'plumber')").run();
    const pmUser = db.prepare("INSERT OR IGNORE INTO users (name, email, user_type) VALUES ('Tom Property Mgr', 'tom@properties.com', 'property_manager')").run();
    const homeowner = db.prepare("INSERT OR IGNORE INTO users (name, email, user_type) VALUES ('Jane Homeowner', 'jane@home.com', 'homeowner')").run();

    // Create plumber records if they don't exist
    const p1 = db.prepare("INSERT OR IGNORE INTO plumbers (name, email) VALUES ('Mike Johnson', 'mike@plumbing.com')").run();
    const p2 = db.prepare("INSERT OR IGNORE INTO plumbers (name, email) VALUES ('Sarah Davis', 'sarah@plumbing.com')").run();

    // Get plumber IDs
    const mike = db.prepare("SELECT id FROM plumbers WHERE email = 'mike@plumbing.com'").get();
    const sarah = db.prepare("SELECT id FROM plumbers WHERE email = 'sarah@plumbing.com'").get();

    if (mike && sarah) {
      // Mike: Mon-Fri 8am-2pm, $65/hr, 2 crews, serves Suffolk County MA
      for (let day = 0; day <= 4; day++) {
        const existing = db.prepare('SELECT id FROM plumber_availability WHERE plumber_id = ? AND day_of_week = ? AND start_slot = 16').get(mike.id, day);
        if (!existing) {
          const a = db.prepare('INSERT INTO plumber_availability (plumber_id, day_of_week, start_slot, end_slot, hourly_rate, num_crews) VALUES (?,?,16,28,6500,2)').run(mike.id, day);
          db.prepare("INSERT INTO plumber_service_areas (availability_id, area_type, area_name, state) VALUES (?, 'county', 'Suffolk', 'MA')").run(a.lastInsertRowid);
          db.prepare("INSERT INTO plumber_service_areas (availability_id, area_type, area_name, state) VALUES (?, 'county', 'Middlesex', 'MA')").run(a.lastInsertRowid);
        }
      }

      // Sarah: Mon-Wed 10am-5pm, $75/hr, 1 crew, serves Boston + Cambridge
      for (let day = 0; day <= 2; day++) {
        const existing = db.prepare('SELECT id FROM plumber_availability WHERE plumber_id = ? AND day_of_week = ? AND start_slot = 20').get(sarah.id, day);
        if (!existing) {
          const a = db.prepare('INSERT INTO plumber_availability (plumber_id, day_of_week, start_slot, end_slot, hourly_rate, num_crews) VALUES (?,?,20,34,7500,1)').run(sarah.id, day);
          db.prepare("INSERT INTO plumber_service_areas (availability_id, area_type, area_name, state) VALUES (?, 'town', 'Boston', 'MA')").run(a.lastInsertRowid);
          db.prepare("INSERT INTO plumber_service_areas (availability_id, area_type, area_name, state) VALUES (?, 'town', 'Cambridge', 'MA')").run(a.lastInsertRowid);
        }
      }
    }

    // Create PM units
    const pm = db.prepare("SELECT id FROM users WHERE email = 'tom@properties.com'").get();
    if (pm) {
      const existingUnit = db.prepare('SELECT id FROM pm_units WHERE manager_id = ?').get(pm.id);
      if (!existingUnit) {
        db.prepare("INSERT INTO pm_units (manager_id, address, unit_number, tenant_name, tenant_email, city, state) VALUES (?, '100 Beacon St', '3A', 'Alice Tenant', 'alice@tenant.com', 'Boston', 'MA')").run(pm.id);
        db.prepare("INSERT INTO pm_units (manager_id, address, unit_number, tenant_name, tenant_email, city, state) VALUES (?, '100 Beacon St', '5B', 'Bob Renter', 'bob@renter.com', 'Boston', 'MA')").run(pm.id);
        db.prepare("INSERT INTO pm_units (manager_id, address, unit_number, tenant_name, tenant_email, city, state) VALUES (?, '42 Harvard Ave', null, 'Carol Smith', 'carol@home.com', 'Cambridge', 'MA')").run(pm.id);
      }
    }

    return { message: 'Mock data seeded successfully' };
  });

  try {
    const result = transaction();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
