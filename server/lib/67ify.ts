import sharp from 'sharp';

type Mode = '67' | '55';

export async function make67Gif(
	imageBuffer: ArrayBuffer,
	options?: {
		frames?: number;
		strength?: number;
		hold?: number;
		mode?: Mode;
	},
): Promise<Buffer<ArrayBufferLike>> {
	const { frames = 18, strength = 1, hold = 1, mode = '67' } = options ?? {};

	const imageSharp = sharp(imageBuffer, { animated: true });
	const src = imageSharp.clone().ensureAlpha();
	const meta = await src.metadata();

	if (!meta.width || !meta.height) {
		throw new Error('Input image must have a known width and height.');
	}

	const pages = meta.pages || 1;
	const width = meta.width;
	const height = meta.pageHeight || meta.height;
	const isAnimatedInput = pages > 1;

	const maxShearY = 0.3 * strength;
	const maxDepth = 0.35 * strength;
	const safeScale =
		mode === '55'
			? Math.min(0.9, 1 / (1 + maxDepth))
			: Math.min(0.9, height / (height + width * maxShearY));

	const frameBuffers: Buffer[] = [];
	const delays: number[] = [];

	const outFrames = isAnimatedInput ? pages : frames;
	const sourceDelays = meta.delay?.length ? meta.delay : undefined;

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
