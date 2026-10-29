document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('admin-root');
  const user = await requireLogin();
  if (!user) return;
  if (user.role !== 'admin') {
    root.replaceChildren(el('div', { class: 'empty' },
      el('h2', { text: 'No tiene acceso a esta sección' }),
      el('p', { class: 'muted', text: 'Esta página es solo para el equipo de Rampa Fácil.' }),
      el('a', { class: 'btn btn-primary', href: '/panel', text: 'Ir a mi panel' })));
    return;
  }

  let cat;
  const state = { tab: 'quotes', status: '', page: 1 };
  const nameOf = (list, id) => ((cat[list].find(x => x.id === id)) || { name: id || '—' }).name;

  const statsBox = el('div', { class: 'stats' });
  const tabs = el('div', { class: 'tabs', role: 'tablist' });
  const filter = el('select', { id: 'status-filter', 'aria-label': 'Filtrar por estado' });
  const toolbar = el('div', { class: 'row' }, el('label', { for: 'status-filter', text: 'Estado:' }), filter);
  const list = el('div', { 'aria-live': 'polite' });

  async function loadStats() {
    try {
      const s = await api('/admin/stats');
      const count = id => (s.byStatus.find(r => r.status === id) || { n: 0 }).n;
      const stat = (n, k) => el('div', { class: 'stat' }, el('span', { class: 'n', text: String(n) }), el('span', { class: 'k', text: k }));
      statsBox.replaceChildren(
        stat(count('nuevo'), 'Nuevas'),
        stat(count('revision') + count('visita') + count('cotizada'), 'En proceso'),
        stat(count('aceptada') + count('instalacion'), 'Por instalar'),
        stat(count('completada'), 'Completadas'),
        stat(s.clients, 'Clientes'),
        stat(s.leads, 'Mensajes'));
    } catch (err) {
      statsBox.replaceChildren(errorNode(err.message, loadStats));
    }
  }

  function quoteRow(q) {
    const sel = el('select', { id: `st-${q.id}`, name: 'status' });
    fillSelect(sel, cat.statuses);
    sel.value = q.status;
    const note = el('input', { id: `nt-${q.id}`, name: 'admin_note', maxlength: 2000, placeholder: 'Mensaje visible para el cliente' });
    note.value = q.admin_note || '';
    const msg = el('span', { class: 'small', role: 'status' });
    const save = el('button', { type: 'button', class: 'btn btn-small btn-primary', text: 'Guardar' });
    save.addEventListener('click', async () => {
      busy(save, true, 'Guardando…');
      msg.textContent = '';
      try {
        await api(`/admin/quotes/${q.id}`, { method: 'PATCH', body: { status: sel.value, admin_note: note.value.trim() } });
        msg.textContent = 'Guardado';
        loadStats();
      } catch (err) {
        msg.textContent = err.message;
      } finally {
        busy(save, false);
      }
    });
    return el('article', { class: 'quote' },
      el('div', { class: 'quote-top' },
        el('h2', { class: 'h3-like', text: `#${q.id} · ${q.client_name}` }),
        el('span', { class: `pill pill-${q.status}`, text: nameOf('statuses', q.status) })),
      el('dl', {},
        el('div', {}, el('dt', { text: 'Contacto' }), el('dd', { text: [q.client_email, q.client_phone].filter(Boolean).join(' · ') })),
        el('div', {}, el('dt', { text: 'Prefiere' }), el('dd', { text: nameOf('contactPrefs', q.contact_pref) })),
        el('div', {}, el('dt', { text: 'Dirección' }), el('dd', { text: `${q.address}, ${q.zip}` })),
        el('div', {}, el('dt', { text: 'Modelo y acabado' }), el('dd', { text: `${nameOf('products', q.product)} · ${nameOf('finishes', q.finish)}` })),
        el('div', {}, el('dt', { text: 'Altura' }), el('dd', { text: `${q.rise_in} pulgadas` })),
        el('div', {}, el('dt', { text: 'Usuario' }), el('dd', { text: nameOf('mobility', q.mobility) })),
        el('div', {}, el('dt', { text: 'Vivienda' }), el('dd', { text: nameOf('housing', q.housing) })),
        el('div', {}, el('dt', { text: 'Recibida' }), el('dd', { text: fmtDate(q.created_at) }))),
      q.notes ? el('p', {}, el('strong', { text: 'Notas: ' }), q.notes) : null,
      el('div', { class: 'admin-edit' },
        el('div', { class: 'field' }, el('label', { for: `st-${q.id}`, text: 'Estado' }), sel),
        el('div', { class: 'field' }, el('label', { for: `nt-${q.id}`, text: 'Mensaje al cliente' }), note),
        el('div', { class: 'row' }, save, msg)));
  }

  function leadRow(l) {
    return el('article', { class: 'quote' },
      el('div', { class: 'quote-top' },
        el('h2', { class: 'h3-like', text: l.name }),
        el('span', { class: 'small muted', text: fmtDate(l.created_at) })),
      el('dl', {},
        el('div', {}, el('dt', { text: 'Correo' }), el('dd', { text: l.email })),
        el('div', {}, el('dt', { text: 'Teléfono' }), el('dd', { text: l.phone || '—' })),
        el('div', {}, el('dt', { text: 'Código postal' }), el('dd', { text: l.zip || '—' }))),
      el('p', { text: l.message }));
  }

  async function loadList() {
    list.replaceChildren(loadingNode());
    try {
      const isQuotes = state.tab === 'quotes';
      const q = isQuotes ? `/admin/quotes?page=${state.page}${state.status ? '&status=' + encodeURIComponent(state.status) : ''}` : `/admin/leads?page=${state.page}`;
      const data = await api(q);
      const items = isQuotes ? data.quotes : data.leads;
      if (!items.length) {
        list.replaceChildren(el('div', { class: 'empty' }, el('p', { class: 'muted', text: isQuotes ? 'No hay solicitudes con este filtro.' : 'Todavía no hay mensajes.' })));
        return;
      }
      list.replaceChildren(
        el('div', { class: 'quote-list' }, items.map(isQuotes ? quoteRow : leadRow)),
        el('div', { class: 'row' },
          state.page > 1 ? el('button', { type: 'button', class: 'btn btn-small btn-ghost', text: 'Anterior', onclick: () => { state.page--; loadList(); } }) : null,
          data.hasMore ? el('button', { type: 'button', class: 'btn btn-small btn-ghost', text: 'Siguiente', onclick: () => { state.page++; loadList(); } }) : null));
    } catch (err) {
      list.replaceChildren(errorNode(err.message, loadList));
    }
  }

  function tab(id, label) {
    const b = el('button', { type: 'button', role: 'tab', class: 'btn btn-small btn-ghost', 'aria-selected': String(state.tab === id), text: label });
    b.addEventListener('click', () => {
      state.tab = id; state.page = 1;
      tabs.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      toolbar.classList.toggle('hidden', id !== 'quotes');
      loadList();
    });
    return b;
  }

  try {
    cat = await api('/catalog');
  } catch (err) {
    root.replaceChildren(errorNode(err.message, () => location.reload()));
    return;
  }
  fillSelect(filter, cat.statuses, 'Todos');
  filter.addEventListener('change', () => { state.status = filter.value; state.page = 1; loadList(); });
  tabs.append(tab('quotes', 'Solicitudes'), tab('leads', 'Mensajes de contacto'));
  root.replaceChildren(statsBox, tabs, toolbar, el('div', { class: 'spacer' }), list);
  loadStats();
  loadList();
});
