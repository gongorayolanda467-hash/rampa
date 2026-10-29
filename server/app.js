const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const config = require('./config');
const log = require('./log');
const { loadUser } = require('./auth');
const routes = require('./routes');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render pone un proxy delante; así el límite de intentos usa la IP real.

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
    strictTransportSecurity: config.isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use((req, res, next) => {
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    next();
  });

  // Render ya redirige http → https; HSTS hace que el navegador use siempre https.

  app.use(compression());
  app.use(log.requests);

  /* ---------- API ---------- */
  const api = express.Router();
  api.use(express.json({ limit: '20kb' }));
  api.use(cookieParser());

  // Sin CORS: la API solo responde a su propio sitio. Además se rechazan escrituras desde otros orígenes.
  api.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin && origin !== config.appOrigin) {
      return res.status(403).json({ error: 'Origen no permitido.' });
    }
    next();
  });
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use(loadUser);
  api.use(routes);
  api.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use('/api', api);

  /* ---------- Sitio ---------- */
  app.use(express.static(PUBLIC_DIR, {
    extensions: ['html'],
    index: 'index.html',
    maxAge: config.isProd ? '1h' : 0,
    setHeaders(res, file) {
      if (file.endsWith('.html')) res.set('Cache-Control', 'no-cache');
    },
  }));

  app.use((req, res) => {
    res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
  });

  // Errores: se registran completos en el servidor, al usuario nunca se le muestran detalles técnicos.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Los datos enviados son demasiado grandes.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Formato de datos inválido.' });
    log.error(err, req);
    if (req.originalUrl.startsWith('/api')) {
      return res.status(500).json({ error: 'Ocurrió un error en el servidor. Intente de nuevo en unos minutos.' });
    }
    res.status(500).sendFile(path.join(PUBLIC_DIR, '500.html'));
  });

  return app;
}

module.exports = { createApp };
