import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import { make67Gif } from '../../lib/67ify';
import { uploadEmoji } from '../../lib/emoji';

export const appMention = async ({
	event,
	client,
	context,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'app_mention'>) => {
	if (!event.user) return;

	const prompt = event.text.split(`<@${context.botUserId}>`)[1]?.trim();
	const emoji = prompt?.split(' ')[0]?.trim().toLowerCase().replaceAll(':', '');
	const args = prompt?.split(' ').slice(1).join(' ').toLowerCase() ?? '';
	if (!emoji) {
		await client.chat.postMessage({
			text: "Sorry, I couldn't parse your message :c",
			channel: event.channel,
			thread_ts: event.ts,
		});
		return;
	}

	const emojiList = await client.emoji.list();
	const emojiUrl = emojiList?.emoji?.[emoji];
	if (!emojiUrl) {
		await client.chat.postMessage({
			text: `I couldn't find an emoji called \`${emoji}\` in this workspace`,
			channel: event.channel,
			thread_ts: event.ts,
		});
		return;
	}

	const imageBuffer = await (await fetch(emojiUrl)).arrayBuffer();

	const mode = args.includes('55') ? '55' : '67';
	const gif = await make67Gif(imageBuffer, { mode });
	const emojiName = `${emoji}-${mode}`;

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

	await uploadEmoji({
		emojiName,
		image: gif,
		type: 'gif',
		teamDomain,
	});

	await client.chat.postMessage({
		text: `Created :${emojiName}:`,
		channel: event.channel,
		thread_ts: event.ts,
	});

	await client.reactions.add({
		name: emojiName,
		channel: event.channel,
		timestamp: event.ts,
	});
};
