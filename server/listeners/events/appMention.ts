import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import sharp from 'sharp';
import { make67Gif } from '../../lib/67ify';
import { uploadEmoji } from '../../lib/emoji';

export const appMention = async ({
	event,
	client,
	context,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'app_mention'>) => {
	if (!event.user) return;

	const emoji = event.text
		.split(`<@${context.botUserId}>`)[1]
		?.trim()
		.split(' ')[0]
		?.trim()
		.toLowerCase()
		.replaceAll(':', '');
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

	const image = sharp(await (await fetch(emojiUrl)).arrayBuffer());

	const gif = await make67Gif(image);

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
		emojiName: `${emoji}-67`,
		image: gif,
		type: 'gif',
		teamDomain,
	});

	await client.chat.postMessage({
		text: `Created :${emoji}-67:`,
		channel: event.channel,
		thread_ts: event.ts,
	});

	await client.reactions.add({
		name: `${emoji}-67`,
		channel: event.channel,
		timestamp: event.ts,
	});
};
