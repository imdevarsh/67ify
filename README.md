# 67ify

A Slack bot that turns existing workspace emoji into animated `:emoji-67:` or
`:emoji-55:` variants.

Mention the bot with an emoji name:

```text
@67ify :party-parrot:
@67ify :party-parrot: 55
```

The bot reads the source emoji, renders a GIF with `sharp`, uploads the new
emoji to the workspace, replies in the thread, and reacts with the created
emoji.

It also exposes a REST API for converting uploaded images without using
Slack.

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
SLACK_USER_XOXC=""
SLACK_COOKIE=""
```

`SLACK_APP_TOKEN` is used for local Socket Mode development. The `SLACK_USER_XOXC`
and `SLACK_COOKIE` values are used to call Slack's emoji upload endpoint, which
is not part of Slack's normal bot Web API. Treat both as sensitive user session
credentials.

## Slack App

The included `slack-manifest.json` contains the required bot scopes:

- `team:read`
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

Convert an uploaded image to a `67` or `55` GIF:

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

The API accepts `mode=67` or `mode=55`. If omitted, it defaults to `67`.
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

Check formatting and lint rules:

```bash
bun run check
```

## Deployment

This repository includes a Vercel route at `api/slack/events.ts` and a minimal
`vercel.json`. Configure the same environment variables in Vercel before
deploying.

Do not commit `.env`; it is intentionally ignored.
