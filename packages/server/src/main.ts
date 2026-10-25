import { createApp } from './app';

createApp()
  .then((app) => {
    console.log(
      `EIGENLANDS server on :${app.port} (redis: ${app.presence.usingRedis ? 'yes' : 'no, in-memory presence'})`,
    );
    if (app.config.sessionSecret.startsWith('dev-only')) console.warn('! using dev SESSION_SECRET');
    if (!app.config.googleClientId)
      console.warn('! GOOGLE_CLIENT_ID not set: Google sign-in disabled, guest play only');
    let stopping = false;
    const stop = (code = 0) => {
      if (stopping) return;
      stopping = true;
      void app.close().then(
        () => process.exit(code),
        (error) => {
          console.error(error);
          process.exit(1);
        },
      );
    };
    process.once('SIGINT', () => stop());
    process.once('SIGTERM', () => stop());
    process.once('uncaughtException', (error) => {
      console.error(error);
      stop(1);
    });
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
