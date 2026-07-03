---
name: use-67ify-api
description: Convert local image files into 67ify-style animated GIFs by calling a deployed or local 67ify REST API. Use when the user asks an agent to turn an image, emoji, avatar, sticker, or other image file into a 67 or 55 GIF using the 67ify API, or when integrating with the `/api/convert` endpoint.
---

# Use 67ify API

## Overview

Use the 67ify REST API to convert an uploaded image into an animated GIF. The
API is unauthenticated and accepts either `mode=67` or `mode=55`.

## Inputs

Require:

- API base URL, such as `https://example.vercel.app` or `http://localhost:3000`.
- Local input image path.
- Local output GIF path.

Optional:

- Mode: `67` or `55`. Default to `67` if the user does not specify one.

## Workflow

1. Resolve the API base URL.
	- Prefer a URL explicitly supplied by the user.
	- Otherwise use `API_BASE_URL` if it is set.
	- Otherwise use the deployed public instance: `https://67ify.vercel.app`.
	- If the user asks to use a local dev server, use `http://localhost:3000`.
2. Resolve the input image path and output GIF path.
3. Use `scripts/convert-image.sh` to call the API.
4. Confirm the output file exists and is non-empty before reporting success.

## Script

Run from the skill directory or pass the full path to the script:

```bash
bash scripts/convert-image.sh <api-base-url> <input-image> <output.gif> [67|55]
```

Examples:

```bash
bash scripts/convert-image.sh https://67ify.vercel.app ./input.png ./output.gif 67
bash scripts/convert-image.sh http://localhost:3000 ./avatar.webp ./avatar-55.gif 55
```

The script sends a multipart request to:

```text
POST <api-base-url>/api/convert
```

It writes the GIF response to the requested output path and exits non-zero if
the API returns an error.

## API Contract

Multipart fields:

- `image`: uploaded image file.
- `mode`: `67` or `55`.

Successful response:

- Status: `200`
- Content-Type: `image/gif`
- Body: generated GIF bytes

Common errors:

- `400`: missing image field.
- `413`: upload body exceeds 8 MB.
- `415`: unsupported body type.
- `500`: conversion failed.
