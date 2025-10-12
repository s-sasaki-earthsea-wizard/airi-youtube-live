---
title: YouTube Live Chat Integration
description: Guide to integrating AIRI with YouTube Live streams
---

# YouTube Live Chat Integration

This guide explains how to integrate AIRI with YouTube Live Chat, enabling your AI VTuber to interact with viewers during live streams.

## Overview

The YouTube Live Chat bot monitors your live stream chat in real-time and generates AI-powered responses with text-to-speech audio. This creates an interactive streaming experience similar to Neuro-sama.

### Features

- ✅ Real-time chat message monitoring (2-5 second polling)
- ✅ AI-powered responses using LLM providers (OpenAI, Anthropic, etc.)
- ✅ Text-to-Speech audio generation
- ✅ Super Chat detection and special handling
- ✅ Conversation history management
- ✅ Automatic audio file storage for OBS integration

## Prerequisites

Before you begin, ensure you have:

- **Node.js 23+** installed
- **pnpm** package manager
- A **Google Cloud Console** project with YouTube Data API v3 enabled
- An **LLM API key** (OpenAI, Anthropic, or other supported provider)
- An **active YouTube channel** with streaming capabilities
- **OBS Studio** or similar streaming software (for audio playback)

## Setup Instructions

### 1. Enable YouTube Data API v3

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Library**
4. Search for "YouTube Data API v3" and enable it
5. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
6. Configure the OAuth consent screen if prompted
7. Select **Desktop app** as the application type
8. Give it a name (e.g., "AIRI YouTube Bot")
9. Download the credentials JSON file

### 2. Configure Environment Variables

Navigate to the YouTube bot directory and create your configuration:

```bash
cd services/youtube-bot
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# YouTube API Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=  # Will be generated in step 3

# LLM Configuration
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=sk-...

# TTS Configuration
TTS_PROVIDER=openai-audio-speech
TTS_MODEL=tts-1
TTS_VOICE=alloy
TTS_API_KEY=sk-...  # Can use the same as LLM_API_KEY

# Optional: Polling Configuration
POLLING_INTERVAL_MS=5000
MAX_MESSAGES_PER_POLL=50

# Optional: Output Directory
AUDIO_OUTPUT_DIR=./audio-output
```

### 3. Authenticate with Google

Run the authentication script to generate a refresh token:

```bash
pnpm auth
```

This interactive script will:
1. Display a URL for you to visit
2. Ask you to authorize the application
3. Prompt you to paste the authorization code
4. Generate a `GOOGLE_REFRESH_TOKEN`

Copy the refresh token and add it to your `.env` file:

```env
GOOGLE_REFRESH_TOKEN=1//0gXXXXXXXXXXXXXX...
```

### 4. Install Dependencies

From the AIRI root directory:

```bash
pnpm install
```

## Running the Bot

### Start a Live Stream

Before running the bot, you must have an **active live stream** on YouTube:

