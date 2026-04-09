import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'data', 'scheduler.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS plumbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS plumber_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plumber_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 4),
    start_slot INTEGER NOT NULL CHECK(start_slot BETWEEN 0 AND 47),
    end_slot INTEGER NOT NULL CHECK(end_slot BETWEEN 0 AND 47),
    hourly_rate INTEGER NOT NULL CHECK(hourly_rate > 0),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (plumber_id) REFERENCES plumbers(id) ON DELETE CASCADE,
    CHECK(end_slot > start_slot),
    CHECK((end_slot - start_slot) >= 6)
  );

  CREATE TABLE IF NOT EXISTS plumber_service_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    availability_id INTEGER NOT NULL,
    area_type TEXT NOT NULL CHECK(area_type IN ('town', 'county', 'state')),
    area_name TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('MA', 'NH')),
    FOREIGN KEY (availability_id) REFERENCES plumber_availability(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 4),
    start_slot INTEGER NOT NULL CHECK(start_slot BETWEEN 0 AND 47),
    end_slot INTEGER NOT NULL CHECK(end_slot BETWEEN 0 AND 47),
    location_town TEXT NOT NULL,
    location_county TEXT,
    location_state TEXT NOT NULL CHECK(location_state IN ('MA', 'NH')),
    assigned_plumber_id INTEGER,
    hourly_rate INTEGER,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'assigned', 'completed', 'cancelled')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (assigned_plumber_id) REFERENCES plumbers(id),
    CHECK(end_slot > start_slot),
    CHECK((end_slot - start_slot) = 6)
  );
`);

// Add num_crews column if it doesn't exist (migration)
try {
  db.exec(`ALTER TABLE plumber_availability ADD COLUMN num_crews INTEGER NOT NULL DEFAULT 1`);
} catch (e) { /* Column already exists */ }

// Add availability_id to jobs if it doesn't exist (migration)
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN availability_id INTEGER REFERENCES plumber_availability(id)`);
} catch (e) { /* Column already exists */ }

// --- Step 2: User roles, PM units, service requests ---

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    user_type TEXT NOT NULL CHECK(user_type IN ('admin', 'plumber', 'homeowner', 'property_manager')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pm_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    unit_number TEXT,
    tenant_name TEXT NOT NULL,
    tenant_email TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('MA', 'NH')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS service_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pm_unit_id INTEGER NOT NULL REFERENCES pm_units(id),
    manager_id INTEGER NOT NULL REFERENCES users(id),
    scheduling_token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending_schedule' CHECK(status IN ('pending_schedule', 'scheduled', 'completed', 'cancelled')),
    job_id INTEGER REFERENCES jobs(id),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Link plumbers table to users table
try {
  db.exec(`ALTER TABLE plumbers ADD COLUMN user_id INTEGER REFERENCES users(id)`);
} catch (e) { /* Column already exists */ }

export default db;
