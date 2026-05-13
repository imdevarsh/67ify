import type { App } from '@slack/bolt';
import { appMention } from './appMention';

const register = (app: App) => {
	app.event('app_mention', appMention);
};

export default { register };
