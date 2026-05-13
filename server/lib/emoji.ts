import { env } from '../env';

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
	if (!req.ok) console.error(req.status, req.statusText, await req.text());
	if (req.status === 429) {
		// rate limit
		await sleep(Number(req.headers.get('Retry-After') || '5') * 1000 + 250);
		return await uploadEmoji({
			emojiName: emojiName,
			teamDomain: teamDomain,
			image: image,
			type: type,
		});
	}

	return;
}
