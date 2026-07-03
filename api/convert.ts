import { make67Gif } from '../server/lib/67ify';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

type Mode = '67' | '55';

export async function OPTIONS() {
	return new Response(null, {
		status: 204,
		headers: corsHeaders,
	});
}

export async function POST(request: Request) {
	try {
		const url = new URL(request.url);
		const contentType = request.headers.get('content-type') ?? '';
		const body = await readLimitedBody(request);
		const { image, mode } = contentType.includes('multipart/form-data')
			? readMultipartRequest(body, contentType)
			: readRawImageRequest(body, contentType, url);

		if (!image.byteLength) {
			return jsonError('Missing image input.', 400);
		}

		const gif = await make67Gif(toArrayBuffer(image), { mode });

		return new Response(gif, {
			headers: {
				...corsHeaders,
				'Content-Type': 'image/gif',
				'Content-Disposition': `inline; filename="67ify-${mode}.gif"`,
				'Cache-Control': 'no-store',
			},
		});
	} catch (error) {
		if (error instanceof RequestError) {
			return jsonError(error.message, error.status);
		}

		console.error(error);
		return jsonError('Failed to convert image.', 500);
	}
}

async function readLimitedBody(request: Request) {
	const contentLength = request.headers.get('content-length');
	if (contentLength && Number(contentLength) > MAX_UPLOAD_BYTES) {
		throw new RequestError('Image input must be 8 MB or smaller.', 413);
	}

	if (!request.body) {
		throw new RequestError('Missing image input.', 400);
	}

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;

		total += value.byteLength;
		if (total > MAX_UPLOAD_BYTES) {
			await reader.cancel();
			throw new RequestError('Image input must be 8 MB or smaller.', 413);
		}

		chunks.push(value);
	}

	const body = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return body;
}

function readMultipartRequest(body: Uint8Array, contentType: string) {
	const boundary = parseBoundary(contentType);
	const parts = parseMultipartBody(body, boundary);
	const image = parts.get('image') ?? parts.get('file');
	const mode = parseMode(parts.get('mode')?.toString('utf8').trim());

	if (!image) {
		throw new RequestError('Upload an image using the "image" field.', 400);
	}

	return {
		image,
		mode,
	};
}

function readRawImageRequest(body: Uint8Array, contentType: string, url: URL) {
	if (!contentType.startsWith('image/')) {
		throw new RequestError(
			'Use multipart/form-data or send a raw image/* request body.',
			415,
		);
	}

	return {
		image: body,
		mode: parseMode(url.searchParams.get('mode')),
	};
}

function parseBoundary(contentType: string) {
	const match = contentType.match(/(?:^|;\s*)boundary=(?:"([^"]+)"|([^;]+))/i);
	const boundary = match?.[1] ?? match?.[2];
	if (!boundary) {
		throw new RequestError('Missing multipart boundary.', 400);
	}

	return boundary;
}

function parseMultipartBody(body: Uint8Array, boundary: string) {
	const bodyBuffer = Buffer.from(body);
	const boundaryBuffer = Buffer.from(`--${boundary}`);
	const parts = new Map<string, Buffer>();
	let boundaryIndex = bodyBuffer.indexOf(boundaryBuffer);

	while (boundaryIndex !== -1) {
		let partStart = boundaryIndex + boundaryBuffer.length;

		if (
			bodyBuffer.subarray(partStart, partStart + 2).equals(Buffer.from('--'))
		) {
			break;
		}

		if (
			bodyBuffer.subarray(partStart, partStart + 2).equals(Buffer.from('\r\n'))
		) {
			partStart += 2;
		}

		const nextBoundaryIndex = bodyBuffer.indexOf(boundaryBuffer, partStart);
		if (nextBoundaryIndex === -1) break;

		const headerEnd = bodyBuffer.indexOf(Buffer.from('\r\n\r\n'), partStart);
		if (headerEnd !== -1 && headerEnd < nextBoundaryIndex) {
			const headers = bodyBuffer
				.subarray(partStart, headerEnd)
				.toString('utf8');
			const name = parsePartName(headers);
			const dataStart = headerEnd + 4;
			const dataEnd =
				bodyBuffer[nextBoundaryIndex - 2] === 13 &&
				bodyBuffer[nextBoundaryIndex - 1] === 10
					? nextBoundaryIndex - 2
					: nextBoundaryIndex;

			if (name) {
				parts.set(name, bodyBuffer.subarray(dataStart, dataEnd));
			}
		}

		boundaryIndex = nextBoundaryIndex;
	}

	return parts;
}

function parsePartName(headers: string) {
	return headers.match(/content-disposition:.*;\s*name="([^"]+)"/i)?.[1];
}

function toArrayBuffer(bytes: Uint8Array) {
	return bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength,
	) as ArrayBuffer;
}

function parseMode(value: unknown): Mode {
	return value === '55' ? '55' : '67';
}

function jsonError(message: string, status: number) {
	return Response.json(
		{ error: message },
		{
			status,
			headers: corsHeaders,
		},
	);
}

class RequestError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}
