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
