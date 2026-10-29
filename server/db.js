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
}

// Todas las consultas pasan por aquí con parámetros ($1, $2...). Nunca concatenar texto del usuario.
function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = { init, query, pool };
