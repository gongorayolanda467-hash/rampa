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

  for (const p of ['/guia', '/entrar', '/registro', '/cotizar', '/panel', '/privacidad', '/terminos']) {
    assert.equal((await c(p)).status, 200, p);
  }
  const missing = await c('/no-existe');
  assert.equal(missing.status, 404);
  assert.match(missing.text, /No encontramos esta página/);
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