1. Go to [YouTube Studio](https://studio.youtube.com/)
2. Click **Go Live** or **Create** → **Go live**
3. Set up your stream settings
4. Start streaming

### Launch the Bot

Once your stream is active:

```bash
# From the AIRI root directory
pnpm -F @proj-airi/youtube-bot start
```

The bot will:
1. ✅ Connect to your active live stream
2. ✅ Start monitoring the live chat
3. ✅ Generate AI responses to viewer messages
4. ✅ Save TTS audio files to `audio-output/`

### Expected Output

```
[YouTubeBot] Searching for active live broadcasts...
[YouTubeBot] Connected to live broadcast: "My Stream Title"
[YouTubeBot] Starting live chat poller
[YouTubeBot] YouTube bot is now running. Press Ctrl+C to stop.
[YouTubeBot] Processing message: "Hello AIRI!"
[YouTubeBot] Generated AI response: "Hello! Thanks for joining the stream!"
[YouTubeBot] Audio file saved: ./audio-output/1234567890-msg_id.mp3
```

## OBS Integration

To play the generated audio in your live stream:

### Method 1: Media Source (Recommended)

1. Add a **Media Source** in OBS
2. Configure it to monitor the `audio-output` directory
3. Set it to play the latest file automatically
4. Adjust volume levels as needed

### Method 2: Browser Source

1. Create a custom HTML file that monitors the `audio-output` directory
2. Add a **Browser Source** in OBS
3. Point it to your HTML file
4. The browser source will automatically play new audio files

### Method 3: Virtual Audio Cable

1. Install a virtual audio cable (VB-Audio VoiceMeeter, etc.)
2. Route the bot's audio output through the virtual cable
3. Capture the virtual cable as an audio source in OBS

## Configuration Options

All configuration is done via environment variables in `.env`:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console | - | ✅ |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | - | ✅ |
| `GOOGLE_REFRESH_TOKEN` | Generated refresh token | - | ✅ |
| `POLLING_INTERVAL_MS` | Message polling interval (milliseconds) | 5000 | ❌ |
| `MAX_MESSAGES_PER_POLL` | Max messages to fetch per poll | 50 | ❌ |
| `LLM_PROVIDER` | LLM provider (openai, anthropic, etc.) | openai | ✅ |
| `LLM_MODEL` | Model to use for responses | gpt-4o-mini | ✅ |
| `LLM_API_KEY` | API key for LLM provider | - | ✅ |
| `TTS_PROVIDER` | TTS provider | openai-audio-speech | ❌ |
| `TTS_MODEL` | TTS model to use | tts-1 | ❌ |
| `TTS_VOICE` | Voice for TTS | alloy | ❌ |
| `TTS_API_KEY` | API key for TTS (uses LLM_API_KEY if not set) | - | ❌ |
| `AUDIO_OUTPUT_DIR` | Output directory for audio files | ./audio-output | ❌ |
| `LOG_LEVEL` | Logging level (info, debug) | info | ❌ |

## Technical Details

### Architecture

```
┌─────────────────┐
│ YouTube Live    │
│ Chat API        │
└────────┬────────┘
         │ Polling (2-5s)
         ↓
┌─────────────────┐
│ Live Chat       │
│ Poller          │
└────────┬────────┘
         │ New Messages
         ↓
┌─────────────────┐
│ Message         │
│ Handler         │
└────┬────────┬───┘
     │        │
     ↓        ↓
┌─────────┐ ┌──────────┐
│   LLM   │ │   TTS    │
│ (OpenAI)│ │ (OpenAI) │
└────┬────┘ └────┬─────┘
     │           │
     └─────┬─────┘
           ↓
    ┌──────────────┐
    │ Audio Files  │
    │ (.mp3)       │
    └──────────────┘
           ↓
    ┌──────────────┐
    │     OBS      │
    │  Streaming   │
    └──────────────┘
```

### API Usage and Limitations

- **YouTube API Quota**: 10,000 units per day
- **Polling Cost**: ~1 unit per poll
- **Estimated Polls/Day**: ~10,000 polls (with 5s interval ≈ 17,280 polls/day max)
- **Delay**: 2-10 seconds due to polling (no real-time WebSocket API)

### Super Chat Handling

The bot automatically detects Super Chats and adds special context to the AI:

```
[SUPER CHAT USD 5.00] Username: Thank you AIRI!
```

The AI will respond with extra appreciation for Super Chat supporters.

## Troubleshooting

### "No active live broadcasts found"

**Cause**: The bot cannot find an active stream.

**Solutions**:
- Verify you have started a live stream on YouTube
- Check that the stream status is "Live" (not "Upcoming")
- Ensure OAuth credentials have access to your channel
- Confirm YouTube Data API v3 is enabled

### Authentication Errors

**Cause**: Invalid or expired OAuth credentials.

**Solutions**:
- Re-run `pnpm auth` to generate a new refresh token
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check that your OAuth client is configured for "Desktop app"
- Ensure the OAuth consent screen is properly configured

### API Quota Exceeded

**Cause**: Too many API calls in 24 hours.

**Solutions**:
- Increase `POLLING_INTERVAL_MS` to reduce polling frequency
- Monitor usage in [Google Cloud Console](https://console.cloud.google.com/)
- Request a quota increase if needed

### Audio Not Playing in OBS

**Cause**: OBS source configuration issue.

**Solutions**:
- Verify audio files are being created in `audio-output/`
- Check OBS source is pointing to the correct directory
- Ensure audio format is supported (.mp3)
- Test audio files manually to confirm they work

### LLM Not Responding

**Cause**: API key issue or provider error.

**Solutions**:
- Verify `LLM_API_KEY` is correct
- Check API key has sufficient credits/quota
- Review logs for specific error messages
- Try a different model (e.g., `gpt-3.5-turbo`)

## Advanced Usage

### Custom System Prompt

Edit `src/handlers/message-handler.ts` to customize the AI's personality:

```typescript
message.system(
  'You are AIRI, a [your custom personality description]. '
  + 'Respond naturally to chat messages...'
)
```

### Multiple Stream Handling

To monitor multiple streams simultaneously, run multiple instances of the bot with different configurations.

### Chat Posting (Optional)

The bot currently generates audio only. To post responses back to YouTube chat, uncomment and implement the chat posting logic in `src/handlers/message-handler.ts`:

```typescript
// await youtubeClient.sendLiveChatMessage(liveChatId, response)
```

**Note**: Posting to chat requires additional quota usage.

## Development

### File Structure

```
services/youtube-bot/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── types.ts                    # TypeScript types
│   ├── youtube/
│   │   ├── auth.ts                 # OAuth 2.0 authentication
│   │   ├── client.ts               # YouTube API client
│   │   └── live-chat-poller.ts     # Live chat polling logic
│   └── handlers/
│       └── message-handler.ts      # Message processing & AI
├── package.json
├── tsconfig.json
└── .env.example
```

### Type Checking

```bash
pnpm -F @proj-airi/youtube-bot typecheck
```

### Debugging

Enable debug logging:

```env
LOG_LEVEL=debug
```

## Comparison with Other Platforms

| Feature | YouTube | Discord | Telegram |
|---------|---------|---------|----------|
| Real-time | ❌ (2-5s delay) | ✅ | ✅ |
| API Quota | 10k/day | Unlimited | Unlimited |
| Super Chat | ✅ | ✅ (Nitro) | ❌ |
| Voice | ❌ (TTS only) | ✅ | ❌ |
| Streaming | ✅ | ✅ | ❌ |

## Related Documentation

- [Discord Bot Integration](../discord-bot/README.md)
- [Telegram Bot Integration](../telegram-bot/README.md)
- [LLM Provider Configuration](../overview/guide/llm-providers.md)
- [TTS Configuration](../overview/guide/tts-setup.md)

## Contributing

Found a bug or want to improve the YouTube integration? Please see our [Contributing Guide](../../CONTRIBUTING.md).

## License

MIT License - see [LICENSE](../../LICENSE) for details.
