/* Utilidades compartidas: datos del negocio, API, encabezado, pie, notificaciones y mejoras de formularios.
   Todo el contenido dinámico se crea con el DOM y textContent, nunca con innerHTML. */

// Datos de contacto del negocio. CAMBIE ESTOS VALORES antes de abrir el sitio al público.
const SITE = {
  name: 'Rampa Fácil',
  phone: '(312) 555-0199',
  email: 'hola@rampafacil.com',
  hours: 'Lunes a sábado, 8:00 a. m. – 6:00 p. m.',
  area: 'Chicago y suburbios del condado de Cook',
};

function el(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No hay conexión. Revise su internet e intente de nuevo.', 0);
  }
  let data = {};
  try { data = await res.json(); } catch { /* respuesta sin JSON */ }
  if (!res.ok) {
    const err = new ApiError(data.error || 'Ocurrió un error. Intente de nuevo.', res.status, data.fields);
    err.data = data;
    throw err;
  }
  return data;
}

let mePromise;
function getMe() {
  if (!mePromise) mePromise = api('/auth/me').then(d => d.user || null).catch(() => null);
  return mePromise;
}

const homeFor = user => (!user ? '/' : user.role === 'admin' ? '/admin' : user.role === 'funder' ? '/financiar' : '/panel');

// Solo permite redirigir a rutas del propio sitio.
function safeNext(value, fallback = '/panel') {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

async function requireLogin(role) {
  const user = await getMe();
  if (!user) {
    location.href = '/entrar?next=' + encodeURIComponent(location.pathname + location.search);
    return null;
  }
  if (role && user.role !== role && user.role !== 'admin') {
    location.href = homeFor(user);
    return null;
  }
  return user;
}

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignorar */ }
  location.href = '/';
}

/* ---------- Notificaciones ---------- */

function toast(message, kind = 'ok') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = el('div', { id: 'toasts', class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  const t = el('div', { class: `toast ${kind}` }, el('span', { text: kind === 'bad' ? '⚠' : '✓', 'aria-hidden': 'true' }), el('span', { text: message }));
  box.append(t);
  setTimeout(() => t.remove(), 5000);
}

/* ---------- Formularios ---------- */

function formData(form) {
  const out = {};
  for (const [k, v] of new FormData(form).entries()) {
    const val = typeof v === 'string' ? v.trim() : v;
    if (k in out) out[k] = [].concat(out[k], val);
    else out[k] = val;
  }
  return out;
}

function clearErrors(form) {
  form.querySelectorAll('.field.invalid').forEach(f => f.classList.remove('invalid'));
  form.querySelectorAll('.err').forEach(e => e.remove());
  const status = form.querySelector('[data-status]');
  if (status) { status.textContent = ''; status.className = 'hidden'; }
}

function showErrors(form, err) {
  for (const [name, msg] of Object.entries(err.fields || {})) {
    let input = form.elements[name];
    if (input && !input.closest && input.length) input = input[0];
    if (!input || !input.closest) continue;
    const field = input.closest('.field');
    if (!field) continue;
    field.classList.add('invalid');
    const id = `${name}-err`;
    if (!field.querySelector(`#${CSS.escape(id)}`)) field.append(el('span', { class: 'err', id, text: msg }));
    input.setAttribute('aria-describedby', id);
  }
  setStatus(form, err.message, 'bad');
  const first = form.querySelector('.field.invalid input, .field.invalid select, .field.invalid textarea');
  if (first) first.focus();
}

function setStatus(form, message, kind) {
  const status = form.querySelector('[data-status]');
  if (!status) return;
  status.textContent = message;
  status.className = `alert alert-${kind}`;
  status.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
}

function busy(button, on, label) {
  if (on) { button.dataset.label = button.textContent; button.textContent = label || 'Enviando…'; button.disabled = true; }
  else { button.textContent = button.dataset.label || button.textContent; button.disabled = false; }
}

function fillSelect(select, items, placeholder) {
  select.replaceChildren();
  if (placeholder) select.append(el('option', { value: '', text: placeholder }));
  for (const item of items) select.append(el('option', { value: item.id, text: item.code && item.code !== '?' ? `${item.code} · ${item.name}` : item.name }));
}

// Grupo de tarjetas seleccionables (radio o checkbox).
function choiceGroup(name, items, { type = 'radio', render, checked } = {}) {
  return items.map(item => {
    const input = el('input', { type, name, value: item.id });
    if (checked && checked(item)) input.checked = true;
    return el('label', { class: 'choice' }, input, ...(render ? render(item) : [el('span', { class: 't', text: item.name })]));
  });
}

const money = n => (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

function loadingNode(text = 'Cargando…') {
  return el('div', { class: 'stack', role: 'status', 'aria-label': text }, el('div', { class: 'skeleton' }), el('div', { class: 'skeleton' }));
}

function errorNode(message, retry) {
  return el('div', { class: 'alert alert-bad', role: 'alert' }, message, ' ',
    retry ? el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: retry, text: 'Intentar de nuevo' }) : null);
}

