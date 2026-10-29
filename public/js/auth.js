document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const next = safeNext(params.get('next'));

  // Conserva el destino al cambiar entre "Entrar" y "Crear cuenta".
  for (const id of ['to-register', 'to-login']) {
    const link = document.getElementById(id);
    if (link && params.get('next')) link.href += '?next=' + encodeURIComponent(next);
  }

  getMe().then(user => { if (user) location.replace(next); });

  const login = document.getElementById('login-form');
  if (login) {
    login.addEventListener('submit', async e => {
      e.preventDefault();
      clearErrors(login);
      const button = login.querySelector('button[type="submit"]');
      busy(button, true, 'Entrando…');
      try {
        await api('/auth/login', { method: 'POST', body: formData(login) });
        location.href = next;
      } catch (err) {
        showErrors(login, err);
        busy(button, false);
      }
    });
  }

  const register = document.getElementById('register-form');
  if (register) {
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
      const button = register.querySelector('button[type="submit"]');
      busy(button, true, 'Creando cuenta…');
      try {
        await api('/auth/register', { method: 'POST', body: data });
        location.href = params.get('next') ? next : '/cotizar';
      } catch (err) {
        showErrors(register, err);
        busy(button, false);
      }
    });
  }
});
