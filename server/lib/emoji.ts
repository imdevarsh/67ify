import { env } from '../env';

const MAX_UPLOAD_ATTEMPTS = 3;

type EmojiProxyUploadResponse = {
	ok?: boolean;
	error?: string;
};

export class EmojiUploadError extends Error {
	constructor(
		message: string,
		public details?: {
			status?: number;
			statusText?: string;
			proxyError?: string;
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
	image,
	type,
}: {
	emojiName: string;
	image: Buffer<ArrayBufferLike>;
	type: string;
}) {
	for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
		const form = new FormData();

		form.append('name', emojiName);
		form.append('file', new Blob([new Uint8Array(image)]), `image.${type}`);

		const req = await fetch(
			`${env.SLACK_EMOJI_PROXY_URL.replace(/\/+$/, '')}/api/emoji/upload`,
			{
				method: 'POST',
				body: form,
				headers: {
					authorization: `Bearer ${env.SLACK_EMOJI_PROXY_API_KEY}`,
				},
			},
		);
		const responseText = await req.text();
		const responseBody = parseProxyResponse(responseText);

		if (req.status === 429 && attempt < MAX_UPLOAD_ATTEMPTS) {
			await sleep(Number(req.headers.get('Retry-After') || '5') * 1000 + 250);
			continue;
		}

		if (!req.ok) {
			throw new EmojiUploadError(
				`Slack emoji proxy returned HTTP ${req.status} ${req.statusText}`,
				{
					status: req.status,
					statusText: req.statusText,
					proxyError: responseBody?.error,
					responseText,
				},
			);
		}

		if (responseBody?.ok !== true) {
			throw new EmojiUploadError(
				responseBody?.error
					? `Slack emoji proxy failed: ${responseBody.error}`
					: 'Slack emoji proxy did not return a successful response.',
				{
					status: req.status,
					statusText: req.statusText,
					proxyError: responseBody?.error,
					responseText,
				},
			);
		}

		return;
	}

	throw new EmojiUploadError(
		'Slack emoji proxy was rate limited too many times.',
	);
}

function parseProxyResponse(
	responseText: string,
): EmojiProxyUploadResponse | undefined {
	if (!responseText) return undefined;

	try {
		return JSON.parse(responseText) as EmojiProxyUploadResponse;
	} catch {
		return undefined;
	}
}
