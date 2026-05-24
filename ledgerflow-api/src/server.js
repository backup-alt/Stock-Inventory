import { createApp } from './app.js';
import { config } from './config.js';

const server = createApp();

server.listen(config.port, config.host, () => {
  process.stdout.write(`${config.appName} API running at http://${config.host}:${config.port}\n`);
});
