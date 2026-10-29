document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('quotes-root');
  const user = await requireLogin();
  if (!user) return;
  if (user.role === 'funder') { location.replace('/financiar'); return; }

  document.getElementById('hello').textContent = 'Hola, ' + user.name.split(' ')[0];

  let cat = null;
  let page = 1;
  const nameOf = (list, id) => ((cat && cat[list].find(x => x.id === id)) || { name: id }).name;
  const cancellable = ['nuevo', 'revision', 'visita', 'cotizada'];
  const flow = ['nuevo', 'revision', 'visita', 'cotizada', 'aceptada', 'instalacion', 'completada'];

  function timeline(status) {
    const idx = flow.indexOf(status);
    return el('ol', { class: 'timeline', 'aria-label': 'Avance de la solicitud' },
      flow.map((s, i) => el('li', { class: status === 'cancelada' ? '' : i < idx ? 'done' : i === idx ? 'now' : '', 'aria-current': i === idx ? 'step' : null, text: nameOf('statuses', s) })));
  }

  function offerRow(q, o) {
    const actions = el('div', { class: 'row' });
    if (o.status === 'pendiente') {
      const accept = el('button', { type: 'button', class: 'btn btn-small btn-primary', text: 'Aceptar' });
      const decline = el('button', { type: 'button', class: 'btn btn-small btn-ghost', text: 'No, gracias' });
      const act = async (action, btn) => {
        busy(btn, true, '…');
        try {
          await api(`/quotes/${q.id}/offers/${o.id}/${action}`, { method: 'POST' });
          toast(action === 'accept' ? 'Oferta aceptada. Te contactaremos para coordinar la obra.' : 'Oferta rechazada.');
          load();
        } catch (err) { toast(err.message, 'bad'); busy(btn, false); }
      };
      accept.addEventListener('click', () => act('accept', accept));
      decline.addEventListener('click', () => act('decline', decline));
      actions.append(accept, decline);
    } else {
      actions.append(el('span', { class: `pill pill-${o.status === 'aceptada' ? 'aceptada' : 'cancelada'}`, text: nameOf('offerStatuses', o.status) }));
    }
    return el('div', { class: 'offer-row' },
      el('div', { class: 'stack' },
        el('strong', { text: `${o.org_name} ofrece ${money(o.amount)} (${nameOf('coverages', o.coverage).toLowerCase()})` }),
        o.message ? el('span', { class: 'small muted', text: `“${o.message}”` }) : null),
      actions);
  }

  function shareToggle(q) {
    const box = el('input', { type: 'checkbox', id: `share-${q.id}` });
    box.checked = !!q.share_consent;
    box.addEventListener('change', async () => {
      try {
        await api(`/quotes/${q.id}/share`, { method: 'POST', body: { share: box.checked } });
        toast(box.checked ? 'Tu caso ahora es visible para financiadores verificados (sin tus datos personales).' : 'Tu caso ya no se comparte con financiadores.');
      } catch (err) { box.checked = !box.checked; toast(err.message, 'bad'); }
    });
    return el('label', { class: 'check', for: `share-${q.id}` }, box, el('span', { text: 'Compartir mi caso con financiadores verificados (sin nombre, dirección ni teléfono)' }));
  }

  function quoteCard(q) {
    const accepted = (q.offers || []).filter(o => o.status === 'aceptada').reduce((s, o) => s + o.amount, 0);
    const open = cancellable.includes(q.status);
    const card = el('article', { class: 'quote' },
      el('div', { class: 'quote-top' },
        el('h2', { class: 'h3-like', text: `Solicitud #${q.id} · ${nameOf('products', q.product)}` }),
        el('span', { class: `pill pill-${q.status}`, text: nameOf('statuses', q.status) })),
      timeline(q.status),
      el('dl', {},
        el('div', {}, el('dt', { text: 'Estimado' }), el('dd', { text: q.est_low ? `${money(q.est_low)} – ${money(q.est_high)}` : 'Después de la visita' })),
        el('div', {}, el('dt', { text: 'Acabado' }), el('dd', { text: nameOf('finishes', q.finish) })),
        el('div', {}, el('dt', { text: 'Altura' }), el('dd', { text: `${q.rise_in} pulgadas` })),
        el('div', {}, el('dt', { text: 'Dirección' }), el('dd', { text: `${q.address}, ${q.zip}` })),
        el('div', {}, el('dt', { text: 'Enviada' }), el('dd', { text: fmtDate(q.created_at) }))),
      q.admin_note ? el('p', { class: 'alert alert-info' }, el('strong', { text: 'Mensaje de Rampa Fácil: ' }), q.admin_note) : null);

    // Quién puede pagar
    const pay = el('div', { class: 'offer-box' },
      el('strong', { text: '¿Quién puede pagar tu rampa?' }),
      el('div', { class: 'prog-chips' }, (q.programs || []).map(p => el('a', { href: `/ayuda#${p.id}`, text: p.name }))));
    if (q.est_high && accepted) {
      const pct = Math.min(100, Math.round((accepted / q.est_high) * 100));
      pay.append(el('div', { class: 'stack' },
        el('span', { class: 'small', text: `Comprometido por financiadores: ${money(accepted)} (aprox. ${pct}% del estimado alto)` }),
        el('div', { class: 'meter', role: 'img', 'aria-label': `${pct}% cubierto` }, el('span', { style: null }))));
      pay.querySelector('.meter span').style.width = pct + '%';
    }
    if ((q.offers || []).length) pay.append(el('strong', { text: 'Ofertas de financiamiento' }), ...q.offers.map(o => offerRow(q, o)));
    else if (q.share_consent && open) pay.append(el('span', { class: 'small muted', text: 'Tu caso está visible para financiadores verificados. Aquí verás sus ofertas.' }));
    if (open) pay.append(shareToggle(q));
    card.append(pay);

    if (open) {
      const btn = el('button', { type: 'button', class: 'btn btn-small btn-danger', text: 'Cancelar solicitud' });
      const confirmRow = el('div', { class: 'row hidden' },
        el('span', { text: '¿Seguro que deseas cancelarla?' }),
        el('button', { type: 'button', class: 'btn btn-small btn-danger', text: 'Sí, cancelar', onclick: async e => {
          const b = e.currentTarget;
          busy(b, true, 'Cancelando…');
          try {
            await api(`/quotes/${q.id}/cancel`, { method: 'POST' });
            toast('Solicitud cancelada.');
            await load();
          } catch (err) {
            busy(b, false);
            toast(err.message, 'bad');
          }
        } }),
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', text: 'No', onclick: () => { confirmRow.classList.add('hidden'); btn.classList.remove('hidden'); } }));
      btn.addEventListener('click', () => { btn.classList.add('hidden'); confirmRow.classList.remove('hidden'); });
      card.append(el('div', { class: 'row' }, btn, confirmRow));
    }
    return card;
  }

  async function load() {
    root.replaceChildren(loadingNode('Cargando tus solicitudes…'));
    try {
      if (!cat) cat = await api('/catalog');
      const data = await api(`/quotes?page=${page}`);
      const nodes = [];
      if (new URLSearchParams(location.search).get('nueva') && page === 1) {
        nodes.push(el('div', { class: 'banner', role: 'status' },
          el('span', { 'aria-hidden': 'true', text: '🎉' }),
          el('div', { class: 'stack' },
            el('strong', { text: 'Recibimos tu solicitud.' }),
            el('span', { text: 'Te contactaremos en un día hábil para programar la visita gratis. Mientras tanto, revisa abajo los programas que pueden pagar tu rampa.' }))));
      }
      if (!data.quotes.length && page === 1) {
        nodes.push(el('div', { class: 'empty' },
          el('h2', { text: 'Todavía no tienes solicitudes' }),
          el('p', { class: 'muted', text: 'Pide tu rampa gratis. Toma unos 3 minutos y te decimos quién te la puede pagar.' }),
          el('a', { class: 'btn btn-signal', href: '/cotizar', text: 'Pedir mi rampa' })));
      } else {
        nodes.push(el('div', { class: 'quote-list' }, data.quotes.map(quoteCard)));
        nodes.push(el('div', { class: 'row' },
          page > 1 ? el('button', { type: 'button', class: 'btn btn-small btn-ghost', text: 'Anteriores', onclick: () => { page--; load(); } }) : null,
          data.hasMore ? el('button', { type: 'button', class: 'btn btn-small btn-ghost', text: 'Más antiguas', onclick: () => { page++; load(); } }) : null));
      }
      root.replaceChildren(...nodes);
    } catch (err) {
      root.replaceChildren(errorNode(err.message, load));
    }
  }
  load();
});
