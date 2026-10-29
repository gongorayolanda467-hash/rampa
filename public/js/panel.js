document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('quotes-root');
  const user = await requireLogin();
  if (!user) return;

  document.getElementById('hello').textContent = 'Hola, ' + user.name.split(' ')[0];

  let cat = null;
  let page = 1;
  const nameOf = (list, id) => ((cat && cat[list].find(x => x.id === id)) || { name: id }).name;
  const cancellable = ['nuevo', 'revision', 'visita', 'cotizada'];

  function quoteCard(q) {
    const status = el('span', { class: `pill pill-${q.status}`, text: nameOf('statuses', q.status) });
    const card = el('article', { class: 'quote' },
      el('div', { class: 'quote-top' },
        el('h2', { class: 'h3-like' }, el('span', { text: `Solicitud #${q.id} · ${nameOf('products', q.product)}` })),
        status),
      el('dl', {},
        el('div', {}, el('dt', { text: 'Acabado' }), el('dd', { text: nameOf('finishes', q.finish) })),
        el('div', {}, el('dt', { text: 'Altura' }), el('dd', { text: `${q.rise_in} pulgadas` })),
        el('div', {}, el('dt', { text: 'Dirección' }), el('dd', { text: `${q.address}, ${q.zip}` })),
        el('div', {}, el('dt', { text: 'Enviada' }), el('dd', { text: fmtDate(q.created_at) }))),
      q.admin_note ? el('p', { class: 'alert alert-info' }, el('strong', { text: 'Mensaje de Rampa Fácil: ' }), q.admin_note) : null);

    if (cancellable.includes(q.status)) {
      const btn = el('button', { type: 'button', class: 'btn btn-small btn-danger', text: 'Cancelar solicitud' });
      const confirmRow = el('div', { class: 'row hidden' },
        el('span', { text: '¿Seguro que desea cancelarla?' }),
        el('button', { type: 'button', class: 'btn btn-small btn-danger', text: 'Sí, cancelar', onclick: async e => {
          const b = e.currentTarget;
          busy(b, true, 'Cancelando…');
          try {
            await api(`/quotes/${q.id}/cancel`, { method: 'POST' });
            await load();
          } catch (err) {
            busy(b, false);
            confirmRow.append(el('span', { class: 'err', text: err.message }));
          }
        } }),
        el('button', { type: 'button', class: 'btn btn-small btn-ghost', text: 'No', onclick: () => { confirmRow.classList.add('hidden'); btn.classList.remove('hidden'); } }));
      btn.addEventListener('click', () => { btn.classList.add('hidden'); confirmRow.classList.remove('hidden'); });
      card.append(el('div', { class: 'row' }, btn, confirmRow));
    }
    return card;
  }

  async function load() {
    root.replaceChildren(loadingNode('Cargando sus solicitudes…'));
    try {
      if (!cat) cat = await api('/catalog');
      const data = await api(`/quotes?page=${page}`);
      const nodes = [];
      if (new URLSearchParams(location.search).get('nueva') && page === 1) {
        nodes.push(el('p', { class: 'alert alert-ok', role: 'status', text: 'Recibimos su solicitud. Le contactaremos en un día hábil para programar la visita.' }));
      }
      if (!data.quotes.length && page === 1) {
        nodes.push(el('div', { class: 'empty' },
          el('h2', { text: 'Todavía no tiene solicitudes' }),
          el('p', { class: 'muted', text: 'Pida su cotización gratis. Toma unos 3 minutos.' }),
          el('a', { class: 'btn btn-primary', href: '/cotizar', text: 'Pedir cotización' })));
      } else {
        nodes.push(el('div', { class: 'quote-list' }, data.quotes.map(quoteCard)));
        const pager = el('div', { class: 'row' },
          page > 1 ? el('button', { type: 'button', class: 'btn btn-small btn-ghost', text: 'Anteriores', onclick: () => { page--; load(); } }) : null,
          data.hasMore ? el('button', { type: 'button', class: 'btn btn-small btn-ghost', text: 'Más antiguas', onclick: () => { page++; load(); } }) : null);
        nodes.push(pager);
      }
      root.replaceChildren(...nodes);
    } catch (err) {
      root.replaceChildren(errorNode(err.message, load));
    }
  }
  load();
});
