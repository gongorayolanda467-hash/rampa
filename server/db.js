const config = require('./config');

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'client',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS quotes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product TEXT NOT NULL,
    finish TEXT NOT NULL,
    rise_in INTEGER NOT NULL,
    address TEXT NOT NULL,
    zip TEXT NOT NULL,
    housing TEXT NOT NULL,
    mobility TEXT NOT NULL,
    contact_pref TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'nuevo',
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS quotes_user_idx ON quotes (user_id)`,
  `CREATE INDEX IF NOT EXISTS quotes_status_idx ON quotes (status)`,
  `CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    zip TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // Perfil de quien financia (programas, organizaciones, propietarios, donantes).
  `CREATE TABLE IF NOT EXISTS funders (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    org_name TEXT NOT NULL,
    kind TEXT NOT NULL,
    zips TEXT,
    max_amount INTEGER,
    housing TEXT,
    about TEXT,
    verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // Ofertas de financiamiento sobre una solicitud.
  `CREATE TABLE IF NOT EXISTS offers (
    id SERIAL PRIMARY KEY,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    funder_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    coverage TEXT NOT NULL,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (quote_id, funder_id)
  )`,
  `CREATE INDEX IF NOT EXISTS offers_quote_idx ON offers (quote_id)`,
  `CREATE INDEX IF NOT EXISTS offers_funder_idx ON offers (funder_id)`,
];

// Columnas agregadas después de la primera versión. Se aplican una por una y se ignoran si ya existen.
const COLUMNS = [
  ['quotes', 'low_income', 'BOOLEAN NOT NULL DEFAULT false'],
  ['quotes', 'veteran', 'BOOLEAN NOT NULL DEFAULT false'],
  ['quotes', 'medicaid', 'BOOLEAN NOT NULL DEFAULT false'],
  ['quotes', 'share_consent', 'BOOLEAN NOT NULL DEFAULT false'],
  ['quotes', 'est_low', 'INTEGER'],
  ['quotes', 'est_high', 'INTEGER'],
];

function createPool() {
  if (config.databaseUrl) {
    const { Pool } = require('pg');
    return new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
  }
  if (config.isProd) {
    throw new Error('DATABASE_URL es obligatorio en producción.');
  }
  // Desarrollo y pruebas: base de datos en memoria.
  const { newDb } = require('pg-mem');
  const { Pool } = newDb().adapters.createPg();
  return new Pool();
}

const pool = createPool();

async function init() {
  for (const sql of SCHEMA) {
    await pool.query(sql);
  }
  for (const [table, column, type] of COLUMNS) {
    try {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch (err) {
      if (!/already exists|duplicate/i.test(err.message)) throw err;
    }
  }
}

// Todas las consultas pasan por aquí con parámetros ($1, $2...). Nunca concatenar texto del usuario.
function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = { init, query, pool };
