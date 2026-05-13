import type { App } from '@slack/bolt';
import events from './events';

export function registerListeners(app: App) {
	events.register(app);
}
