// Registro en formato JSON por línea. Render guarda la salida estándar en sus Logs.

function write(level, data) {
  if (process.env.NODE_ENV === 'test') return;
  process.stdout.write(JSON.stringify({ time: new Date().toISOString(), level, ...data }) + '\n');
}

function requests(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    write(res.statusCode >= 500 ? 'error' : 'info', {
      method: req.method,
      path: req.path, // sin query string, para no guardar datos personales
      status: res.statusCode,
      ms: Math.round(ms),
    });
  });
  next();
}

function error(err, req) {
  write('error', {
    msg: err.message,
    stack: err.stack,
    method: req && req.method,
    path: req && req.path,
  });
}

function info(msg, extra = {}) {
  write('info', { msg, ...extra });
}

module.exports = { requests, error, info };
