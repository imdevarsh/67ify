import sharp, { type Sharp } from 'sharp';

export async function make67Gif(
	imageSharp: Sharp,
	options?: {
		frames?: number;
		strength?: number;
		hold?: number;
	},
): Promise<Buffer<ArrayBufferLike>> {
	const { frames = 18, strength = 1, hold = 1 } = options ?? {};

	const src = imageSharp.clone().ensureAlpha();
	const meta = await src.metadata();

	if (!meta.width || !meta.height) {
		throw new Error('Input image must have a known width and height.');
	}

	const width = meta.width;
	const height = meta.height;

	const maxShearY = 0.3 * strength;
	const safeScale = Math.min(0.9, height / (height + width * maxShearY));

	const frameBuffers: Buffer[] = [];

	for (let i = 0; i < frames; i++) {
		const t = (i / frames) * Math.PI * 2;

		const shearY = Math.sin(t) * 0.3 * strength;

		const frameW = Math.max(1, Math.round(width * safeScale));
		const frameH = Math.max(1, Math.round(height * safeScale));

		const transformed = await src
			.clone()
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
		}
	}

	return Buffer.from(
		await sharp(frameBuffers, {
			join: {
				animated: true,
			},
		})
			.gif({
				loop: 0,
			})
			.toBuffer(),
	);
}
