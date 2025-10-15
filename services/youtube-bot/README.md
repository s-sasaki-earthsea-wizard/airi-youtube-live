# YouTube Live Chat Bot for AIRI

A bot that integrates AIRI with YouTube Live Chat, allowing the AI to interact with viewers during live streams.

## Features

- ✅ Real-time YouTube Live Chat message monitoring
- ✅ LLM-powered responses using various providers (OpenAI, Anthropic, etc.)
- ✅ Text-to-Speech (TTS) audio generation
- ✅ Super Chat detection and special handling
- ✅ Conversation history management
- ✅ Automatic audio file storage

## Prerequisites

- Node.js 23+
- pnpm
- Google Cloud Console project with YouTube Data API v3 enabled
- LLM API key (OpenAI, Anthropic, etc.)
- An active YouTube live stream

## Setup

### 1. Enable YouTube Data API v3

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **YouTube Data API v3**
4. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
5. Select **Desktop app** as the application type
6. Download the credentials JSON file

### 2. Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# LLM Configuration
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=your-openai-api-key

# TTS Configuration
TTS_PROVIDER=openai-audio-speech
TTS_MODEL=tts-1
TTS_VOICE=alloy
TTS_API_KEY=your-openai-api-key
```

### 3. Authenticate with Google

Run the authentication script to generate a refresh token:

```bash
pnpm auth
```

This will:
1. Display a URL to authorize the app
2. Ask you to paste the authorization code
3. Generate a `GOOGLE_REFRESH_TOKEN`

Add the refresh token to your `.env` file:

```bash
GOOGLE_REFRESH_TOKEN=your-refresh-token
```

### 4. Install Dependencies

From the AIRI root directory:

```bash
pnpm install
```

## Usage

### Start the Bot

Make sure you have an **active live stream** on YouTube, then run:

```bash
pnpm -F @proj-airi/youtube-bot start
```

The bot will:
1. Connect to your active live stream
2. Start monitoring the live chat
3. Respond to messages using AI
4. Generate TTS audio files in `./audio-output/`

### Output

Generated audio files are saved to the directory specified in `AUDIO_OUTPUT_DIR` (default: `./audio-output/`).

You can use these audio files with:
- OBS (Open Broadcaster Software) via browser source or media source
- Virtual audio cables (VB-Audio, etc.)
- Any audio playback tool

## Configuration

All configuration is done via environment variables in `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console | (required) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | (required) |
| `GOOGLE_REFRESH_TOKEN` | Generated refresh token | (required) |
| `POLLING_INTERVAL_MS` | Message polling interval | 5000 |
| `MAX_MESSAGES_PER_POLL` | Max messages per poll | 50 |
| `LLM_PROVIDER` | LLM provider (openai, anthropic, etc.) | openai |
| `LLM_MODEL` | Model to use | gpt-4o-mini |
| `LLM_API_KEY` | API key for LLM | (required) |
| `TTS_PROVIDER` | TTS provider | openai-audio-speech |
| `TTS_MODEL` | TTS model | tts-1 |
| `TTS_VOICE` | Voice to use | alloy |
| `TTS_API_KEY` | API key for TTS | (uses LLM_API_KEY) |
| `AUDIO_OUTPUT_DIR` | Output directory for audio files | ./audio-output |
| `LOG_LEVEL` | Logging level (info, debug) | info |

## Architecture

```
youtube-bot/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── types.ts                    # TypeScript types
│   ├── youtube/
│   │   ├── auth.ts                 # OAuth 2.0 authentication
│   │   ├── client.ts               # YouTube API client
│   │   └── live-chat-poller.ts     # Live chat polling logic
│   └── handlers/
│       └── message-handler.ts      # Message processing & AI responses
```

## Limitations

- **API Quota**: YouTube Data API v3 has a quota of 10,000 units/day
- **Polling Delay**: 2-10 seconds delay due to polling-based approach (no WebSocket API available)
- **No Direct Chat Response**: Generated responses are audio files only (cannot post to chat without additional implementation)

## Troubleshooting

### "No active live broadcasts found"

- Make sure you have started a live stream on YouTube
- Verify that the OAuth credentials have access to your channel
- Check that the YouTube Data API v3 is enabled

### Authentication Errors

- Re-run `pnpm auth` to generate a new refresh token
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check that your OAuth client is configured for "Desktop app"

### API Quota Exceeded

- Reduce `POLLING_INTERVAL_MS` (increase delay between polls)
- The bot uses approximately 1 unit per poll

## Integration with OBS

To play the generated audio in your stream:

1. Add a **Media Source** in OBS
2. Point it to the `audio-output` directory
3. Configure it to play the latest file
4. Alternatively, use a browser source with a custom HTML file that monitors the directory

## License

MIT
