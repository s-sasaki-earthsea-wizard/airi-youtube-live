.PHONY: help stream stream-stop dev-server dev-web dev-youtube test-youtube stop

# デフォルトターゲット: ヘルプを表示
help:
	@echo "AIRI Commands"
	@echo ""
	@echo "配信用:"
	@echo "  make stream           - Start streaming (AIRI Server + stage-web + YouTube Bot)"
	@echo "  make stream-stop      - Stop streaming"
	@echo ""
	@echo "開発用:"
	@echo "  make dev-server       - Start AIRI Server only (port 6121)"
	@echo "  make dev-web          - Start stage-web only (port 5173)"
	@echo "  make dev-youtube      - Start YouTube Bot only (port 3000)"
	@echo "  make test-youtube     - Send test message (without YouTube API)"
	@echo "  make stop             - Stop all services"
	@echo ""

# 配信開始（全サービス起動、ログ最小化）
stream:
	@echo "🎥 Starting streaming services..."
	@trap 'make stream-stop' INT; \
	pnpm -F @proj-airi/server-runtime dev > /dev/null 2>&1 & \
	sleep 3 && pnpm -F @proj-airi/stage-web dev > /dev/null 2>&1 & \
	sleep 3 && pnpm -F @proj-airi/youtube-bot start & \
	echo "✅ All services started"; \
	echo "📺 OBS: http://localhost:5173"; \
	echo "🛑 Stop: Ctrl+C or 'make stream-stop'"; \
	wait

# AIRI Server のみ起動
dev-server:
	@echo "🔌 Starting AIRI Server (port 6121)..."
	pnpm -F @proj-airi/server-runtime dev

# stage-web のみ起動
dev-web:
	@echo "🌐 Starting stage-web (port 5173)..."
	pnpm -F @proj-airi/stage-web dev

# YouTube Bot のみ起動
dev-youtube:
	@echo "📺 Starting YouTube Bot (port 3000 for audio)..."
	pnpm -F @proj-airi/youtube-bot start

# テストメッセージ送信
test-youtube:
	@echo "✉️  Sending test message to AIRI Server..."
	@read -p "Enter message (default: テストメッセージです): " msg; \
	pnpm -F @proj-airi/youtube-bot test-message "$${msg:-テストメッセージです}"

# 配信停止
stream-stop:
	@echo "🛑 Stopping streaming services..."
	@pkill -f "server-runtime" || true
	@pkill -f "stage-web" || true
	@pkill -f "youtube-bot" || true
	@echo "✅ Streaming stopped"

# すべてのサービスを停止（開発用）
stop:
	@echo "🛑 Stopping all services..."
	@pkill -f "server-runtime" || true
	@pkill -f "stage-web" || true
	@pkill -f "youtube-bot" || true
	@echo "✅ All services stopped"
