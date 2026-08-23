import { POST as convertImage } from '../api/convert';

const assets = {
	'/': { path: '../index.html', type: 'text/html; charset=utf-8' },
	'/index.html': { path: '../index.html', type: 'text/html; charset=utf-8' },
	'/styles.css': { path: '../styles.css', type: 'text/css; charset=utf-8' },
	'/app.js': { path: '../app.js', type: 'text/javascript; charset=utf-8' },
} as const;

const port = Number(process.env.PORT ?? 3000);

Bun.serve({
	port,
	async fetch(request) {
		const url = new URL(request.url);

		if (url.pathname === '/api/convert' && request.method === 'POST') {
			return convertImage(request);
		}

		const asset = assets[url.pathname as keyof typeof assets];
		if (!asset || request.method !== 'GET') {
			return new Response('Not found', { status: 404 });
		}

		return new Response(Bun.file(new URL(asset.path, import.meta.url)), {
			headers: { 'Content-Type': asset.type },
		});
	},
});

console.log(`67ify web UI running at http://localhost:${port}`);
