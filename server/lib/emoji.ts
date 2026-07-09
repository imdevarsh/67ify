import { env } from '../env';

const MAX_UPLOAD_ATTEMPTS = 3;

type SlackEmojiAddResponse = {
	ok?: boolean;
	error?: string;
	errors?: string[];
};

export class EmojiUploadError extends Error {
	constructor(
		message: string,
		public details?: {
			status?: number;
			statusText?: string;
			slackError?: string;
			responseText?: string;
		},
	) {
		super(message);
		this.name = 'EmojiUploadError';
	}
}

function sleep(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function uploadEmoji({
	emojiName,
	teamDomain,
	image,
	type,
}: {
	emojiName: string;
	teamDomain: string;
	image: Buffer<ArrayBufferLike>;
	type: string;
}) {
	// logic is based from github.com/taciturnaxolotl/emojibot
	for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
		const form = new FormData();

		form.append('token', env.SLACK_USER_XOXC);
		form.append('mode', 'data');
		form.append('name', emojiName);
		form.append('image', new Blob([new Uint8Array(image)]), `image.${type}`);

		const req = await fetch(`https://${teamDomain}.slack.com/api/emoji.add`, {
			method: 'POST',
			body: form,
			headers: {
				Cookie: env.SLACK_COOKIE,
			},
		});
		const responseText = await req.text();
		const responseBody = parseSlackResponse(responseText);

		if (req.status === 429 && attempt < MAX_UPLOAD_ATTEMPTS) {
			await sleep(Number(req.headers.get('Retry-After') || '5') * 1000 + 250);
			continue;
		}

		if (!req.ok) {
			throw new EmojiUploadError(
				`Slack emoji.add returned HTTP ${req.status} ${req.statusText}`,
				{
					status: req.status,
					statusText: req.statusText,
					slackError: responseBody?.error,
					responseText,
				},
			);
		}

		if (responseBody?.ok !== true) {
			throw new EmojiUploadError(
				responseBody?.error
					? `Slack emoji.add failed: ${responseBody.error}`
					: 'Slack emoji.add did not return a successful response.',
				{
					status: req.status,
					statusText: req.statusText,
					slackError: responseBody?.error ?? responseBody?.errors?.join(', '),
					responseText,
				},
			);
		}

		return;
	}

	throw new EmojiUploadError(
		'Slack emoji.add was rate limited too many times.',
	);
}

function parseSlackResponse(
	responseText: string,
): SlackEmojiAddResponse | undefined {
	if (!responseText) return undefined;

	try {
		return JSON.parse(responseText) as SlackEmojiAddResponse;
	} catch {
		return undefined;
	}
}
