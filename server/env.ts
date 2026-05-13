import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
	server: {
		SLACK_BOT_TOKEN: z.string().min(1),
		SLACK_SIGNING_SECRET: z.string().min(1),
		SLACK_APP_TOKEN: z.string().optional(),
		SLACK_USER_XOXC: z.string().min(1),
		SLACK_COOKIE: z.string().min(1),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
