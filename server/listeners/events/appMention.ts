import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import { make67Gif } from '../../lib/67ify';
import { EmojiUploadError, uploadEmoji } from '../../lib/emoji';

const emojiNamePattern = /:([^:\s]+):/g;
const modePattern = /\b(55|67)\b/;
const maxEmojiBatchSize = 10;

type Mode = '67' | '55';
type AppMentionArgs = AllMiddlewareArgs &
	SlackEventMiddlewareArgs<'app_mention'>;
type FailedEmoji = { emojiName: string; reason: string };
type EmojiMap = Record<string, string>;

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
}: AppMentionArgs) => {
	if (!event.user) return;

	try {
		const prompt = event.text.split(`<@${context.botUserId}>`)[1]?.trim();
		const { emojis, mode } = parsePrompt(prompt);
		if (!emojis.length) {
			await postThreadMessage({
				client,
				channel: event.channel,
				threadTs: event.ts,
				text: "Sorry, I couldn't parse your message :c",
			});
			return;
		}
		if (emojis.length > maxEmojiBatchSize) {
			await postThreadMessage({
				client,
				channel: event.channel,
				threadTs: event.ts,
				text: `Please send ${maxEmojiBatchSize} or fewer emoji at a time.`,
			});
			return;
		}

		const emojiList = await client.emoji.list();
		const emojiMap = (emojiList.emoji ?? {}) as EmojiMap;
		const teamDomain = (await client.team.info()).team?.domain;
		if (!teamDomain) {
			console.error('Failed to fetch team domain.');
			await postThreadMessage({
				client,
				channel: event.channel,
				threadTs: event.ts,
				text: 'I could not figure out this Slack workspace domain, so I could not upload emoji. Please ping the bot administrator.',
			});
			return;
		}

		const createdEmojiNames: string[] = [];
		const existingEmojiNames: string[] = [];
		const missingEmojiNames: string[] = [];
		const failedEmojiNames: FailedEmoji[] = [];

		for (const emoji of emojis) {
			const emojiName = `${emoji}-${mode}`;

			try {
				const existingEmojiUrl = resolveEmojiUrl(emojiMap, emojiName);
				if (existingEmojiUrl) {
					existingEmojiNames.push(emojiName);
					await addReaction({
						client,
						name: emojiName,
						channel: event.channel,
						timestamp: event.ts,
					});
					continue;
				}

				const emojiUrl = resolveEmojiUrl(emojiMap, emoji);
				if (!emojiUrl) {
					missingEmojiNames.push(emoji);
					continue;
				}

				const imageResponse = await fetch(emojiUrl);
				if (!imageResponse.ok) {
					throw new Error(
						`could not download source emoji image (HTTP ${imageResponse.status})`,
					);
				}

				const imageBuffer = await imageResponse.arrayBuffer();
				const gif = await make67Gif(imageBuffer, { mode });

				await uploadEmoji({
					emojiName,
					image: gif,
					type: 'gif',
					teamDomain,
				});

				createdEmojiNames.push(emojiName);
				await addReaction({
					client,
					name: emojiName,
					channel: event.channel,
					timestamp: event.ts,
				});
			} catch (error) {
				console.error(`Failed to create ${emojiName}.`, error);
				failedEmojiNames.push({
					emojiName,
					reason: formatErrorReason(error),
				});
			}
		}

		await postThreadMessage({
			client,
			channel: event.channel,
			threadTs: event.ts,
			text: buildResultMessage({
				createdEmojiNames,
				existingEmojiNames,
				missingEmojiNames,
				failedEmojiNames,
			}),
		});
	} catch (error) {
		console.error('Unhandled app_mention error.', error);
		await postThreadMessage({
			client,
			channel: event.channel,
			threadTs: event.ts,
			text: 'Sorry, something went wrong while creating emoji. I logged the details for an administrator.',
		});
	}
};

function resolveEmojiUrl(
	emojiMap: EmojiMap,
	emojiName: string,
	seen = new Set<string>(),
): string | undefined {
	if (seen.has(emojiName)) return undefined;
	seen.add(emojiName);

	const emojiValue = emojiMap[emojiName];
	if (!emojiValue) return undefined;

	if (emojiValue.startsWith('alias:')) {
		return resolveEmojiUrl(emojiMap, emojiValue.slice('alias:'.length), seen);
	}

	return emojiValue;
}

async function addReaction({
	client,
	name,
	channel,
	timestamp,
}: {
	client: AppMentionArgs['client'];
	name: string;
	channel: string;
	timestamp: string;
}) {
	try {
		await client.reactions.add({
			name,
			channel,
			timestamp,
		});
	} catch (error) {
		console.error(`Failed to add reaction :${name}:.`, error);
	}
}

async function postThreadMessage({
	client,
	channel,
	threadTs,
	text,
}: {
	client: AppMentionArgs['client'];
	channel: string;
	threadTs: string;
	text: string;
}) {
	try {
		await client.chat.postMessage({
			text,
			channel,
			thread_ts: threadTs,
		});
	} catch (error) {
		console.error('Failed to post app_mention response.', error);
	}
}

function buildResultMessage({
	createdEmojiNames,
	existingEmojiNames,
	missingEmojiNames,
	failedEmojiNames,
}: {
	createdEmojiNames: string[];
	existingEmojiNames: string[];
	missingEmojiNames: string[];
	failedEmojiNames: FailedEmoji[];
}) {
	return (
		[
			createdEmojiNames.length
				? `Created ${createdEmojiNames.map((emojiName) => `:${emojiName}:`).join(' ')}`
				: undefined,
			existingEmojiNames.length
				? `Already exists ${existingEmojiNames.map((emojiName) => `:${emojiName}:`).join(' ')}`
				: undefined,
			missingEmojiNames.length
				? `I couldn't find ${missingEmojiNames.map((emojiName) => `\`${emojiName}\``).join(', ')} in this workspace`
				: undefined,
			failedEmojiNames.length
				? `I couldn't create ${failedEmojiNames
						.map(({ emojiName, reason }) => `\`${emojiName}\` (${reason})`)
						.join(', ')}`
				: undefined,
		]
			.filter(Boolean)
			.join('\n') || 'No emoji were created.'
	);
}

function formatErrorReason(error: unknown) {
	if (error instanceof EmojiUploadError) {
		return error.details?.slackError
			? `Slack said ${error.details.slackError}`
			: 'Slack rejected the upload';
	}

	if (error instanceof Error && error.message) {
		return error.message;
	}

	return 'unknown error';
}
