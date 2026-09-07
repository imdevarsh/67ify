import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { make67Gif } from './67ify.ts';

for (const mode of ['55', '67-55'] as const) {
	test(`${mode} preserves animation timing, dimensions and transparency`, async () => {
		const input = await sharp({
			create: { width: 64, height: 64, channels: 4, background: '#4080ff' },
		})
			.png()
			.toBuffer();
		const output = await make67Gif(new Uint8Array(input).buffer, {
			mode,
			frames: 6,
			hold: 1,
		});
		const metadata = await sharp(output, { animated: true }).metadata();
		assert.equal(metadata.width, 64);
		assert.equal(metadata.pageHeight, 64);
		assert.equal(metadata.loop, 0);
		assert.equal(
			metadata.delay?.reduce((a, b) => a + b, 0),
			600,
		);
		const { data, info } = await sharp(output)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		assert.equal(data[3], 0);
		assert.equal(data[(32 * info.width + 32) * 4 + 3], 255);
	});
}

test('55 handles a one-pixel-wide input', async () => {
	const input = await sharp({
		create: { width: 1, height: 32, channels: 4, background: '#4080ff' },
	})
		.png()
		.toBuffer();
	const output = await make67Gif(new Uint8Array(input).buffer, {
		mode: '55',
		frames: 6,
	});
	assert.equal((await sharp(output).metadata()).width, 1);
});
