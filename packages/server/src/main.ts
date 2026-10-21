import { createApp } from './app';

createApp().then((app) => {
  console.log(`EIGENLANDS server on :${app.port} (redis: ${app.presence.usingRedis ? 'yes' : 'no, in-memory presence'})`);
  if (app.config.sessionSecret.startsWith('dev-only')) console.warn('! using dev SESSION_SECRET');
  if (!app.config.googleClientId) console.warn('! GOOGLE_CLIENT_ID not set: Google sign-in disabled, guest play only');
  const stop = () => app.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}).catch((e) => { console.error(e); process.exit(1); });
