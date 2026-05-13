// used in development

import { App } from '@slack/bolt';
import { env } from './env';
import { registerListeners } from './listeners';

const app = new App({
	token: env.SLACK_BOT_TOKEN,
	signingSecret: env.SLACK_SIGNING_SECRET,
	appToken: env.SLACK_APP_TOKEN,
	socketMode: !!env.SLACK_APP_TOKEN,
});

registerListeners(app);

await app.start();
app.logger.info('App started!');
