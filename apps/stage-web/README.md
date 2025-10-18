<h1 align="center">アイリ VTuber</h1>

<p align="center">
  [<a href="https://airi.ayaka.io">Try it</a>]
</p>

> Heavily inspired by [Neuro-sama](https://www.youtube.com/@Neurosama)

## YouTube Streaming Mode

The stage-web frontend includes a streaming-optimized mode for YouTube Live broadcasting. This mode allows you to customize the UI for a cleaner streaming experience.

### Environment Variables

Configure the following environment variables in `apps/stage-web/.env`:

```env
# YouTube Streaming Mode
# Enable streaming-optimized UI for YouTube Live broadcasting
VITE_STREAMING_MODE=false

# Show/hide header with logo and settings button
VITE_SHOW_HEADER=true

# Show/hide LLM responses in chat history (keep user messages visible)
VITE_SHOW_LLM_RESPONSES=true

# Show/hide text input area (during streaming, messages come from YouTube chat)
VITE_SHOW_TEXT_INPUT=true
```

### Features

- **Header Toggle**: Hide the header (logo and settings) to maximize screen space for character and chat
- **LLM Response Toggle**: Show only user messages in chat while LLM responses play via TTS audio
- **Text Input Toggle**: Hide the local text input area during streaming (messages come from YouTube chat)
- **YouTube Username Display**: Display YouTube usernames dynamically in chat instead of generic labels
- **Enhanced License Notice**: Logo and improved visibility with subtle styling

### Usage

For YouTube Live streaming:

```env
VITE_STREAMING_MODE=true
VITE_SHOW_HEADER=false
VITE_SHOW_LLM_RESPONSES=false
VITE_SHOW_TEXT_INPUT=false
```

For local development:

```env
VITE_STREAMING_MODE=false
VITE_SHOW_HEADER=true
VITE_SHOW_LLM_RESPONSES=true
VITE_SHOW_TEXT_INPUT=true
```

## Idle Talk Feature

The idle talk feature automatically starts conversations when there is no user input for a specified time. It selects random topics from the Knowledge Database and generates natural responses with TTS audio playback.

### Requirements

- Knowledge Database must be enabled (`VITE_KNOWLEDGE_DB_ENABLED=true`)
- Knowledge Database must have stored posts with vector embeddings
- LLM and TTS providers must be configured

### Environment Variables

Configure the following environment variables in `apps/stage-web/.env`:

```env
# Idle Talk Feature
# Automatically start conversation when no user input for specified time
# Requires VITE_KNOWLEDGE_DB_ENABLED=true
VITE_IDLE_TALK_ENABLED=false

# Idle timeout in milliseconds (default: 60000ms = 60 seconds)
VITE_IDLE_TIMEOUT=60000

# Topic selection mode: 'random' or 'sequential' (currently only 'random' is supported)
VITE_IDLE_TALK_MODE=random

# Minimum similarity threshold for random topic selection (0-1)
VITE_IDLE_TALK_MIN_SIMILARITY=0.0
```

### Features

- **Timer-based Idle Detection**: Monitors user inactivity using configurable timeout
- **Random Topic Selection**: Fetches 5 random topics from Knowledge DB and picks one randomly
- **Automatic LLM Response**: Generates contextual responses based on selected topics
- **TTS Audio Playback**: Automatically converts responses to speech using configured TTS provider
- **Auto-reset Timer**: Resets idle timer whenever user sends a message
- **Environment Toggle**: Enable/disable feature via `VITE_IDLE_TALK_ENABLED`

### How It Works

1. **Idle Detection**: Timer starts when app loads and resets on user interaction
2. **Topic Retrieval**: When timeout occurs, fetches 5 random topics from Knowledge DB
3. **Topic Selection**: Randomly selects one topic from the results
4. **Prompt Building**: Creates a prompt asking the character to talk about the topic
5. **LLM Generation**: Sends prompt to configured LLM provider
6. **TTS Playback**: Converts response to speech and plays audio
7. **Timer Reset**: Restarts idle timer for next iteration

### Example Configuration

For active idle talk during streaming:

```env
# Enable Knowledge DB
VITE_KNOWLEDGE_DB_ENABLED=true
VITE_KNOWLEDGE_DB_URL=http://localhost:3100

# Enable Idle Talk
VITE_IDLE_TALK_ENABLED=true
VITE_IDLE_TIMEOUT=60000  # 60 seconds
```

For disabled idle talk:

```env
VITE_IDLE_TALK_ENABLED=false
```

### Integration with Knowledge DB

The idle talk feature uses the `/knowledge/random` endpoint:

```
GET http://localhost:3100/knowledge/random?limit=5
```

This endpoint returns random posts from the knowledge database without requiring similarity search, making it ideal for diverse topic selection.
