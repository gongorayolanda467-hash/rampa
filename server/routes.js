const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const v = require('./validation');
const catalog = require('./catalog');
const config = require('./config');
const { matchPrograms, publicPrograms } = require('./programs');
const { setSession, clearSession, publicUser, requireAuth, requireAdmin, requireFunder } = require('./auth');

const router = express.Router();

const PAGE_SIZE = 20;
const ADMIN_PAGE_SIZE = 50;
const OPEN_STATUSES = ['nuevo', 'revision', 'visita', 'cotizada'];

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
const offerLimit = limiter(60, 40, 'Ha enviado muchas ofertas. Intente de nuevo en una hora.');
const apiLimit = limiter(1, 120, 'Demasiadas solicitudes. Espere un momento.');

router.use(apiLimit);

// Hash fijo para comparar cuando el correo no existe, así el tiempo de respuesta no revela si hay cuenta.
const DUMMY_HASH = bcrypt.hashSync('rampa-facil-dummy-password', 10);

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const notFound = (res, msg = 'No encontrado.') => res.status(404).json({ error: msg });
const list = v => (v ? String(v).split(',').filter(Boolean) : []);

const QUOTE_FIELDS = `id, product, finish, rise_in, address, zip, housing, mobility, contact_pref, notes, status, admin_note,
  low_income, veteran, medicaid, share_consent, est_low, est_high, created_at, updated_at`;

async function funderProfile(userId) {
  const { rows } = await db.query('SELECT org_name, kind, zips, max_amount, housing, about, verified FROM funders WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

async function userPayload(user) {
  const out = publicUser(user);
  if (user.role === 'funder') out.funder = await funderProfile(user.id);
  return out;
}

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
    funderKinds: catalog.funderKinds,
    coverages: catalog.coverages,
    offerStatuses: catalog.offerStatuses,
  });
});

router.get('/programs', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ programs: publicPrograms() });
});

router.get('/estimate', (req, res) => {
  const product = catalog.ids(catalog.products).includes(req.query.product) ? req.query.product : 'no-se';
  const finish = catalog.ids(catalog.finishes).includes(req.query.finish) ? req.query.finish : 'basico';
  const rise = Math.min(120, Math.max(1, Number.parseInt(req.query.rise, 10) || 1));
  res.json(catalog.estimate(product, finish, rise));
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
  const role = config.adminEmail && d.email === config.adminEmail ? 'admin' : d.role;
  const { rows } = await db.query(
    'INSERT INTO users (email, password_hash, name, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone, role',
    [d.email, hash, d.name, d.phone, role],
  );
  if (role === 'funder') {
    await db.query('INSERT INTO funders (user_id, org_name, kind) VALUES ($1, $2, $3)', [rows[0].id, d.org_name, d.kind]);
  }
  setSession(res, rows[0]);
  res.status(201).json({ user: await userPayload(rows[0]) });
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
  res.json({ user: await userPayload(user) });
}));

router.post('/auth/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/auth/me', wrap(async (req, res) => {
  // 200 con user null cuando no hay sesión, para no llenar la consola de errores.
  res.json({ user: req.user ? await userPayload(req.user) : null });
}));

/* ---------- Solicitudes de quien necesita la rampa ---------- */

router.post('/quotes', requireAuth, formLimit, v.body(v.quote), wrap(async (req, res) => {
  if (req.user.role === 'funder') return res.status(403).json({ error: 'Las cuentas de financiador no pueden crear solicitudes. Cree una cuenta personal.' });
  const d = req.data;
  const open = await db.query(
    "SELECT COUNT(*) AS n FROM quotes WHERE user_id = $1 AND status <> 'completada' AND status <> 'cancelada'",
    [req.user.id],
  );
  if (Number(open.rows[0].n) >= 5) {
    return res.status(429).json({ error: 'Tiene 5 solicitudes abiertas. Espere respuesta o cancele alguna antes de crear otra.' });
  }
  const est = catalog.estimate(d.product, d.finish, d.rise_in);
  const { rows } = await db.query(
    `INSERT INTO quotes (user_id, product, finish, rise_in, address, zip, housing, mobility, contact_pref, notes,
                         low_income, veteran, medicaid, share_consent, est_low, est_high)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING ${QUOTE_FIELDS}`,
    [req.user.id, d.product, d.finish, d.rise_in, d.address, d.zip, d.housing, d.mobility, d.contact_pref, d.notes,
      d.low_income, d.veteran, d.medicaid, d.share_consent, est.low, est.high],
  );
  res.status(201).json({ quote: rows[0] });
}));

