document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('lead-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors(form);
    const button = form.querySelector('button[type="submit"]');
    busy(button, true);
    try {
      await api('/leads', { method: 'POST', body: formData(form) });
      form.reset();
      setStatus(form, 'Mensaje enviado. Te responderemos en un día hábil.', 'ok');
    } catch (err) {
      showErrors(form, err);
    } finally {
      busy(button, false);
    }
  });
});
