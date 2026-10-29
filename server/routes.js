const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const v = require('./validation');
const catalog = require('./catalog');
const config = require('./config');
const { setSession, clearSession, publicUser, requireAuth, requireAdmin } = require('./auth');

const router = express.Router();

const PAGE_SIZE = 20;
const ADMIN_PAGE_SIZE = 50;

const limiter = (windowMin, max, message) => rateLimit({
  windowMs: windowMin * 60 * 1000,
  limit: max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: message },
  skip: () => process.env.NODE_ENV === 'test',
});

const loginLimit = limiter(15, 10, 'Demasiados intentos. Espere 15 minutos e intente de nuevo.');
const registerLimit = limiter(60, 5, 'Demasiadas cuentas creadas desde esta conexión. Intente más tarde.');
const formLimit = limiter(60, 10, 'Ha enviado muchos formularios. Intente de nuevo en una hora.');
const apiLimit = limiter(1, 120, 'Demasiadas solicitudes. Espere un momento.');

router.use(apiLimit);

// Hash fijo para comparar cuando el correo no existe, así el tiempo de respuesta no revela si hay cuenta.
const DUMMY_HASH = bcrypt.hashSync('rampa-facil-dummy-password', 10);

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ---------- Público ---------- */

router.get('/health', wrap(async (req, res) => {
  await db.query('SELECT 1');
  res.json({ ok: true });
}));

router.get('/catalog', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    products: catalog.products,
    finishes: catalog.finishes,
    housing: catalog.housing,
    mobility: catalog.mobility,
    contactPrefs: catalog.contactPrefs,
    statuses: catalog.statuses,
  });
});

router.post('/leads', formLimit, v.body(v.lead), wrap(async (req, res) => {
  const d = req.data;
  await db.query(
    'INSERT INTO leads (name, email, phone, zip, message) VALUES ($1, $2, $3, $4, $5)',
    [d.name, d.email, d.phone, d.zip, d.message],
  );
  res.status(201).json({ ok: true });
}));

/* ---------- Cuentas ---------- */

router.post('/auth/register', registerLimit, v.body(v.register), wrap(async (req, res) => {
  const d = req.data;
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [d.email]);
  if (existing.rows[0]) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo. Inicie sesión.', fields: { email: 'Correo ya registrado' } });
  }
  const hash = await bcrypt.hash(d.password, 12);
  const role = config.adminEmail && d.email === config.adminEmail ? 'admin' : 'client';
  const { rows } = await db.query(
    'INSERT INTO users (email, password_hash, name, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone, role',
    [d.email, hash, d.name, d.phone, role],
  );
  setSession(res, rows[0]);
  res.status(201).json({ user: publicUser(rows[0]) });
}));

router.post('/auth/login', loginLimit, v.body(v.login), wrap(async (req, res) => {
  const { email, password } = req.data;
  const { rows } = await db.query('SELECT id, name, email, phone, role, password_hash FROM users WHERE email = $1', [email]);
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
  setSession(res, user);
  res.json({ user: publicUser(user) });
}));

router.post('/auth/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/auth/me', (req, res) => {
  // 200 con user null cuando no hay sesión, para no llenar la consola de errores.
  res.json({ user: req.user ? publicUser(req.user) : null });
});

/* ---------- Cotizaciones del cliente ---------- */

router.post('/quotes', requireAuth, formLimit, v.body(v.quote), wrap(async (req, res) => {
  const d = req.data;
  const open = await db.query(
    "SELECT COUNT(*) AS n FROM quotes WHERE user_id = $1 AND status <> 'completada' AND status <> 'cancelada'",
    [req.user.id],
  );
  if (Number(open.rows[0].n) >= 5) {
    return res.status(429).json({ error: 'Tiene 5 solicitudes abiertas. Espere respuesta o cancele alguna antes de crear otra.' });
  }
  const { rows } = await db.query(
    `INSERT INTO quotes (user_id, product, finish, rise_in, address, zip, housing, mobility, contact_pref, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, product, finish, rise_in, address, zip, housing, mobility, contact_pref, notes, status, admin_note, created_at, updated_at`,
    [req.user.id, d.product, d.finish, d.rise_in, d.address, d.zip, d.housing, d.mobility, d.contact_pref, d.notes],
  );
  res.status(201).json({ quote: rows[0] });
}));

