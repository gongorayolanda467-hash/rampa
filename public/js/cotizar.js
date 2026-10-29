document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('quote-root');
  const form = document.getElementById('quote-form');

  const user = await requireLogin();
  if (!user) return;

  async function load() {
    root.replaceChildren(loadingNode('Cargando el formulario…'));
    try {
      const cat = await api('/catalog');
      fillSelect(form.elements.product, cat.products, 'Elija un modelo');
      fillSelect(form.elements.finish, cat.finishes, 'Elija un acabado');
      fillSelect(form.elements.mobility, cat.mobility, 'Elija una opción');
      fillSelect(form.elements.housing, cat.housing, 'Elija una opción');
      fillSelect(form.elements.contact_pref, cat.contactPrefs);
      if (user.phone) form.elements.contact_pref.value = 'telefono';
      else form.elements.contact_pref.value = 'correo';
      root.replaceChildren();
      form.classList.remove('hidden');
    } catch (err) {
      root.replaceChildren(errorNode(err.message, load));
    }
  }
  await load();

  // Chicago y suburbios cercanos: códigos 600xx–608xx.
  const zipNote = document.getElementById('zip-note');
  form.elements.zip.addEventListener('input', () => {
    const z = form.elements.zip.value;
    zipNote.classList.toggle('hidden', !(/^\d{5}$/.test(z) && !/^60[0-8]\d{2}$/.test(z)));
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors(form);
    const button = form.querySelector('button[type="submit"]');
    busy(button, true);
    try {
      await api('/quotes', { method: 'POST', body: formData(form) });
      location.href = '/panel?nueva=1';
    } catch (err) {
      showErrors(form, err);
      busy(button, false);
    }
  });
});
