const config = require('./config');
const db = require('./db');
const log = require('./log');
const { createApp } = require('./app');

async function main() {
  await db.init();
  const app = createApp();
  const server = app.listen(config.port, () => {
    log.info('Servidor listo', { port: config.port, origin: config.appOrigin });
  });

  const shutdown = () => {
    server.close(() => db.pool.end().finally(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

process.on('unhandledRejection', err => log.error(err));

main().catch(err => {
  log.error(err);
  process.exit(1);
});
