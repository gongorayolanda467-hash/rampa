const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');

function setSession(res, user) {
  const token = jwt.sign({ sub: String(user.id) }, config.jwtSecret, {
    expiresIn: `${config.sessionDays}d`,
    algorithm: 'HS256',
  });
  res.cookie(config.sessionCookie, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSession(res) {
  res.clearCookie(config.sessionCookie, { httpOnly: true, secure: config.isProd, sameSite: 'lax', path: '/' });
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role };
}

// Lee la sesión y carga el usuario desde la base de datos en cada petición,
// así un cambio de rol o una cuenta borrada se aplica de inmediato.
async function loadUser(req, res, next) {
  req.user = null;
  const token = req.cookies && req.cookies[config.sessionCookie];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const { rows } = await db.query('SELECT id, name, email, phone, role FROM users WHERE id = $1', [Number(payload.sub)]);
    if (rows[0]) req.user = rows[0];
    else clearSession(res);
  } catch {
    clearSession(res);
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Inicie sesión para continuar.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Inicie sesión para continuar.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'No tiene permiso para ver esta sección.' });
  next();
}

function requireFunder(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Inicie sesión para continuar.' });
  if (req.user.role !== 'funder') return res.status(403).json({ error: 'Esta sección es para cuentas de financiador.' });
  next();
}

module.exports = { setSession, clearSession, publicUser, loadUser, requireAuth, requireAdmin, requireFunder };
