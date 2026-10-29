/* Utilidades compartidas: datos del negocio, llamadas a la API, encabezado y pie de página.
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
  if (!res.ok) throw new ApiError(data.error || 'Ocurrió un error. Intente de nuevo.', res.status, data.fields);
  return data;
}

let mePromise;
function getMe() {
  if (!mePromise) mePromise = api('/auth/me').then(d => d.user || null).catch(() => null);
  return mePromise;
}

// Solo permite redirigir a rutas del propio sitio.
function safeNext(value, fallback = '/panel') {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

async function requireLogin() {
  const user = await getMe();
  if (!user) {
    location.href = '/entrar?next=' + encodeURIComponent(location.pathname + location.search);
    return null;
  }
  return user;
}

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignorar */ }
  location.href = '/';
}

/* ---------- Formularios ---------- */

function formData(form) {
  const out = {};
  for (const [k, v] of new FormData(form).entries()) out[k] = typeof v === 'string' ? v.trim() : v;
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
    const input = form.elements[name];
    if (!input || !input.closest) continue;
    const field = input.closest('.field');
    if (!field) continue;
    field.classList.add('invalid');
    const id = `${name}-err`;
    field.append(el('span', { class: 'err', id, text: msg }));
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

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

function loadingNode(text = 'Cargando…') {
  return el('div', { class: 'loading', role: 'status' }, el('span', { class: 'spinner', 'aria-hidden': 'true' }), text);
}

function errorNode(message, retry) {
  return el('div', { class: 'alert alert-bad', role: 'alert' }, message, ' ',
    retry ? el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: retry, text: 'Intentar de nuevo' }) : null);
}

/* ---------- Encabezado y pie ---------- */

function renderHeader() {
  const host = document.getElementById('site-header');
  if (!host) return;
  const links = el('ul', { class: 'nav-links', id: 'nav-links' },
    el('li', {}, el('a', { href: '/#modelos', text: 'Modelos' })),
    el('li', {}, el('a', { href: '/#disenos', text: 'Diseños' })),
    el('li', {}, el('a', { href: '/#proceso', text: 'Cómo funciona' })),
    el('li', {}, el('a', { href: '/#seccion-8', text: 'Sección 8' })),
    el('li', {}, el('a', { href: '/guia', text: 'Guía y calculadora' })),
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
    el('a', { class: 'brand', href: '/' }, el('img', { src: '/img/favicon.svg', alt: '', width: 36, height: 36 }), SITE.name),
    toggle, links));

  getMe().then(user => {
    if (user) {
      authSlot.append(...[
        user.role === 'admin' ? el('a', { href: '/admin', text: 'Administración' }) : null,
        el('a', { href: '/panel', text: 'Mi panel' }),
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: logout, text: 'Salir' }),
      ].filter(Boolean));
    } else {
      authSlot.append(
        el('a', { href: '/entrar', text: 'Entrar' }),
        el('a', { class: 'btn btn-small btn-primary', href: '/cotizar', text: 'Cotización gratis' }),
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
        el('a', { class: 'brand', href: '/' }, el('img', { src: '/img/favicon.svg', alt: '', width: 32, height: 32 }), SITE.name),
        el('p', { class: 'muted', text: 'Diseño, permisos e instalación de rampas accesibles en ' + SITE.area + '.' })),
      el('div', {}, el('h3', { text: 'Servicio' }), el('ul', {},
        el('li', {}, el('a', { href: '/#modelos', text: 'Modelos de rampa' })),
        el('li', {}, el('a', { href: '/#disenos', text: 'Diseños y acabados' })),
        el('li', {}, el('a', { href: '/#seccion-8', text: 'Ayuda para Sección 8' })),
        el('li', {}, el('a', { href: '/guia', text: 'Guía y calculadora' })))),
      el('div', {}, el('h3', { text: 'Cuenta' }), el('ul', {},
        el('li', {}, el('a', { href: '/cotizar', text: 'Pedir cotización' })),
        el('li', {}, el('a', { href: '/panel', text: 'Mis solicitudes' })),
        el('li', {}, el('a', { href: '/registro', text: 'Crear cuenta' })))),
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
  document.querySelectorAll('[data-site="phone"]').forEach(n => { n.textContent = SITE.phone; });
  document.querySelectorAll('[data-site="email"]').forEach(n => { n.textContent = SITE.email; });
});
