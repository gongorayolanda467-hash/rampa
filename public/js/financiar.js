// Panel de financiadores: casos, ofertas y perfil.
document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('funder-root');
  const user = await requireLogin('funder');
  if (!user) return;
  if (user.role === 'admin') {
    root.replaceChildren(el('p', { class: 'alert alert-info', text: 'Esta es la vista de financiadores. Como administradora, verifica cuentas desde Administración.' }));
    return;
  }

  let cat;
  try { cat = await api('/catalog'); } catch (err) { root.replaceChildren(errorNode(err.message, () => location.reload())); return; }
  const nameOf = (list, id) => (cat[list].find(x => x.id === id) || { name: id || '—' }).name;
  const state = { tab: 'cases', match: false, page: 1 };
  let profile = user.funder;
  document.getElementById('org-title').textContent = profile ? profile.org_name : 'Casos para financiar';

  const tabs = el('div', { class: 'tabs', role: 'tablist' });
  const body = el('div', { 'aria-live': 'polite' });

  function tab(id, label) {
    const b = el('button', { type: 'button', role: 'tab', class: 'btn btn-small btn-ghost', 'aria-selected': String(state.tab === id), text: label });
    b.addEventListener('click', () => {
      state.tab = id; state.page = 1;
      tabs.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      render();
    });
    return b;
  }

  function pendingBanner() {
    return el('div', { class: 'banner' },
      el('span', { 'aria-hidden': 'true', text: '⏳' }),
      el('div', { class: 'stack' },
        el('strong', { text: 'Tu cuenta está en revisión' }),
        el('span', { text: 'Verificamos cada financiador antes de mostrarle casos, para proteger a las familias. Mientras tanto, completa tu perfil: zona, tipos de vivienda y monto máximo.' })));
  }

  /* ---------- Casos ---------- */
  function offerForm(c) {
    const f = el('form', { class: 'form', novalidate: true });
    const amount = el('input', { id: `amt-${c.id}`, name: 'amount', type: 'number', min: 50, step: 50, required: true, inputmode: 'numeric' });
    amount.value = c.my_offer ? c.my_offer.amount : (profile && profile.max_amount ? Math.min(profile.max_amount, c.est_high) : c.est_low);
    const cov = el('div', { class: 'segmented' }, choiceGroup('coverage', cat.coverages, { checked: x => x.id === (c.my_offer ? c.my_offer.coverage : 'parcial') }));
    const msg = el('input', { id: `msg-${c.id}`, name: 'message', maxlength: 1000, placeholder: 'Ej.: Cubrimos materiales y mano de obra' });
    if (c.my_offer && c.my_offer.message) msg.value = c.my_offer.message;
    const send = el('button', { type: 'submit', class: 'btn btn-primary', text: c.my_offer ? 'Actualizar oferta' : 'Ofrecer financiamiento' });
    f.append(
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: `amt-${c.id}`, text: 'Monto (dólares)' }), amount),
        el('div', { class: 'field' }, el('span', { class: 'label', text: 'Tipo de pago' }), cov)),
      el('div', { class: 'field' }, el('label', { for: `msg-${c.id}`, text: 'Mensaje para la persona (opcional)' }), msg),
      el('div', { 'data-status': true, class: 'hidden' }),
      send);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      clearErrors(f);
      busy(send, true);
      try {
        await api(`/funder/cases/${c.id}/offers`, { method: 'POST', body: formData(f) });
        toast('Oferta enviada. La persona la verá en su panel.');
        render();
      } catch (err) { showErrors(f, err); busy(send, false); }
    });
    return f;
  }

  function caseCard(c) {
    const flags = [c.low_income && 'Ingresos bajos', c.medicaid && 'Medicaid', c.veteran && 'Veterano'].filter(Boolean);
    const covered = c.est_high ? Math.min(100, Math.round((c.pledged / c.est_high) * 100)) : 0;
    const meter = el('div', { class: 'meter', role: 'img', 'aria-label': `${covered}% comprometido` }, el('span'));
    meter.firstChild.style.width = covered + '%';
    const card = el('article', { class: 'quote' },
      el('div', { class: 'quote-top' },
        el('h2', { class: 'h3-like', text: `Caso #${c.id} · ${nameOf('products', c.product)}` }),
        el('span', { class: 'tag y', text: `${money(c.est_low)} – ${money(c.est_high)}` })),
      el('dl', {},
        el('div', {}, el('dt', { text: 'Código postal' }), el('dd', { text: c.zip })),
        el('div', {}, el('dt', { text: 'Altura de la entrada' }), el('dd', { text: `${c.rise_in} pulgadas` })),
        el('div', {}, el('dt', { text: 'Usuario' }), el('dd', { text: nameOf('mobility', c.mobility) })),
        el('div', {}, el('dt', { text: 'Vivienda' }), el('dd', { text: nameOf('housing', c.housing) })),
        el('div', {}, el('dt', { text: 'Acabado' }), el('dd', { text: nameOf('finishes', c.finish) })),
        el('div', {}, el('dt', { text: 'Publicado' }), el('dd', { text: fmtDate(c.created_at) }))),
      flags.length ? el('div', { class: 'prog-chips' }, flags.map(t => el('span', { text: t }))) : null,
      el('div', { class: 'stack' }, el('span', { class: 'small muted', text: `Comprometido: ${money(c.pledged)} · ${c.offers_count} oferta(s)` }), meter));
    if (c.my_offer && c.my_offer.status === 'aceptada') {
      card.append(el('p', { class: 'alert alert-ok', text: `Tu oferta de ${money(c.my_offer.amount)} fue aceptada. Te contactaremos para coordinar el pago.` }));
    } else {
      const toggle = el('button', { type: 'button', class: 'btn btn-signal', text: c.my_offer ? 'Editar mi oferta' : 'Quiero ayudar con este caso' });
      const wrap = el('div', { class: 'hidden' }, offerForm(c));
      toggle.addEventListener('click', () => { wrap.classList.toggle('hidden'); toggle.classList.toggle('hidden'); });
      card.append(toggle, wrap);
    }
    return card;
  }

  async function renderCases() {
    const matchBox = el('input', { type: 'checkbox', id: 'match' });
    matchBox.checked = state.match;
    matchBox.addEventListener('change', () => { state.match = matchBox.checked; state.page = 1; renderCases(); });
    const toolbar = el('div', { class: 'toggle-row' }, el('label', { class: 'check', for: 'match' }, matchBox, el('span', { text: 'Solo casos de mi zona y tipos de vivienda' })));
    body.replaceChildren(toolbar, loadingNode());
    try {
      const data = await api(`/funder/cases?page=${state.page}${state.match ? '&match=1' : ''}`);
      if (!data.cases.length) {
        body.replaceChildren(toolbar, el('div', { class: 'empty' },
          el('h2', { text: 'No hay casos con este filtro' }),
          el('p', { class: 'muted', text: state.match ? 'Quita el filtro o amplía tu zona en tu perfil.' : 'Cuando una persona comparta su caso, aparecerá aquí.' })));
        return;
      }
      body.replaceChildren(toolbar, el('p', { class: 'muted', text: `${data.total} caso(s) disponibles` }),
        el('div', { class: 'quote-list' }, data.cases.map(caseCard)),
        el('div', { class: 'row' },
          state.page > 1 ? el('button', { type: 'button', class: 'btn btn-small btn-ghost', text: 'Anteriores', onclick: () => { state.page--; renderCases(); } }) : null,
          data.hasMore ? el('button', { type: 'button', class: 'btn btn-small btn-ghost', text: 'Más casos', onclick: () => { state.page++; renderCases(); } }) : null));
    } catch (err) {
      if (err.data && err.data.pending) body.replaceChildren(pendingBanner());
      else body.replaceChildren(errorNode(err.message, renderCases));
    }
  }

  /* ---------- Mis ofertas ---------- */
  async function renderOffers() {
    body.replaceChildren(loadingNode());
    try {
      const { offers } = await api('/funder/offers');
      if (!offers.length) {
        body.replaceChildren(el('div', { class: 'empty' }, el('h2', { text: 'Aún no has hecho ofertas' }), el('p', { class: 'muted', text: 'Elige un caso en la pestaña Casos y ofrece pago total o parcial.' })));
        return;
      }
      const accepted = offers.filter(o => o.status === 'aceptada').reduce((s, o) => s + o.amount, 0);
      body.replaceChildren(
        el('div', { class: 'stats' },
          el('div', { class: 'stat' }, el('span', { class: 'n', text: money(accepted) }), el('span', { class: 'k', text: 'Comprometido y aceptado' })),
          el('div', { class: 'stat' }, el('span', { class: 'n', text: String(offers.filter(o => o.status === 'aceptada').length) }), el('span', { class: 'k', text: 'Rampas que apoyas' })),
          el('div', { class: 'stat' }, el('span', { class: 'n', text: String(offers.filter(o => o.status === 'pendiente').length) }), el('span', { class: 'k', text: 'Esperando respuesta' }))),
        el('div', { class: 'quote-list' }, offers.map(o => {
          const row = el('article', { class: 'quote' },
            el('div', { class: 'quote-top' },
              el('h2', { class: 'h3-like', text: `Caso #${o.quote_id} · ${nameOf('products', o.product)} · ${o.zip}` }),
              el('span', { class: `pill pill-${o.status === 'aceptada' ? 'aceptada' : o.status === 'pendiente' ? 'nuevo' : 'cancelada'}`, text: nameOf('offerStatuses', o.status) })),
            el('p', { text: `${money(o.amount)} · ${nameOf('coverages', o.coverage)} · Obra: ${nameOf('statuses', o.quote_status)}` }));
          if (o.status === 'pendiente') {
            const w = el('button', { type: 'button', class: 'btn btn-small btn-ghost', text: 'Retirar oferta' });
            w.addEventListener('click', async () => {
              busy(w, true, '…');
              try { await api(`/funder/offers/${o.id}/withdraw`, { method: 'POST' }); toast('Oferta retirada.'); renderOffers(); } catch (err) { toast(err.message, 'bad'); busy(w, false); }
            });
            row.append(w);
          }
          return row;
        })));
    } catch (err) { body.replaceChildren(errorNode(err.message, renderOffers)); }
  }

  /* ---------- Perfil ---------- */
  function renderProfile() {
    const p = profile || {};
    const f = el('form', { class: 'card form', novalidate: true });
    const kind = el('select', { id: 'p-kind', name: 'kind' });
    fillSelect(kind, cat.funderKinds);
    kind.value = p.kind || 'ong';
    const housingSel = (p.housing || '').split(',');
    f.append(
      el('h2', { class: 'h3-like', text: 'Perfil de financiador' }),
      p.verified ? el('p', { class: 'alert alert-ok', text: 'Cuenta verificada' }) : el('p', { class: 'alert alert-info', text: 'Cuenta en revisión' }),
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'p-org', text: 'Nombre de la organización' }), Object.assign(el('input', { id: 'p-org', name: 'org_name', maxlength: 120, required: true }), { value: p.org_name || '' })),
        el('div', { class: 'field' }, el('label', { for: 'p-kind', text: 'Tipo' }), kind),
        el('div', { class: 'field' }, el('label', { for: 'p-zips', text: 'Códigos postales donde quiere ayudar' }), Object.assign(el('input', { id: 'p-zips', name: 'zips', maxlength: 400, placeholder: '60608, 60623, 60632' }), { value: p.zips || '' }), el('span', { class: 'hint', text: 'Déjelo vacío para toda la zona de servicio.' })),
        el('div', { class: 'field' }, el('label', { for: 'p-max', text: 'Monto máximo por caso (dólares)' }), Object.assign(el('input', { id: 'p-max', name: 'max_amount', type: 'number', min: 0, step: 50 }), { value: p.max_amount ?? '' }))),
      el('fieldset', { class: 'field' }, el('legend', { text: 'Tipos de vivienda que financia' }),
        el('div', { class: 'choices wide' }, choiceGroup('housing', cat.housing, { type: 'checkbox', checked: h => housingSel.includes(h.id) }))),
      el('div', { class: 'field' }, el('label', { for: 'p-about', text: 'Sobre su organización (opcional)' }), Object.assign(el('textarea', { id: 'p-about', name: 'about', maxlength: 1000 }), { value: p.about || '' })),
      el('div', { 'data-status': true, class: 'hidden' }),
      el('button', { type: 'submit', class: 'btn btn-primary', text: 'Guardar perfil' }));
    f.addEventListener('submit', async e => {
      e.preventDefault();
      clearErrors(f);
      const d = formData(f);
      d.housing = d.housing ? [].concat(d.housing) : [];
      const btn = f.querySelector('button[type="submit"]');
      busy(btn, true, 'Guardando…');
      try {
        const res = await api('/funder/profile', { method: 'PUT', body: d });
        profile = res.profile;
        document.getElementById('org-title').textContent = profile.org_name;
        toast('Perfil guardado.');
      } catch (err) { showErrors(f, err); }
      busy(btn, false);
    });
    body.replaceChildren(f);
  }

  function render() {
    if (state.tab === 'cases') renderCases();
    else if (state.tab === 'offers') renderOffers();
    else renderProfile();
  }

  tabs.append(tab('cases', 'Casos'), tab('offers', 'Mis ofertas'), tab('profile', 'Mi perfil'));
  root.replaceChildren(tabs, body);
  render();
});