// Botón para mostrar u ocultar contraseñas.
function enhancePasswords(root = document) {
  root.querySelectorAll('input[type="password"]:not([data-pw])').forEach(input => {
    input.dataset.pw = '1';
    const wrap = el('div', { class: 'pw-wrap' });
    input.replaceWith(wrap);
    const btn = el('button', { type: 'button', class: 'pw-toggle', 'aria-label': 'Mostrar contraseña', text: 'Mostrar' });
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Ocultar' : 'Mostrar';
      btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
    wrap.append(input, btn);
  });
}

// Movimiento suave al entrar en pantalla. El contenido siempre está visible.
function reveal() {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const items = [...document.querySelectorAll('[data-reveal]')];
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach(n => {
    const r = n.getBoundingClientRect();
    if (r.top > innerHeight) { n.classList.add('reveal', 'pre'); io.observe(n); }
  });
}

/* ---------- Encabezado y pie ---------- */

function navLink(href, text) {
  const a = el('a', { href, text });
  const path = location.pathname.replace(/\.html$/, '');
  if (href === path) a.setAttribute('aria-current', 'page');
  return el('li', {}, a);
}

function renderHeader() {
  const host = document.getElementById('site-header');
  if (!host) return;
  const links = el('ul', { class: 'nav-links', id: 'nav-links' },
    navLink('/#como-funciona', 'Cómo funciona'),
    navLink('/ayuda', 'Quién paga mi rampa'),
    navLink('/financiadores', 'Para financiadores'),
    navLink('/guia', 'Guía y calculadora'),
  );
  const authSlot = el('li', { class: 'row' });
  links.append(authSlot);
  const toggle = el('button', { type: 'button', class: 'btn btn-small btn-ghost nav-toggle', 'aria-expanded': 'false', 'aria-controls': 'nav-links', text: 'Menú' });
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  host.className = 'site-header';
  host.replaceChildren(el('nav', { class: 'container nav', 'aria-label': 'Principal' },
    el('a', { class: 'brand', href: '/' }, el('img', { src: '/img/favicon.svg', alt: '', width: 38, height: 38 }), SITE.name),
    toggle, links));

  getMe().then(user => {
    if (user) {
      authSlot.append(...[
        user.role === 'admin' ? el('a', { href: '/admin', text: 'Administración' }) : null,
        el('a', { class: 'btn btn-small btn-primary', href: homeFor(user) === '/admin' ? '/panel' : homeFor(user), text: user.role === 'funder' ? 'Mis casos' : 'Mi panel' }),
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: logout, text: 'Salir' }),
      ].filter(Boolean));
    } else {
      authSlot.append(
        el('a', { href: '/entrar', text: 'Entrar' }),
        el('a', { class: 'btn btn-small btn-signal', href: '/cotizar', text: 'Pedir mi rampa' }),
      );
    }
  });
}

function renderFooter() {
  const host = document.getElementById('site-footer');
  if (!host) return;
  host.className = 'site-footer';
  host.replaceChildren(el('div', { class: 'container' },
    el('div', { class: 'footer-grid' },
      el('div', { class: 'stack' },
        el('a', { class: 'brand', href: '/' }, el('img', { src: '/img/favicon.svg', alt: '', width: 34, height: 34 }), SITE.name),
        el('p', { class: 'muted', text: 'Conectamos a quien necesita una rampa con quien puede pagarla, y la construimos con las normas ADA en ' + SITE.area + '.' })),
      el('div', {}, el('h3', { text: 'Necesito una rampa' }), el('ul', {},
        el('li', {}, el('a', { href: '/cotizar', text: 'Pedir mi rampa' })),
        el('li', {}, el('a', { href: '/ayuda', text: 'Quién paga mi rampa' })),
        el('li', {}, el('a', { href: '/guia', text: 'Guía y calculadora' })),
        el('li', {}, el('a', { href: '/panel', text: 'Mis solicitudes' })))),
      el('div', {}, el('h3', { text: 'Quiero financiar' }), el('ul', {},
        el('li', {}, el('a', { href: '/financiadores', text: 'Cómo funciona para financiadores' })),
        el('li', {}, el('a', { href: '/registro?tipo=funder', text: 'Crear cuenta de financiador' })),
        el('li', {}, el('a', { href: '/financiar', text: 'Casos para financiar' })))),
      el('div', {}, el('h3', { text: 'Contacto' }), el('ul', {},
        el('li', { text: 'Teléfono: ' + SITE.phone }),
        el('li', { text: 'Correo: ' + SITE.email }),
        el('li', { class: 'muted', text: SITE.hours })))),
    el('div', { class: 'footer-bottom' },
      el('span', { text: `© ${new Date().getFullYear()} ${SITE.name}. Todos los derechos reservados.` }),
      el('span', {}, el('a', { href: '/privacidad', text: 'Aviso de privacidad' }), ' · ', el('a', { href: '/terminos', text: 'Términos de uso' })))));
}

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderFooter();
  enhancePasswords();
  reveal();
  if (document.querySelector('.mobile-cta')) document.body.classList.add('has-mobile-cta');
  document.querySelectorAll('[data-site="phone"]').forEach(n => { n.textContent = SITE.phone; });
  document.querySelectorAll('[data-site="email"]').forEach(n => { n.textContent = SITE.email; });
});
