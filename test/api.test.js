process.env.NODE_ENV = 'test';
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.APP_ORIGIN = 'http://localhost';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../server/db');
const { createApp } = require('../server/app');

let server, base;

before(async () => {
  await db.init();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// Cliente mínimo que guarda la cookie de sesión.
function client() {
  let cookie = '';
  return async (path, { method = 'GET', body, origin } = {}) => {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;
    if (origin) headers.Origin = origin;
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text, headers: res.headers };
  };
}

const goodQuote = {
  product: 'u', finish: 'ladrillo', rise_in: 30, address: '1234 W 18th St, Chicago', zip: '60608',
  housing: 'vale', mobility: 'manual', contact_pref: 'telefono', notes: 'Entrada lateral',
};

test('páginas públicas, 404 y encabezados de seguridad', async () => {
  const c = client();
  const home = await c('/');
  assert.equal(home.status, 200);
  assert.match(home.text, /Rampa Fácil/);
  assert.match(home.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(home.headers.get('x-frame-options'), 'DENY');
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(home.headers.get('x-powered-by'), null);

  for (const p of ['/guia', '/entrar', '/registro', '/cotizar', '/panel', '/financiar', '/admin', '/ayuda', '/financiadores', '/privacidad', '/terminos']) {
    assert.equal((await c(p)).status, 200, p);
  }
  const missing = await c('/no-existe');
  assert.equal(missing.status, 404);
  assert.match(missing.text, /Esta página no tiene rampa/);
  const apiMissing = await c('/api/nada');
  assert.equal(apiMissing.status, 404);
  assert.equal(apiMissing.json.error, 'Ruta no encontrada.');
});

test('registro, sesión y validación', async () => {
  const c = client();
  const bad = await c('/api/auth/register', { method: 'POST', body: { name: 'A', email: 'no-es-correo', password: '123' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.json.fields.email && bad.json.fields.password && bad.json.fields.name);

  const ok = await c('/api/auth/register', { method: 'POST', body: { name: 'María López', email: 'Maria@Example.com', password: 'una frase segura', phone: '(773) 555-0100' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.user.email, 'maria@example.com');
  assert.equal(ok.json.user.role, 'client');
  assert.equal(ok.json.user.password_hash, undefined);

  const dup = await c('/api/auth/register', { method: 'POST', body: { name: 'Otra', email: 'maria@example.com', password: 'otra frase segura' } });
  assert.equal(dup.status, 409);

  assert.equal((await c('/api/auth/me')).json.user.name, 'María López');
  await c('/api/auth/logout', { method: 'POST' });
  assert.equal((await c('/api/auth/me')).json.user, null);

  const wrong = await c('/api/auth/login', { method: 'POST', body: { email: 'maria@example.com', password: 'incorrecta' } });
  assert.equal(wrong.status, 401);
  const right = await c('/api/auth/login', { method: 'POST', body: { email: 'maria@example.com', password: 'una frase segura' } });
  assert.equal(right.status, 200);
});

test('cotizaciones: cada usuario ve solo las suyas', async () => {
  const ana = client();
  const beto = client();
  await ana('/api/auth/register', { method: 'POST', body: { name: 'Ana Ruiz', email: 'ana@example.com', password: 'frase de ana 123' } });
  await beto('/api/auth/register', { method: 'POST', body: { name: 'Beto Díaz', email: 'beto@example.com', password: 'frase de beto 123' } });

  assert.equal((await client()('/api/quotes', { method: 'POST', body: goodQuote })).status, 401);

  const invalid = await ana('/api/quotes', { method: 'POST', body: { ...goodQuote, product: 'inventado', zip: '123', rise_in: 500 } });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.json.fields.product && invalid.json.fields.zip && invalid.json.fields.rise_in);

  const created = await ana('/api/quotes', { method: 'POST', body: goodQuote });
  assert.equal(created.status, 201);
  const id = created.json.quote.id;

  assert.equal((await ana('/api/quotes')).json.quotes.length, 1);
  assert.equal((await beto('/api/quotes')).json.quotes.length, 0);

  assert.equal((await beto(`/api/quotes/${id}/cancel`, { method: 'POST' })).status, 404);
  const cancel = await ana(`/api/quotes/${id}/cancel`, { method: 'POST' });
  assert.equal(cancel.json.quote.status, 'cancelada');
});

test('administración: solo el correo de ADMIN_EMAIL entra', async () => {
  const user = client();
  await user('/api/auth/register', { method: 'POST', body: { name: 'Carla', email: 'carla@example.com', password: 'frase de carla 1' } });
  assert.equal((await user('/api/admin/quotes')).status, 403);
  assert.equal((await client()('/api/admin/quotes')).status, 401);

  const admin = client();
  const reg = await admin('/api/auth/register', { method: 'POST', body: { name: 'Admin', email: 'admin@example.com', password: 'frase del admin 1' } });
  assert.equal(reg.json.user.role, 'admin');
  const list = await admin('/api/admin/quotes');
  assert.equal(list.status, 200);
  assert.ok(list.json.quotes.length >= 1);
  const qid = list.json.quotes[0].id;
  const upd = await admin(`/api/admin/quotes/${qid}`, { method: 'PATCH', body: { status: 'visita', admin_note: 'Visita el martes a las 10' } });
  assert.equal(upd.status, 200);
  assert.equal((await admin(`/api/admin/quotes/${qid}`, { method: 'PATCH', body: { status: 'otro' } })).status, 400);
  assert.equal((await admin('/api/admin/stats')).status, 200);
});

test('contacto, campo trampa y origen ajeno', async () => {
  const c = client();
  const lead = { name: 'Luis', email: 'luis@example.com', message: 'Quiero información sobre rampas' };
  assert.equal((await c('/api/leads', { method: 'POST', body: lead })).status, 201);
  assert.equal((await c('/api/leads', { method: 'POST', body: { ...lead, website: 'spam.com' } })).status, 400);
  assert.equal((await c('/api/leads', { method: 'POST', body: lead, origin: 'https://sitio-malo.com' })).status, 403);
  const big = await c('/api/leads', { method: 'POST', body: { ...lead, message: 'x'.repeat(30000) } });
  assert.equal(big.status, 413);
});

test('mercado: quien necesita, quien paga y privacidad', async () => {
  const necesita = client();
  const paga = client();
  const admin = client();
  await necesita('/api/auth/register', { method: 'POST', body: { name: 'Elena Soto', email: 'elena@example.com', password: 'frase de elena 1' } });
  const reg = await paga('/api/auth/register', { method: 'POST', body: { name: 'Fundación Uno', email: 'fund@example.com', password: 'frase de fund 1', role: 'funder' } });
  assert.equal(reg.status, 400, 'financiador sin organización debe fallar');
  const reg2 = await paga('/api/auth/register', { method: 'POST', body: { name: 'Ana Fondo', email: 'fund@example.com', password: 'frase de fund 1', role: 'funder', org_name: 'Fundación Uno', kind: 'ong' } });
  assert.equal(reg2.status, 201);
  assert.equal(reg2.json.user.role, 'funder');
  assert.equal(reg2.json.user.funder.verified, false);

  // Un financiador no puede crear solicitudes
  assert.equal((await paga('/api/quotes', { method: 'POST', body: goodQuote })).status, 403);

  const shared = await necesita('/api/quotes', { method: 'POST', body: { ...goodQuote, zip: '60623', low_income: true, medicaid: 'on', share_consent: true } });
  assert.equal(shared.status, 201);
  assert.ok(shared.json.quote.est_low > 0 && shared.json.quote.est_high >= shared.json.quote.est_low);
  const hidden = await necesita('/api/quotes', { method: 'POST', body: { ...goodQuote, share_consent: false } });
  assert.equal(hidden.status, 201);

  // Sin verificar no ve casos
  assert.equal((await paga('/api/funder/cases')).status, 403);
  await admin('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'frase del admin 1' } });
  const funders = await admin('/api/admin/funders');
  const fid = funders.json.funders.find(f => f.email === 'fund@example.com').id;
  assert.equal((await admin(`/api/admin/funders/${fid}/verify`, { method: 'POST', body: { verified: true } })).status, 200);

  const cases = await paga('/api/funder/cases');
  assert.equal(cases.status, 200);
  const ids = cases.json.cases.map(c => c.id);
  assert.ok(ids.includes(shared.json.quote.id), 've el caso compartido');
  assert.ok(!ids.includes(hidden.json.quote.id), 'no ve el caso sin permiso');
  const c = cases.json.cases.find(x => x.id === shared.json.quote.id);
  for (const secret of ['address', 'notes', 'client_name', 'client_email', 'user_id', 'contact_pref']) assert.equal(c[secret], undefined, secret);

  // Ofertas
  assert.equal((await paga(`/api/funder/cases/${hidden.json.quote.id}/offers`, { method: 'POST', body: { amount: 500, coverage: 'parcial' } })).status, 404);
  const off = await paga(`/api/funder/cases/${c.id}/offers`, { method: 'POST', body: { amount: 2500, coverage: 'parcial', message: 'Cubrimos materiales' } });
  assert.equal(off.status, 201);

  // La persona ve la oferta y los programas que le aplican
  const mine = await necesita('/api/quotes');
  const q = mine.json.quotes.find(x => x.id === c.id);
  assert.equal(q.offers.length, 1);
  assert.equal(q.offers[0].org_name, 'Fundación Uno');
  const progIds = q.programs.map(p => p.id);
  assert.ok(progIds.includes('hap') && progIds.includes('idhs') && progIds.includes('cha'));

  // Otra persona no puede aceptar ofertas ajenas
  assert.equal((await client()(`/api/quotes/${c.id}/offers/${off.json.offer.id}/accept`, { method: 'POST' })).status, 401);
  const intruso = client();
  await intruso('/api/auth/register', { method: 'POST', body: { name: 'Intruso', email: 'intruso@example.com', password: 'frase del intruso' } });
  assert.equal((await intruso(`/api/quotes/${c.id}/offers/${off.json.offer.id}/accept`, { method: 'POST' })).status, 404);

  const acc = await necesita(`/api/quotes/${c.id}/offers/${off.json.offer.id}/accept`, { method: 'POST' });
  assert.equal(acc.json.offer.status, 'aceptada');
  const offers = await paga('/api/funder/offers');
  assert.equal(offers.json.offers[0].status, 'aceptada');
  assert.equal((await admin('/api/admin/stats')).json.pledged, 2500);

  // Estimado y programas públicos
  const est = await client()('/api/estimate?product=u&finish=aluminio&rise=30');
  assert.ok(est.json.low > 0);
  assert.ok((await client()('/api/programs')).json.programs.length >= 6);
});