router.get('/quotes', requireAuth, wrap(async (req, res) => {
  const page = v.page.parse(req.query.page);
  const { rows } = await db.query(
    `SELECT ${QUOTE_FIELDS} FROM quotes WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
    [req.user.id, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE],
  );
  const quotes = rows.slice(0, PAGE_SIZE);
  for (const q of quotes) {
    q.programs = matchPrograms(q);
    const offers = await db.query(
      `SELECT o.id, o.amount, o.coverage, o.message, o.status, o.created_at, f.org_name, f.kind
       FROM offers o JOIN funders f ON f.user_id = o.funder_id
       WHERE o.quote_id = $1 AND o.status <> 'retirada' ORDER BY o.created_at DESC`,
      [q.id],
    );
    q.offers = offers.rows;
  }
  res.json({ quotes, page, hasMore: rows.length > PAGE_SIZE });
}));

router.post('/quotes/:id/cancel', requireAuth, wrap(async (req, res) => {
  const parsed = v.id.safeParse(req.params.id);
  if (!parsed.success) return notFound(res, 'Solicitud no encontrada.');
  // El filtro por user_id impide tocar solicitudes de otra persona.
  const { rows } = await db.query(
    `UPDATE quotes SET status = 'cancelada', updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status IN ('nuevo', 'revision', 'visita', 'cotizada')
     RETURNING id, status`,
    [parsed.data, req.user.id],
  );
  if (!rows[0]) return notFound(res, 'No se encontró una solicitud que se pueda cancelar.');
  res.json({ quote: rows[0] });
}));

router.post('/quotes/:id/share', requireAuth, wrap(async (req, res) => {
  const parsed = v.id.safeParse(req.params.id);
  if (!parsed.success) return notFound(res, 'Solicitud no encontrada.');
  const share = req.body && req.body.share === true;
  const { rows } = await db.query(
    'UPDATE quotes SET share_consent = $1, updated_at = now() WHERE id = $2 AND user_id = $3 RETURNING id, share_consent',
    [share, parsed.data, req.user.id],
  );
  if (!rows[0]) return notFound(res, 'Solicitud no encontrada.');
  res.json({ quote: rows[0] });
}));

router.post('/quotes/:qid/offers/:oid/:action', requireAuth, wrap(async (req, res) => {
  const qid = v.id.safeParse(req.params.qid);
  const oid = v.id.safeParse(req.params.oid);
  const action = req.params.action;
  if (!qid.success || !oid.success || !['accept', 'decline'].includes(action)) return notFound(res, 'Oferta no encontrada.');
  const owner = await db.query('SELECT id, status FROM quotes WHERE id = $1 AND user_id = $2', [qid.data, req.user.id]);
  if (!owner.rows[0]) return notFound(res, 'Oferta no encontrada.');
  const status = action === 'accept' ? 'aceptada' : 'rechazada';
  const { rows } = await db.query(
    "UPDATE offers SET status = $1, updated_at = now() WHERE id = $2 AND quote_id = $3 AND status = 'pendiente' RETURNING id, status",
    [status, oid.data, qid.data],
  );
  if (!rows[0]) return notFound(res, 'Esta oferta ya no está disponible.');
  if (action === 'accept' && owner.rows[0].status === 'nuevo') {
    await db.query("UPDATE quotes SET status = 'revision', updated_at = now() WHERE id = $1", [qid.data]);
  }
  res.json({ offer: rows[0] });
}));

/* ---------- Financiadores (quien paga) ---------- */

router.get('/funder/profile', requireFunder, wrap(async (req, res) => {
  res.json({ profile: await funderProfile(req.user.id) });
}));

router.put('/funder/profile', requireFunder, v.body(v.funderProfile), wrap(async (req, res) => {
  const d = req.data;
  const { rows } = await db.query(
    `UPDATE funders SET org_name = $1, kind = $2, zips = $3, max_amount = $4, housing = $5, about = $6
     WHERE user_id = $7 RETURNING org_name, kind, zips, max_amount, housing, about, verified`,
    [d.org_name, d.kind, d.zips, d.max_amount, d.housing, d.about, req.user.id],
  );
  res.json({ profile: rows[0] });
}));

// Casos que la persona aceptó compartir. Nunca incluye nombre, dirección, contacto ni notas.
router.get('/funder/cases', requireFunder, wrap(async (req, res) => {
  const profile = await funderProfile(req.user.id);
  if (!profile || !profile.verified) {
    return res.status(403).json({ error: 'Su cuenta está en revisión. Cuando la verifiquemos podrá ver los casos.', pending: true });
  }
  const page = v.page.parse(req.query.page);
  const { rows } = await db.query(
    `SELECT q.id, q.product, q.finish, q.rise_in, q.zip, q.housing, q.mobility, q.low_income, q.veteran, q.medicaid,
            q.est_low, q.est_high, q.created_at
     FROM quotes q
     WHERE q.share_consent = true AND q.status IN ('nuevo', 'revision', 'visita', 'cotizada')
     ORDER BY q.created_at DESC, q.id DESC LIMIT 300`,
  );
  let cases = rows;
  if (req.query.match === '1') {
    const zips = list(profile.zips);
    const housing = list(profile.housing);
    cases = cases.filter(c => (!zips.length || zips.includes(c.zip)) && (!housing.length || housing.includes(c.housing)));
  }
  const slice = cases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  for (const c of slice) {
    const agg = await db.query(
      "SELECT amount, status, funder_id FROM offers WHERE quote_id = $1 AND status IN ('pendiente', 'aceptada')",
      [c.id],
    );
    c.pledged = agg.rows.filter(o => o.status === 'aceptada').reduce((s, o) => s + o.amount, 0);
    c.offers_count = agg.rows.length;
    const mine = await db.query('SELECT id, amount, coverage, message, status FROM offers WHERE quote_id = $1 AND funder_id = $2', [c.id, req.user.id]);
    c.my_offer = mine.rows[0] || null;
  }
  res.json({ cases: slice, page, hasMore: cases.length > page * PAGE_SIZE, total: cases.length });
}));

router.post('/funder/cases/:id/offers', requireFunder, offerLimit, v.body(v.offer), wrap(async (req, res) => {
  const parsed = v.id.safeParse(req.params.id);
  if (!parsed.success) return notFound(res, 'Caso no encontrado.');
  const profile = await funderProfile(req.user.id);
  if (!profile || !profile.verified) return res.status(403).json({ error: 'Su cuenta está en revisión. Todavía no puede enviar ofertas.' });
  const q = await db.query(
    "SELECT id FROM quotes WHERE id = $1 AND share_consent = true AND status IN ('nuevo', 'revision', 'visita', 'cotizada')",
    [parsed.data],
  );
  if (!q.rows[0]) return notFound(res, 'Este caso ya no está disponible.');
  const d = req.data;
  const existing = await db.query('SELECT id, status FROM offers WHERE quote_id = $1 AND funder_id = $2', [parsed.data, req.user.id]);
  let offer;
  if (existing.rows[0]) {
    if (existing.rows[0].status === 'aceptada') return res.status(409).json({ error: 'Su oferta ya fue aceptada. Para cambiarla, escríbanos.' });
    const upd = await db.query(
      "UPDATE offers SET amount = $1, coverage = $2, message = $3, status = 'pendiente', updated_at = now() WHERE id = $4 RETURNING id, amount, coverage, message, status",
      [d.amount, d.coverage, d.message, existing.rows[0].id],
    );
    offer = upd.rows[0];
  } else {
    const ins = await db.query(
      'INSERT INTO offers (quote_id, funder_id, amount, coverage, message) VALUES ($1, $2, $3, $4, $5) RETURNING id, amount, coverage, message, status',
      [parsed.data, req.user.id, d.amount, d.coverage, d.message],
    );
    offer = ins.rows[0];
  }
  res.status(201).json({ offer });
}));

router.get('/funder/offers', requireFunder, wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT o.id, o.quote_id, o.amount, o.coverage, o.message, o.status, o.created_at, q.product, q.finish, q.rise_in, q.zip, q.status AS quote_status
     FROM offers o JOIN quotes q ON q.id = o.quote_id
     WHERE o.funder_id = $1 ORDER BY o.created_at DESC LIMIT 100`,
    [req.user.id],
  );
  res.json({ offers: rows });
}));

