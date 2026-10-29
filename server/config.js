const crypto = require('crypto');

const isProd = process.env.NODE_ENV === 'production';

let jwtSecret = process.env.JWT_SECRET || '';
if (jwtSecret.length < 32) {
  if (isProd) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción.');
  }
  jwtSecret = crypto.randomBytes(48).toString('hex');
}

const port = Number(process.env.PORT) || 3000;
const appOrigin = (process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).replace(/\/$/, '');

module.exports = {
  isProd,
  port,
  appOrigin,
  jwtSecret,
  databaseUrl: process.env.DATABASE_URL || '',
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  sessionCookie: 'rf_session',
  sessionDays: 7,
};
