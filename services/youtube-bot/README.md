# YouTube Live Chat Bot for AIRI

A lightweight bot that connects AIRI to YouTube Live Chat, forwarding messages to stage-web for processing.

## Features

- ✅ Real-time YouTube Live Chat message monitoring
- ✅ Super Chat detection and metadata forwarding
- ✅ Automatic message forwarding to AIRI Server
- ✅ Minimal dependencies and simple architecture

## Architecture

```
┌─────────────────┐
│  YouTube Live   │
│     Chat        │
└────────┬────────┘
         │ (polling)
         ▼
┌─────────────────┐
│  youtube-bot    │
│  (lightweight)  │
└────────┬────────┘
         │ WebSocket
         ▼
┌─────────────────┐
│  AIRI Server    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   stage-web     │
│  • LLM Response │
│  • TTS Audio    │
│  • Knowledge DB │
└─────────────────┘
```

**youtube-bot** is responsible for:
- Connecting to YouTube Live Chat via YouTube Data API v3
- Polling for new messages
- Forwarding messages to AIRI Server

**stage-web** handles:
- LLM response generation
- Text-to-Speech (TTS) audio synthesis
- Knowledge Database integration (RAG)
- Live2D character animation

This separation allows for better maintainability and feature reuse across multiple chat platforms (YouTube, Discord, Telegram, etc.).

## Prerequisites

- Node.js 23+
- pnpm
- Google Cloud Console project with YouTube Data API v3 enabled
- An active YouTube live stream

## Setup

### 1. Enable YouTube Data API v3

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **YouTube Data API v3**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the API key

### 2. Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your credentials
YOUTUBE_API_KEY=your-api-key
YOUTUBE_VIDEO_ID=your-video-id
AIRI_SERVER_URL=ws://localhost:6121/ws
```

### 3. Install Dependencies

From the AIRI root directory:

```bash
pnpm install
```

## Usage

### Start the Bot

Make sure you have:
1. An **active live stream** on YouTube
2. **AIRI Server** running (usually started with stage-web)
3. **stage-web** running (for LLM/TTS processing)

Then run:

```bash
pnpm -F @proj-airi/youtube-bot start
```

The bot will:
1. Connect to your active live stream
2. Start monitoring the live chat
3. Forward messages to AIRI Server
4. stage-web will generate AI responses and audio

## Configuration

All configuration is done via environment variables in `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `YOUTUBE_API_KEY` | API Key from Google Cloud Console | (required) |
| `YOUTUBE_VIDEO_ID` | Video ID from live stream URL | (required) |
| `POLLING_INTERVAL_MS` | Message polling interval | 5000 |
| `MAX_MESSAGES_PER_POLL` | Max messages per poll | 50 |
| `AIRI_SERVER_URL` | AIRI Server WebSocket URL | ws://localhost:6121/ws |
| `AIRI_SERVER_TOKEN` | Optional authentication token | (optional) |
| `LOG_LEVEL` | Logging level (info, debug) | info |

## Limitations

- **API Quota**: YouTube Data API v3 has a quota of 10,000 units/day
  - Each poll uses approximately 1 unit
  - Each video info request uses 1 unit
- **Polling Delay**: 2-10 seconds delay due to polling-based approach (no WebSocket API available)
- **Read-Only**: This bot only reads messages and cannot post to chat

## Troubleshooting

### "No active live broadcasts found"

- Make sure you have started a live stream on YouTube
- Verify that the API key has access to your channel
- Check that the YouTube Data API v3 is enabled

### API Quota Exceeded

- Reduce `POLLING_INTERVAL_MS` (increase delay between polls)
- Consider using a different API key with a fresh quota

### Messages not appearing in stage-web

- Verify that AIRI Server is running
- Check that stage-web is connected to AIRI Server
- Verify `AIRI_SERVER_URL` matches the server's WebSocket URL

## Development

### Type Checking

```bash
pnpm -F @proj-airi/youtube-bot typecheck
```

### Architecture Notes

This bot is intentionally kept minimal. All AI processing happens in stage-web to:
- Reduce code duplication
- Enable Knowledge DB integration
- Allow easy addition of new chat platforms
- Centralize LLM and TTS configuration

## License

MIT
