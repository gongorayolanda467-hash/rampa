// Guía "Quién paga mi rampa": elegibilidad en vivo y fichas de cada programa.
document.addEventListener('DOMContentLoaded', async () => {
  const list = document.getElementById('program-list');
  const form = document.getElementById('elig-form');
  const count = document.getElementById('elig-count');
  list.replaceChildren(loadingNode());

  let cat, programs;
  try {
    [cat, { programs }] = await Promise.all([api('/catalog'), api('/programs')]);
  } catch (err) {
    list.replaceChildren(errorNode(err.message, () => location.reload()));
    return;
  }
  document.getElementById('elig-housing').append(...choiceGroup('housing', cat.housing));

  // Mismas reglas que el servidor (server/programs.js), en versión de vista previa.
  function eligible(d) {
    const ids = new Set(['access']);
    if (['cha', 'vale'].includes(d.housing)) ids.add('cha');
    if (d.housing === 'proyecto') ids.add('seccion504');
    if (d.low_income && /^606\d{2}$|^60827$/.test(d.zip || '')) ids.add('hap');
    if (d.medicaid) ids.add('idhs');
    if (d.veteran) ids.add('va');
    if (d.housing === 'propia' && d.low_income) ids.add('habitat');
    if (['vale', 'renta'].includes(d.housing)) ids.add('fha');
    return ids;
  }

  function card(p, match) {
    return el('article', { class: `card program-card${match ? ' match' : ''}`, id: p.id },
      el('div', { class: 'row' },
        match ? el('span', { class: 'tag m', text: 'Te puede aplicar' }) : null,
        el('span', { class: 'tag', text: p.pays })),
      el('h3', { text: p.name }),
      el('p', { class: 'meta', text: p.org }),
      el('p', {}, el('strong', { text: 'Para quién: ' }), p.who),
      el('p', {}, el('strong', { text: 'Qué cubre: ' }), p.covers),
      el('div', { class: 'stack' }, el('strong', { text: 'Cómo aplicar' }), el('ol', { class: 'steps-mini' }, p.steps.map(s => el('li', { text: s })))),
      p.docs.length ? el('div', { class: 'stack' }, el('strong', { text: 'Documentos' }), el('div', { class: 'prog-chips' }, p.docs.map(d => el('span', { text: d })))) : null,
      el('a', { href: p.url, target: '_blank', rel: 'noopener', text: 'Sitio oficial del programa ↗' }));
  }

  function update() {
    const d = formData(form);
    const answered = !!d.housing;
    const ids = answered ? eligible(d) : new Set();
    const sorted = [...programs].sort((a, b) => Number(ids.has(b.id)) - Number(ids.has(a.id)));
    list.replaceChildren(...sorted.map(p => card(p, ids.has(p.id))));
    count.textContent = answered ? `${ids.size} programa(s) te pueden ayudar` : 'Elige tu tipo de vivienda';
  }
  form.addEventListener('change', update);
  form.addEventListener('input', update);
  update();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();

  const copy = document.getElementById('copy-letter');
  copy.addEventListener('click', async () => {
    const text = document.getElementById('letter').textContent;
    try {
      await navigator.clipboard.writeText(text);
      toast('Carta copiada. Pégala en un correo o documento.');
    } catch {
      const r = document.createRange();
      r.selectNodeContents(document.getElementById('letter'));
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      toast('Texto seleccionado. Presiona Ctrl + C para copiar.');
    }
  });
});
