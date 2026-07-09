import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import { make67Gif } from '../../lib/67ify';
import { uploadEmoji } from '../../lib/emoji';

const emojiNamePattern = /:([^:\s]+):/g;
const modePattern = /\b(55|67)\b/;
type Mode = '67' | '55';

function parsePrompt(prompt?: string): { emojis: string[]; mode: Mode } {
	if (!prompt) return { emojis: [], mode: '67' as const };

	const emojis = Array.from(prompt.matchAll(emojiNamePattern), (match) =>
		match[1]?.toLowerCase(),
	).filter((emoji): emoji is string => Boolean(emoji));
	const mode = modePattern.exec(prompt)?.[1] === '55' ? '55' : '67';

	return { emojis: Array.from(new Set(emojis)), mode };
}

export const appMention = async ({
	event,
	client,
	context,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'app_mention'>) => {
	if (!event.user) return;

	const prompt = event.text.split(`<@${context.botUserId}>`)[1]?.trim();
	const { emojis, mode } = parsePrompt(prompt);
	if (!emojis.length) {
		await client.chat.postMessage({
			text: "Sorry, I couldn't parse your message :c",
			channel: event.channel,
			thread_ts: event.ts,
		});
		return;
	}

	const emojiList = await client.emoji.list();
	const teamDomain = (await client.team.info()).team?.domain;
	if (!teamDomain) {
		console.error('Failed to fetch team domain...!!');
		await client.chat.postMessage({
			text: `Fatal error - please ping the administrator of this bot!!`,
			channel: event.channel,
			thread_ts: event.ts,
		});
		return;
	}

	const createdEmojiNames: string[] = [];
	const missingEmojiNames: string[] = [];

	for (const emoji of emojis) {
		const emojiUrl = emojiList?.emoji?.[emoji];
		if (!emojiUrl) {
			missingEmojiNames.push(emoji);
			continue;
		}

		const imageBuffer = await (await fetch(emojiUrl)).arrayBuffer();
		const gif = await make67Gif(imageBuffer, { mode });
		const emojiName = `${emoji}-${mode}`;

		await uploadEmoji({
			emojiName,
			image: gif,
			type: 'gif',
			teamDomain,
		});

		createdEmojiNames.push(emojiName);

		await client.reactions.add({
			name: emojiName,
			channel: event.channel,
			timestamp: event.ts,
		});
	}

	await client.chat.postMessage({
		text: [
			createdEmojiNames.length
				? `Created ${createdEmojiNames.map((emojiName) => `:${emojiName}:`).join(' ')}`
				: undefined,
			missingEmojiNames.length
				? `I couldn't find ${missingEmojiNames.map((emojiName) => `\`${emojiName}\``).join(', ')} in this workspace`
				: undefined,
		]
			.filter(Boolean)
			.join('\n'),
		channel: event.channel,
		thread_ts: event.ts,
	});
};