router.get('/quotes', requireAuth, wrap(async (req, res) => {
  const page = v.page.parse(req.query.page);
  const { rows } = await db.query(
    `SELECT id, product, finish, rise_in, address, zip, housing, mobility, contact_pref, notes, status, admin_note, created_at, updated_at
     FROM quotes WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
    [req.user.id, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE],
  );
  res.json({ quotes: rows.slice(0, PAGE_SIZE), page, hasMore: rows.length > PAGE_SIZE });
}));

router.post('/quotes/:id/cancel', requireAuth, wrap(async (req, res) => {
  const parsed = v.id.safeParse(req.params.id);
  if (!parsed.success) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  // El filtro por user_id impide tocar solicitudes de otra persona.
  const { rows } = await db.query(
    `UPDATE quotes SET status = 'cancelada', updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status IN ('nuevo', 'revision', 'visita', 'cotizada')
     RETURNING id, status`,
    [parsed.data, req.user.id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'No se encontró una solicitud que se pueda cancelar.' });
  res.json({ quote: rows[0] });
}));

/* ---------- Administración ---------- */

router.get('/admin/stats', requireAdmin, wrap(async (req, res) => {
  const byStatus = await db.query('SELECT status, COUNT(*) AS n FROM quotes GROUP BY status');
  const users = await db.query("SELECT COUNT(*) AS n FROM users WHERE role = 'client'");
  const leads = await db.query('SELECT COUNT(*) AS n FROM leads');
  res.json({
    byStatus: byStatus.rows.map(r => ({ status: r.status, n: Number(r.n) })),
    clients: Number(users.rows[0].n),
    leads: Number(leads.rows[0].n),
  });
}));

router.get('/admin/quotes', requireAdmin, wrap(async (req, res) => {
  const page = v.page.parse(req.query.page);
  const status = catalog.ids(catalog.statuses).includes(req.query.status) ? req.query.status : null;
  const params = [ADMIN_PAGE_SIZE + 1, (page - 1) * ADMIN_PAGE_SIZE];
  let where = '';
  if (status) {
    params.push(status);
    where = 'WHERE q.status = $3';
  }
  const { rows } = await db.query(
    `SELECT q.id, q.product, q.finish, q.rise_in, q.address, q.zip, q.housing, q.mobility, q.contact_pref, q.notes,
            q.status, q.admin_note, q.created_at, q.updated_at, u.name AS client_name, u.email AS client_email, u.phone AS client_phone
     FROM quotes q JOIN users u ON u.id = q.user_id ${where}
     ORDER BY q.created_at DESC, q.id DESC LIMIT $1 OFFSET $2`,
    params,
  );
  res.json({ quotes: rows.slice(0, ADMIN_PAGE_SIZE), page, hasMore: rows.length > ADMIN_PAGE_SIZE });
}));

router.patch('/admin/quotes/:id', requireAdmin, v.body(v.adminUpdate), wrap(async (req, res) => {
  const parsed = v.id.safeParse(req.params.id);
  if (!parsed.success) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  const { rows } = await db.query(
    'UPDATE quotes SET status = $1, admin_note = $2, updated_at = now() WHERE id = $3 RETURNING id, status, admin_note, updated_at',
    [req.data.status, req.data.admin_note, parsed.data],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  res.json({ quote: rows[0] });
}));

router.get('/admin/leads', requireAdmin, wrap(async (req, res) => {
  const page = v.page.parse(req.query.page);
  const { rows } = await db.query(
    'SELECT id, name, email, phone, zip, message, created_at FROM leads ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2',
    [ADMIN_PAGE_SIZE + 1, (page - 1) * ADMIN_PAGE_SIZE],
  );
  res.json({ leads: rows.slice(0, ADMIN_PAGE_SIZE), page, hasMore: rows.length > ADMIN_PAGE_SIZE });
}));

module.exports = router;
