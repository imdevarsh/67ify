// used in prod to deploy to Vercel

import { App } from '@slack/bolt';
import { createHandler, VercelReceiver } from '@vercel/slack-bolt';
import { env } from '../../server/env';
import { registerListeners } from '../../server/listeners';

const receiver = new VercelReceiver({
	signingSecret: env.SLACK_SIGNING_SECRET,
});

const app = new App({
	token: env.SLACK_BOT_TOKEN,
	signingSecret: env.SLACK_SIGNING_SECRET,
	receiver,
	deferInitialization: true,
});

registerListeners(app);

export const POST = createHandler(app, receiver);
