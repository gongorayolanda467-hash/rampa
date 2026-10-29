// Solicitud por pasos con estimado en vivo y programas que aplican.
document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('quote-root');
  const wizard = document.getElementById('wizard');
  const form = document.getElementById('quote-form');
  const user = await requireLogin();
  if (!user) return;
  if (user.role === 'funder') {
    root.replaceChildren(el('div', { class: 'empty' },
      el('h2', { text: 'Esta es una cuenta de financiador' }),
      el('p', { class: 'muted', text: 'Para pedir una rampa, cree una cuenta personal con otro correo.' }),
      el('a', { class: 'btn btn-primary', href: '/financiar', text: 'Ir a mis casos' })));
    return;
  }

  let cat, programs;
  root.replaceChildren(loadingNode('Cargando el formulario…'));
  try {
    [cat, { programs }] = await Promise.all([api('/catalog'), api('/programs')]);
  } catch (err) {
    root.replaceChildren(errorNode(err.message, () => location.reload()));
    return;
  }
  root.replaceChildren();
  wizard.classList.remove('hidden');

  const productInfo = {
    recta: 'Hasta 30", sin giros', l: 'Con un giro de 90°', u: 'Para frentes angostos', umbral: 'Un escalón, hasta 6"',
    modular: 'Removible, sin excavar', 'no-se': 'Lo vemos en la visita',
  };
  document.getElementById('product-choices').append(...choiceGroup('product', cat.products, {
    checked: p => p.id === 'no-se',
    render: p => [p.code !== '?' ? el('span', { class: 'code', text: p.code }) : el('span', { class: 'code', text: '?' }), el('span', { class: 't', text: p.name }), el('span', { class: 'd', text: productInfo[p.id] || '' })],
  }));
  document.getElementById('finish-choices').append(...choiceGroup('finish', cat.finishes, {
    checked: f => f.id === 'basico',
    render: f => [f.id !== 'basico' ? el('img', { src: `/img/${f.id}.svg`, alt: '', width: 480, height: 300, loading: 'lazy' }) : null, el('span', { class: 't', text: f.name }), el('span', { class: 'd', text: f.material })],
  }));
  document.getElementById('mobility-choices').append(...choiceGroup('mobility', cat.mobility));
  document.getElementById('housing-choices').append(...choiceGroup('housing', cat.housing));
  document.getElementById('contact-choices').append(...choiceGroup('contact_pref', cat.contactPrefs, { checked: c => c.id === (user.phone ? 'telefono' : 'correo') }));

  /* ---------- Estimado y recomendación ---------- */
  const rise = form.elements.rise_in;
  const recommend = r => (r <= 6 ? 'umbral' : r <= 30 ? 'recta' : 'u');
  function markRecommended() {
    const r = Number(rise.value) || 0;
    document.querySelectorAll('#product-choices .rec').forEach(n => n.remove());
    const target = document.querySelector(`#product-choices input[value="${recommend(r)}"]`);
    if (target && r > 0) target.closest('.choice').append(el('span', { class: 'rec', text: 'Recomendado' }));
  }
  let estTimer;
  async function updateEstimate() {
    const r = Math.min(120, Math.max(0, Number(rise.value) || 0));
    const seg = Math.max(1, Math.ceil(r / 30));
    document.getElementById('est-seg').textContent = r ? String(seg) : '—';
    document.getElementById('est-rails').textContent = r ? (r > 6 ? 'Ambos lados' : 'Opcional') : '—';
    if (!r) return;
    try {
      const est = await api(`/estimate?product=${encodeURIComponent(form.elements.product.value)}&finish=${encodeURIComponent(form.elements.finish.value)}&rise=${r}`);
      document.getElementById('est-range').textContent = `${money(est.low)} – ${money(est.high)}`;
      document.getElementById('est-feet').textContent = `${est.feet} pies`;
    } catch { /* el estimado es opcional */ }
  }
  const scheduleEstimate = () => { clearTimeout(estTimer); estTimer = setTimeout(updateEstimate, 250); markRecommended(); };
  rise.addEventListener('input', scheduleEstimate);
  form.addEventListener('change', e => { if (['product', 'finish'].includes(e.target.name)) scheduleEstimate(); updatePrograms(); });
  scheduleEstimate();

  /* ---------- Programas que aplican (mismas reglas que el servidor, en versión de vista previa) ---------- */
  function updatePrograms() {
    const d = formData(form);
    const box = document.getElementById('est-programs');
    if (!d.housing) return;
    const ids = new Set(['access']);
    if (['cha', 'vale'].includes(d.housing)) ids.add('cha');
    if (d.housing === 'proyecto') ids.add('seccion504');
    if (d.low_income && /^606\d{2}$|^60827$/.test(d.zip || '')) ids.add('hap');
    if (d.medicaid) ids.add('idhs');
    if (d.veteran) ids.add('va');
    if (d.housing === 'propia' && d.low_income) ids.add('habitat');
    if (['vale', 'renta'].includes(d.housing)) ids.add('fha');
    box.replaceChildren(el('div', { class: 'prog-chips' }, programs.filter(p => ids.has(p.id)).map(p => el('a', { href: `/ayuda#${p.id}`, text: p.name }))));
  }

  /* ---------- Pasos ---------- */
  let step = 1;
  const steps = [...form.querySelectorAll('[data-step]')];
  const back = document.getElementById('back');
  const next = document.getElementById('next');
  const submit = document.getElementById('submit');

  function show(n) {
    step = n;
    steps.forEach(s => s.classList.toggle('hidden', Number(s.dataset.step) !== n));
    form.querySelectorAll('.progress li').forEach(li => {
      const p = Number(li.dataset.p);
      li.className = p < n ? 'done' : p === n ? 'current' : '';
      if (p === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    back.classList.toggle('hidden', n === 1);
    next.classList.toggle('hidden', n === 3);
    submit.classList.toggle('hidden', n !== 3);
    if (n === 3) renderSummary();
    form.querySelector(`[data-step="${n}"] h2`).focus?.();
    window.scrollTo({ top: form.getBoundingClientRect().top + scrollY - 100, behavior: 'smooth' });
  }

  function requireIn(stepN) {
    const d = formData(form);
    const errs = {};
    if (stepN === 1) {
      const r = Number(d.rise_in);
      if (!r || r < 1 || r > 120) errs.rise_in = 'Escriba una altura entre 1 y 120 pulgadas';
      if (!d.product) errs.product = 'Elija una opción';
      if (!d.finish) errs.finish = 'Elija una opción';
    }
    if (stepN === 2) {
      if (!d.mobility) errs.mobility = 'Elija una opción';
      if (!d.housing) errs.housing = 'Elija una opción';
    }
    if (Object.keys(errs).length) {
      showErrors(form, { message: 'Complete los datos marcados para continuar.', fields: errs });
      return false;
    }
    return true;
  }

  function renderSummary() {
    const d = formData(form);
    const name = (list, id) => (cat[list].find(x => x.id === id) || { name: '—' }).name;
    const rows = [
      ['Altura', `${d.rise_in} pulgadas`], ['Modelo', name('products', d.product)], ['Acabado', name('finishes', d.finish)],
      ['Usuario', name('mobility', d.mobility)], ['Vivienda', name('housing', d.housing)], ['Estimado', document.getElementById('est-range').textContent],
    ];
    document.getElementById('summary').replaceChildren(...rows.flatMap(([k, val]) => [el('dt', { text: k }), el('dd', { text: val })]));
  }

  back.addEventListener('click', () => { clearErrors(form); show(step - 1); });
  next.addEventListener('click', () => { clearErrors(form); if (requireIn(step)) show(step + 1); });

  const zipNote = document.getElementById('zip-note');
  form.elements.zip.addEventListener('input', () => {
    const z = form.elements.zip.value;
    zipNote.classList.toggle('hidden', !(/^\d{5}$/.test(z) && !/^60[0-8]\d{2}$/.test(z)));
    updatePrograms();
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors(form);
    const d = formData(form);
    d.low_income = !!d.low_income; d.medicaid = !!d.medicaid; d.veteran = !!d.veteran; d.share_consent = !!d.share_consent;
    busy(submit, true);
    try {
      await api('/quotes', { method: 'POST', body: d });
      location.href = '/panel?nueva=1';
    } catch (err) {
      // Si el error es de un paso anterior, regresar a ese paso.
      const fields = Object.keys(err.fields || {});
      if (fields.some(f => ['rise_in', 'product', 'finish'].includes(f))) show(1);
      else if (fields.some(f => ['mobility', 'housing'].includes(f))) show(2);
      showErrors(form, err);
      busy(submit, false);
    }
  });

  show(1);
});
