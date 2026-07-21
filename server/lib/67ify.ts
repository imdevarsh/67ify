import sharp from 'sharp';

type Mode = '67' | '55';

type MakeGifOptions = {
	frames?: number;
	strength?: number;
	hold?: number;
	mode?: Mode;
	maxDimension?: number;
	maxBytes?: number;
};

type GifProfile = {
	maxDimension?: number;
	colours?: number;
};

export async function make67Gif(
	imageBuffer: ArrayBuffer,
	options?: MakeGifOptions,
): Promise<Buffer<ArrayBufferLike>> {
	const {
		frames = 18,
		strength = 1,
		hold = 1,
		mode = '67',
		maxDimension,
		maxBytes,
	} = options ?? {};

	const imageSharp = sharp(imageBuffer, { animated: true });
	const src = imageSharp.clone().ensureAlpha();
	const meta = await src.metadata();

	if (!meta.width || !meta.height) {
		throw new Error('Input image must have a known width and height.');
	}

	const pages = meta.pages || 1;
	const sourceWidth = meta.width;
	const sourceHeight = meta.pageHeight || meta.height;
	const isAnimatedInput = pages > 1;
	const profiles = makeGifProfiles(maxDimension, maxBytes);

	for (const profile of profiles) {
		const scale = profile.maxDimension
			? Math.min(1, profile.maxDimension / Math.max(sourceWidth, sourceHeight))
			: 1;
		const width = Math.max(1, Math.round(sourceWidth * scale));
		const height = Math.max(1, Math.round(sourceHeight * scale));
		const gif = await renderGif({
			imageBuffer,
			src,
			pages,
			isAnimatedInput,
			width,
			height,
			frames,
			strength,
			hold,
			mode,
			sourceDelays: meta.delay?.length ? meta.delay : undefined,
			colours: profile.colours,
		});

		if (!maxBytes || gif.byteLength <= maxBytes) return gif;
	}

	throw new Error(`Could not make a GIF smaller than ${maxBytes} bytes.`);
}

function makeGifProfiles(
	maxDimension?: number,
	maxBytes?: number,
): GifProfile[] {
	if (!maxBytes) return [{ maxDimension }];

	const dimension = maxDimension ?? Number.POSITIVE_INFINITY;
	const candidates: Array<[number, number]> = [
		[1, 128],
		[1, 64],
		[0.875, 64],
		[0.75, 64],
		[0.75, 32],
		[0.625, 32],
		[0.5, 32],
		[0.375, 32],
		[0.375, 16],
		[0.25, 16],
		[0.125, 16],
	];

	return candidates.map(([scale, colours]) => ({
		maxDimension: Number.isFinite(dimension)
			? Math.max(16, Math.round(dimension * scale))
			: undefined,
		colours,
	}));
}

async function renderGif({
	imageBuffer,
	src,
	pages,
	isAnimatedInput,
	width,
	height,
	frames,
	strength,
	hold,
	mode,
	sourceDelays,
	colours,
}: {
	imageBuffer: ArrayBuffer;
	src: sharp.Sharp;
	pages: number;
	isAnimatedInput: boolean;
	width: number;
	height: number;
	frames: number;
	strength: number;
	hold: number;
	mode: Mode;
	sourceDelays?: number[];
	colours?: number;
}) {
	const maxShearY = 0.3 * strength;
	const maxDepth = 0.35 * strength;
	const safeScale =
		mode === '55'
			? Math.min(0.9, 1 / (1 + maxDepth))
			: Math.min(0.9, height / (height + width * maxShearY));

	const frameBuffers: Buffer[] = [];
	const delays: number[] = [];

	const outFrames = isAnimatedInput ? pages : frames;

	for (let i = 0; i < outFrames; i++) {
		const t = (i / outFrames) * Math.PI * 2;

		const shearY = Math.sin(t) * 0.3 * strength;
		const depth = Math.cos(t) * maxDepth;

		const frameW = Math.max(1, Math.round(width * safeScale));
		const frameH = Math.max(1, Math.round(height * safeScale));

		const pageIndex = isAnimatedInput ? i : 0;
		let currentFrameSrc = isAnimatedInput
			? sharp(imageBuffer, {
					animated: true,
					page: pageIndex,
					pages: 1,
				}).ensureAlpha()
			: src.clone();

		if (isAnimatedInput) {
			currentFrameSrc = sharp(await currentFrameSrc.png().toBuffer());
		}

		const transformed =
			mode === '55'
				? await make55Frame(currentFrameSrc, frameW, frameH, depth)
				: await currentFrameSrc
						.resize(frameW, frameH, {
							fit: 'contain',
							background: { r: 0, g: 0, b: 0, alpha: 0 },
						})
						.affine([1, 0, shearY, 1], {
							background: { r: 0, g: 0, b: 0, alpha: 0 },
						})
						.png()
						.toBuffer();

		const frame = await sharp({
			create: {
				width,
				height,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			},
		})
			.composite([{ input: transformed, gravity: 'center' }])
			.png()
			.toBuffer();

		for (let r = 0; r < hold; r++) {
			frameBuffers.push(frame);
			delays.push(sourceDelays?.[pageIndex] ?? 100);
		}
	}

	return Buffer.from(
		await sharp(frameBuffers, {
			join: {
				animated: true,
			},
		})
			.gif({
				delay: delays,
				loop: 0,
				...(colours
					? {
							colours,
							effort: 10,
							dither: 0.75,
							interFrameMaxError: 8,
						}
					: {}),
			})
			.toBuffer(),
	);
}

async function make55Frame(
	source: sharp.Sharp,
	width: number,
	height: number,
	depth: number,
) {
	const resized = await source
		.resize(width, height, {
			fit: 'contain',
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.png()
		.toBuffer();
	const outputHeight = Math.max(1, Math.round(height * (1 + Math.abs(depth))));

	const composites = await Promise.all(
		Array.from({ length: width }, async (_, x) => {
			const xProgress = width === 1 ? 0 : x / (width - 1);
			const xPosition = xProgress * 2 - 1;
			const columnHeight = Math.max(
				1,
				Math.round(height * (1 - depth * xPosition)),
			);

			return {
				input: await sharp(resized)
					.extract({ left: x, top: 0, width: 1, height })
					.resize(1, columnHeight, {
						fit: 'fill',
					})
					.png()
					.toBuffer(),
				left: x,
				top: Math.round((outputHeight - columnHeight) / 2),
			};
		}),
	);

	return sharp({
		create: {
			width,
			height: outputHeight,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})
		.composite(composites)
		.png()
		.toBuffer();
}