router.post('/funder/offers/:id/withdraw', requireFunder, wrap(async (req, res) => {
  const parsed = v.id.safeParse(req.params.id);
  if (!parsed.success) return notFound(res, 'Oferta no encontrada.');
  const { rows } = await db.query(
    "UPDATE offers SET status = 'retirada', updated_at = now() WHERE id = $1 AND funder_id = $2 AND status = 'pendiente' RETURNING id, status",
    [parsed.data, req.user.id],
  );
  if (!rows[0]) return notFound(res, 'Solo se pueden retirar ofertas que esperan respuesta.');
  res.json({ offer: rows[0] });
}));

/* ---------- Administración ---------- */

router.get('/admin/stats', requireAdmin, wrap(async (req, res) => {
  const byStatus = await db.query('SELECT status, COUNT(*) AS n FROM quotes GROUP BY status');
  const users = await db.query("SELECT COUNT(*) AS n FROM users WHERE role = 'client'");
  const funders = await db.query('SELECT COUNT(*) AS n FROM funders');
  const pendingFunders = await db.query('SELECT COUNT(*) AS n FROM funders WHERE verified = false');
  const leads = await db.query('SELECT COUNT(*) AS n FROM leads');
  const accepted = await db.query("SELECT amount FROM offers WHERE status = 'aceptada'");
  res.json({
    byStatus: byStatus.rows.map(r => ({ status: r.status, n: Number(r.n) })),
    clients: Number(users.rows[0].n),
    funders: Number(funders.rows[0].n),
    pendingFunders: Number(pendingFunders.rows[0].n),
    leads: Number(leads.rows[0].n),
    pledged: accepted.rows.reduce((s, r) => s + Number(r.amount), 0),
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
            q.status, q.admin_note, q.low_income, q.veteran, q.medicaid, q.share_consent, q.est_low, q.est_high,
            q.created_at, q.updated_at, u.name AS client_name, u.email AS client_email, u.phone AS client_phone
     FROM quotes q JOIN users u ON u.id = q.user_id ${where}
     ORDER BY q.created_at DESC, q.id DESC LIMIT $1 OFFSET $2`,
    params,
  );
  const quotes = rows.slice(0, ADMIN_PAGE_SIZE);
  for (const q of quotes) {
    const offers = await db.query(
      `SELECT o.id, o.amount, o.coverage, o.status, f.org_name FROM offers o JOIN funders f ON f.user_id = o.funder_id
       WHERE o.quote_id = $1 AND o.status <> 'retirada' ORDER BY o.created_at DESC`,
      [q.id],
    );
    q.offers = offers.rows;
    q.programs = matchPrograms(q).map(p => p.name);
  }
  res.json({ quotes, page, hasMore: rows.length > ADMIN_PAGE_SIZE });
}));

router.patch('/admin/quotes/:id', requireAdmin, v.body(v.adminUpdate), wrap(async (req, res) => {
  const parsed = v.id.safeParse(req.params.id);
  if (!parsed.success) return notFound(res, 'Solicitud no encontrada.');
  const { rows } = await db.query(
    'UPDATE quotes SET status = $1, admin_note = $2, updated_at = now() WHERE id = $3 RETURNING id, status, admin_note, updated_at',
    [req.data.status, req.data.admin_note, parsed.data],
  );
  if (!rows[0]) return notFound(res, 'Solicitud no encontrada.');
  res.json({ quote: rows[0] });
}));

router.get('/admin/funders', requireAdmin, wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT f.user_id AS id, f.org_name, f.kind, f.zips, f.max_amount, f.housing, f.about, f.verified, f.created_at,
            u.name, u.email, u.phone
     FROM funders f JOIN users u ON u.id = f.user_id ORDER BY f.verified ASC, f.created_at DESC LIMIT 200`,
  );
  res.json({ funders: rows });
}));

router.post('/admin/funders/:id/verify', requireAdmin, wrap(async (req, res) => {
  const parsed = v.id.safeParse(req.params.id);
  if (!parsed.success) return notFound(res, 'Financiador no encontrado.');
  const verified = !(req.body && req.body.verified === false);
  const { rows } = await db.query('UPDATE funders SET verified = $1 WHERE user_id = $2 RETURNING user_id AS id, verified', [verified, parsed.data]);
  if (!rows[0]) return notFound(res, 'Financiador no encontrado.');
  res.json({ funder: rows[0] });
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
module.exports.OPEN_STATUSES = OPEN_STATUSES;
