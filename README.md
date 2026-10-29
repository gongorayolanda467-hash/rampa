# Rampa Fácil

Mercado que conecta a **quien necesita una rampa** (personas con discapacidad, incluidos inquilinos con Sección 8 y residentes de CHA) con **quien puede pagarla** (programas públicos, autoridades de vivienda, propietarios, organizaciones, empresas y donantes). Rampa Fácil diseña, tramita y construye la rampa.

## Cómo funciona el mercado

- **Quien necesita** pide su rampa en 3 pasos, recibe un estimado al instante y ve qué programas le aplican (`server/programs.js`). Puede compartir su caso, sin datos personales, con financiadores verificados.
- **Quien paga** crea una cuenta de financiador. El equipo la verifica en `/admin`. Luego ve casos anónimos (código postal, altura, modelo, vivienda, estimado), filtra por su zona y ofrece pago total o parcial.
- **La persona** acepta o rechaza cada oferta desde su panel. El equipo ve todo en `/admin` y coordina el pago y la obra.
- **Privacidad:** los financiadores nunca reciben nombre, dirección, teléfono, correo ni notas (hay una prueba automática que lo comprueba).

Páginas: `/` (venta), `/ayuda` (quién paga mi rampa), `/financiadores`, `/cotizar`, `/panel`, `/financiar`, `/admin`, `/guia` (calculadora ADA).

- **Servidor:** Node.js 20+ con Express
- **Base de datos:** PostgreSQL (en desarrollo se usa una base en memoria si no hay `DATABASE_URL`)
- **Frontend:** HTML, CSS y JavaScript sin paso de compilación, en `public/`
- **Publicación:** Render, desde este repositorio de GitHub (`render.yaml`)

## Correr en su computadora

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Sin `DATABASE_URL` los datos se borran al reiniciar el servidor.

Para usar una base PostgreSQL local, copie `.env.example` como `.env` y llene `DATABASE_URL`. Para hacerse administrador, ponga su correo en `ADMIN_EMAIL` y cree la cuenta con ese correo.

Pruebas automáticas (cuentas, permisos, validación, 404, encabezados de seguridad):

```bash
npm test
```

## Publicar en Render

1. Suba este repositorio a GitHub.
2. En Render: **New → Blueprint**, elija el repositorio. Render lee `render.yaml` y crea el servicio web y la base de datos.
3. Cuando lo pida, escriba en `ADMIN_EMAIL` el correo que será administrador.
4. Al terminar, abra la dirección `https://….onrender.com`, cree una cuenta con ese correo y entre a `/admin`.

Cada vez que se sube un cambio a la rama `main`, Render vuelve a publicar solo.

## Estructura

```
server/
  index.js        arranque, conexión a la base de datos y cierre ordenado
  app.js          seguridad (Helmet, CSP, HSTS), API, archivos públicos, 404 y 500
  routes.js       rutas de la API: cuentas, cotizaciones, contacto y administración
  auth.js         sesión con cookie httpOnly firmada (JWT) y permisos
  validation.js   validación de todas las entradas con zod y mensajes en español
  catalog.js      modelos, acabados y estados (una sola fuente)
  db.js           esquema y consultas parametrizadas
  log.js          registro en JSON para los Logs de Render
public/           páginas, estilos, scripts e imágenes
scripts/          generador de ilustraciones e imagen para redes
test/             pruebas de la API
docs/             guía original
```

## Seguridad

- Sin secretos en el código: `JWT_SECRET` y `DATABASE_URL` vienen de variables de entorno, y `.env` está en `.gitignore`.
- Contraseñas con bcrypt (costo 12), mínimo 10 caracteres.
- Sesión en cookie `httpOnly`, `Secure` y `SameSite=Lax`. Las escrituras desde otros sitios se rechazan con una revisión del origen.
- Validación en el servidor de cada campo, con largo máximo, cuerpo máximo de 20 KB y listas paginadas (20 por página para clientes, 50 para administración).
- Consultas SQL siempre con parámetros. Cada cliente solo puede ver y cancelar sus propias solicitudes.
- Límite de intentos: 10 inicios de sesión cada 15 minutos, 5 cuentas por hora, 10 formularios por hora y 120 llamadas a la API por minuto por IP.
- Encabezados: CSP estricta (sin scripts en línea), HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy y Permissions-Policy.
- Sin CORS: la API solo responde a su propio sitio.
- El contenido dinámico se inserta con `textContent`. La guía inserta con `innerHTML` solo texto fijo y números calculados.
- `npm audit`: 0 vulnerabilidades al 28 de octubre de 2026.

## Antes de abrir al público

- [ ] Ajustar los precios orientativos por pie lineal en `server/catalog.js` (`pricePerFoot`) a los precios reales del negocio.
- [ ] Revisar los requisitos y enlaces de los programas en `server/programs.js`.
- [ ] Cambiar el teléfono y el correo de contacto en `public/js/common.js` (`SITE`). Los actuales son de ejemplo.
- [ ] Si el sitio no queda en `https://rampa-facil.onrender.com`, cambiar esa dirección en las etiquetas `og:` y `canonical` de `public/*.html`, en `public/robots.txt` y en `public/sitemap.xml`.
- [ ] Confirmar que las promesas de la página son ciertas para el negocio: visita gratis, atención en español e inglés, trámite de permisos, zonas de servicio y tiempos de instalación.
- [ ] Revisar el aviso de privacidad y los términos con un abogado.
- [ ] Pasar la base de datos a un plan pagado de Render. La base gratuita vence a los 30 días y no tiene respaldos automáticos.

## Mantenimiento

- Los programas de ayuda (Home Accessibility Program, CHA, IDHS, VA) cambian. Revise la guía una vez al año.
- Para regenerar las ilustraciones: `npm run build:img`.
- Revise vulnerabilidades con `npm audit` cada mes.
