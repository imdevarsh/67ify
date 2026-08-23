# 67ify

A Slack bot that turns existing workspace emoji into animated `:emoji-67:`,
`:emoji-55:`, or sequential `:emoji-67-55:` variants.

Mention the bot with an emoji name:

```text
@67ify :party-parrot:
@67ify :party-parrot: 55
@67ify :a: :b: :c: 67
@67ify :a: :b: :c: 67-55
```

The bot reads the source emoji, renders a GIF with `sharp`, uploads the new
emoji to the workspace, replies in the thread, and reacts with the created
emoji.
Requests can include up to 20 emoji at once.

It also exposes a REST API for converting uploaded images without using
Slack.

The included web UI provides drag-and-drop uploads, `67`, `55`, and sequential
`67-55` mode selection, a result preview, and one-click GIF downloads.

## Setup

Install dependencies:

```bash
bun install
```

Create a local environment file:

```bash
cp .env.example .env
```

Fill in the Slack credentials:

```dotenv
SLACK_BOT_TOKEN=""
SLACK_SIGNING_SECRET=""
SLACK_APP_TOKEN="xapp-"
SLACK_EMOJI_PROXY_URL="https://your-proxy.vercel.app"
SLACK_EMOJI_PROXY_API_KEY="sep_key_..."
```

`SLACK_APP_TOKEN` is used for local Socket Mode development. Deploy
[slack-emoji-proxy](https://github.com/imdevarsh/slack-emoji-proxy), create an
API key from its Slack App Home, and configure its deployment URL and key as
`SLACK_EMOJI_PROXY_URL` and `SLACK_EMOJI_PROXY_API_KEY`. The proxy owns the
Slack browser session used for emoji uploads, so 67ify does not need a Slack
user token or cookie. Treat the proxy API key as a secret.

## Slack App

The included `slack-manifest.json` contains the required bot scopes:

- `app_mentions:read`
- `chat:write`
- `emoji:read`
- `reactions:write`

For local development, enable Socket Mode and add an app-level token with
`connections:write`.

For Vercel deployment, set the event request URL to:

```text
https://<your-deployment>/api/slack/events
```

## REST API

Convert an uploaded image to a `67`, `55`, or sequential `67-55` GIF:

```text
POST /api/convert
```

Multipart upload:

```bash
curl -X POST https://67ify.vercel.app/api/convert \
  -F "image=@input.png" \
  -F "mode=67" \
  --output output.gif
```

Raw image upload:

```bash
curl -X POST "https://67ify.vercel.app/api/convert?mode=55" \
  -H "Content-Type: image/png" \
  --data-binary "@input.png" \
  --output output.gif
```

The API accepts `mode=67`, `mode=55`, or `mode=67-55`. If omitted, it defaults
to `67`. The combined mode applies the complete 67 animation first, then runs
that animated result through the 55 transform.
Requests are unauthenticated and upload bodies are limited to 8 MB.

## Agent Skill

This repo includes a downloadable agent skill at `skills/use-67ify-api`. Copy
that folder into an agent skills directory to give an agent instructions and a
small script for calling the REST API.

## Development

Run the bot locally:

```bash
bun run start
```

Run the web app locally:

```bash
bun run dev:web
```

Then open `http://localhost:3000`. The local web server includes the conversion
API, so the full upload and download flow works without additional setup.

Check formatting and lint rules:

```bash
bun run check
```

## Deployment

This repository includes a Vercel route at `api/slack/events.ts` and a minimal
`vercel.json`. Configure the same environment variables in Vercel before
deploying.

Do not commit `.env`; it is intentionally ignored.
