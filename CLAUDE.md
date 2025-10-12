# Development with Claude Code

This document tracks development work done using Claude Code, an AI-powered coding assistant by Anthropic.

# 言語設定

このプロジェクトでは**日本語**での応答を行ってください。コード内のコメント、ログメッセージ、エラーメッセージ、ドキュメンテーション文字列なども日本語で記述してください。

## 開発ルール

### コーディング規約

- Python: PEP 8準拠
- 関数名: snake_case
- クラス名: PascalCase
- 定数: UPPER_SNAKE_CASE
- Docstring: Google Style

## Git運用

- ブランチ戦略: feature/*, fix/*, refactor/*
- コミットメッセージ: 英文を使用、動詞から始める
- PRはmainブランチへ

## 開発ガイドライン

### ドキュメント更新プロセス

機能追加やPhase完了時には、以下のドキュメントを同期更新する：

1. **CLAUDE.md**: プロジェクト全体状況、Phase完了記録、技術仕様
2. **README.md**: ユーザー向け機能概要、実装状況、使用方法

### コミットメッセージ規約

#### コミット粒度

- **1コミット = 1つの主要な変更**: 複数の独立した機能や修正を1つのコミットにまとめない
- **論理的な単位でコミット**: 関連する変更は1つのコミットにまとめる
- **段階的コミット**: 大きな変更は段階的に分割してコミット

#### プレフィックスと絵文字

- ✨ feat: 新機能
- 🐞 fix: バグ修正
- 📚 docs: ドキュメント
- 🎨 style: コードスタイル修正
- 🛠️ refactor: リファクタリング
- ⚡ perf: パフォーマンス改善
- ✅ test: テスト追加・修正
- 🏗️ chore: ビルド・補助ツール
- 🚀 deploy: デプロイ
- 🔒 security: セキュリティ修正
- 📝 update: 更新・改善
- 🗑️ remove: 削除

**重要**: Claude Codeを使用してコミットする場合は、必ず以下の署名を含める：

```text
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Session History

### 2025-10-10: YouTube Live Chat Integration

**Branch**: `feat/youtube-live-chat-integration`

**Objective**: Implement YouTube Live Chat integration to enable AIRI to interact with viewers during YouTube live streams, similar to Discord and Telegram bot integrations.

#### Tasks Completed

1. ✅ **Project Investigation**
   - Analyzed existing bot implementations (Discord, Telegram)
   - Reviewed project structure and conventions
   - Identified integration patterns and dependencies

2. ✅ **Architecture Design**
   - Designed YouTube Live Chat polling system
   - Planned OAuth 2.0 authentication flow
   - Outlined message handling and AI response pipeline

3. ✅ **Implementation**
   - Created complete YouTube bot service in `services/youtube-bot/`
   - Implemented OAuth 2.0 authentication (`youtube/auth.ts`)
   - Built YouTube API client wrapper (`youtube/client.ts`)
   - Developed live chat polling mechanism (`youtube/live-chat-poller.ts`)
   - Created message handler with LLM and TTS integration (`handlers/message-handler.ts`)
   - Set up main entry point with graceful shutdown (`index.ts`)

4. ✅ **Configuration**
   - Created `package.json` with appropriate dependencies
   - Set up TypeScript configuration (`tsconfig.json`)
   - Provided environment variable template (`.env.example`)
   - Defined TypeScript types (`types.ts`)

5. ✅ **Documentation**
   - Created comprehensive README for youtube-bot service
   - Added integration guide to project documentation (`docs/content/en/docs/integrations/youtube-live-chat.md`)
   - Documented setup process, configuration options, and troubleshooting

#### Files Created

```
services/youtube-bot/
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── .env.example                     # Environment variable template
├── README.md                        # Service-specific documentation
└── src/
    ├── index.ts                     # Main entry point
    ├── types.ts                     # TypeScript type definitions
    ├── youtube/
    │   ├── auth.ts                  # OAuth 2.0 authentication
    │   ├── client.ts                # YouTube API client wrapper
    │   └── live-chat-poller.ts      # Live chat polling logic
    └── handlers/
        └── message-handler.ts       # Message processing with LLM/TTS

docs/content/en/docs/integrations/
└── youtube-live-chat.md             # Integration documentation
```

#### Technical Decisions

**YouTube API Approach**
- Used polling-based approach (YouTube doesn't provide WebSocket API)
- Implemented 5-second default polling interval (configurable)
- Added message deduplication using Set of processed IDs
- Respects YouTube's recommended `pollingIntervalMillis` from API responses

**Authentication**
- OAuth 2.0 with refresh token for long-running sessions
- Separate authentication script (`pnpm auth`) for token generation
- Secure credential storage in `.env` file

**Message Processing**
- LLM integration via existing `@xsai/generate-text` package
- TTS integration via existing `@xsai/generate-speech` package
- Conversation history management (max 20 messages)
- Special handling for Super Chats with amount display

**Architecture Pattern**
- Followed existing bot patterns (Discord/Telegram)
- Separation of concerns: Client → Poller → Handler
- Used existing logging infrastructure (`@guiiai/logg`)
- Consistent error handling and graceful shutdown

#### API Usage Considerations

- **Quota**: YouTube Data API v3 has 10,000 units/day limit
- **Cost per poll**: ~1 unit per `liveChatMessages.list` call
- **Estimated capacity**: ~10,000 polls/day at 5-second intervals
- **Optimization**: Polling interval adjusts based on YouTube's recommendations

#### Dependencies Added

```json
{
  "googleapis": "^140.0.0", // YouTube Data API v3 client
  "google-auth-library": "^9.0.0", // OAuth 2.0 authentication
  "@xsai/generate-text": "catalog:", // LLM integration (existing)
  "@xsai/generate-speech": "catalog:", // TTS integration (existing)
  "@guiiai/logg": "catalog:", // Logging (existing)
  "@dotenvx/dotenvx": "^1.51.0" // Environment variable management
}
```

#### Integration Features

- ✅ Real-time chat monitoring (2-5 second latency)
- ✅ AI-powered response generation
- ✅ Text-to-Speech audio file creation
- ✅ Super Chat detection and special handling
- ✅ Conversation context management
- ✅ Automatic message deduplication
- ✅ Graceful error handling and recovery
- ✅ OBS-compatible audio output

#### Known Limitations

1. **Polling Delay**: 2-10 seconds due to polling-based approach (no WebSocket API available from YouTube)
2. **API Quota**: Limited to 10,000 units/day (manageable with proper interval configuration)
3. **No Direct Chat Posting**: Current implementation generates audio only; chat posting is optional and requires additional quota
4. **Single Stream**: Bot connects to one active stream at a time (can run multiple instances for multiple streams)

#### Future Enhancements

Potential improvements for future iterations:

- [ ] Chat message posting (optional feature)
- [ ] Multi-stream support in single instance
- [ ] Advanced message filtering (spam detection, user blacklist)
- [ ] Sentiment analysis for adaptive responses
- [ ] Integration with OBS WebSocket for automatic audio playback
- [ ] Chat statistics and analytics
- [ ] Custom command handling (e.g., `!help`, `!info`)
- [ ] Member-only chat support
- [ ] Emoji and sticker interpretation
- [ ] Translation support for multilingual chats

#### Testing Recommendations

To test the implementation:

1. Set up Google Cloud Console project and OAuth credentials
2. Run authentication flow: `pnpm auth`
3. Configure `.env` with all required credentials
4. Start a YouTube live stream
5. Run the bot: `pnpm -F @proj-airi/youtube-bot start`
6. Send test messages in the live chat
7. Verify audio files are generated in `audio-output/`
8. Test Super Chat functionality
9. Verify conversation context is maintained
10. Test graceful shutdown (Ctrl+C)

#### Environment Setup

Required environment variables:

```env
# YouTube OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REFRESH_TOKEN=1//0xxx

# LLM Provider
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=sk-xxx

# TTS Provider
TTS_PROVIDER=openai-audio-speech
TTS_MODEL=tts-1
TTS_VOICE=alloy
TTS_API_KEY=sk-xxx

# Configuration
POLLING_INTERVAL_MS=5000
AUDIO_OUTPUT_DIR=./audio-output
LOG_LEVEL=info
```

#### Documentation Structure

```
docs/content/en/docs/integrations/youtube-live-chat.md
├── Overview
├── Prerequisites
├── Setup Instructions
│   ├── 1. Enable YouTube Data API v3
│   ├── 2. Configure Environment Variables
│   ├── 3. Authenticate with Google
│   └── 4. Install Dependencies
├── Running the Bot
├── OBS Integration (3 methods)
├── Configuration Options
├── Technical Details
│   ├── Architecture Diagram
│   └── API Usage and Limitations
├── Troubleshooting
├── Advanced Usage
└── Development Information
```

---

## Development Workflow with Claude Code

### Approach

1. **Investigation Phase**
   - Read existing implementations
   - Understand project conventions
   - Identify integration patterns

2. **Planning Phase**
   - Design architecture
   - Plan file structure
   - Define interfaces and types

3. **Implementation Phase**
   - Follow existing patterns
   - Write modular, testable code
   - Use project's existing utilities

4. **Documentation Phase**
   - Create README for the service
   - Add integration guide to docs
   - Document setup and troubleshooting

### Code Quality Standards

- **TypeScript**: Strict type checking enabled
- **Error Handling**: Comprehensive try-catch blocks with logging
- **Logging**: Consistent use of `@guiiai/logg`
- **Configuration**: Environment-based configuration
- **Code Style**: Followed existing ESLint configuration

### Lessons Learned

1. **Pattern Recognition**: Existing Discord/Telegram bots provided excellent templates
2. **Incremental Development**: Building in logical order (auth → client → poller → handler)
3. **Documentation First**: Creating clear documentation helps validate design
4. **API Limitations**: YouTube's polling-only approach requires different architecture than WebSocket-based platforms

---

## How to Use This Document

This document serves as:

1. **Development Log**: Track what was built and why
2. **Decision Record**: Document technical decisions and trade-offs
3. **Knowledge Transfer**: Help future developers understand the codebase
4. **Context Preservation**: Maintain context across sessions

### For Future Sessions

When continuing this work:

1. Review this document first
2. Check the git branch status
3. Review TODO items (if any)
4. Continue implementation or start new features

### Contributing

If you're using Claude Code to contribute to this project:

1. Read this document to understand existing work
2. Follow the established patterns
3. Update this document with your session notes
4. Maintain consistency with project conventions

---

## Resources

- [Claude Code Documentation](https://docs.claude.com/claude-code)
- [YouTube Data API v3](https://developers.google.com/youtube/v3)
- [Project AIRI Repository](https://github.com/moeru-ai/airi)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

---

**Last Updated**: 2025-10-10
**Claude Code Version**: Sonnet 4.5 (claude-sonnet-4-5-20250929)
**Session Type**: Implementation Session
