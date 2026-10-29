document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const nextParam = params.get('next');

  // Conserva el destino al cambiar entre "Entrar" y "Crear cuenta".
  for (const id of ['to-register', 'to-login']) {
    const link = document.getElementById(id);
    if (link && nextParam) link.href += '?next=' + encodeURIComponent(safeNext(nextParam));
  }

  const destination = user => (nextParam ? safeNext(nextParam, homeFor(user)) : homeFor(user));

  getMe().then(user => { if (user) location.replace(destination(user)); });

  const login = document.getElementById('login-form');
  if (login) {
    login.addEventListener('submit', async e => {
      e.preventDefault();
      clearErrors(login);
      const button = login.querySelector('button[type="submit"]');
      busy(button, true, 'Entrando…');
      try {
        const { user } = await api('/auth/login', { method: 'POST', body: formData(login) });
        location.href = destination(user);
      } catch (err) {
        showErrors(login, err);
        busy(button, false);
      }
    });
  }

  const register = document.getElementById('register-form');
  if (register) {
    const funderFields = document.getElementById('funder-fields');
    const kind = document.getElementById('kind');
    api('/catalog').then(cat => fillSelect(kind, cat.funderKinds, 'Elija una opción')).catch(() => {});

    const syncRole = () => {
      const isFunder = register.elements.role.value === 'funder';
      funderFields.classList.toggle('hidden', !isFunder);
      register.querySelector('button[type="submit"]').textContent = isFunder ? 'Crear cuenta de financiador' : 'Crear cuenta gratis';
    };
    if (params.get('tipo') === 'funder') register.querySelector('input[name="role"][value="funder"]').checked = true;
    register.querySelectorAll('input[name="role"]').forEach(r => r.addEventListener('change', syncRole));
    syncRole();

    register.addEventListener('submit', async e => {
      e.preventDefault();
      clearErrors(register);
      const data = formData(register);
      if (!register.elements.accept.checked) {
        showErrors(register, { message: 'Para crear la cuenta debe aceptar los términos y el aviso de privacidad.', fields: { accept: 'Requerido' } });
        return;
      }
      if ((data.password || '').length < 10) {
        showErrors(register, { message: 'Revise los datos del formulario.', fields: { password: 'La contraseña debe tener al menos 10 caracteres' } });
        return;
      }
      delete data.accept;
      if (data.role !== 'funder') { delete data.org_name; delete data.kind; }
      else if (!data.kind) delete data.kind;
      const button = register.querySelector('button[type="submit"]');
      busy(button, true, 'Creando cuenta…');
      try {
        const { user } = await api('/auth/register', { method: 'POST', body: data });
        location.href = nextParam ? destination(user) : (user.role === 'client' ? '/cotizar' : homeFor(user));
      } catch (err) {
        showErrors(register, err);
        busy(button, false);
      }
    });
  }
});
