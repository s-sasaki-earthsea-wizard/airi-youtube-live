.PHONY: help stream stream-stop dev-server dev-web dev-youtube test-youtube stop \
        db-setup db-start db-stop db-status

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
	@echo "Knowledge DB:"
	@echo "  make db-setup         - Initial setup (install deps + start DB + apply schema)"
	@echo "  make db-start         - Start knowledge-db service (DB + API server)"
	@echo "  make db-stop          - Stop knowledge-db service"
	@echo "  make db-status        - Check knowledge-db status"
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

# ========================================
# Knowledge DB Commands
# ========================================

# 初回セットアップ（依存関係インストール + DB起動 + スキーマ適用）
db-setup:
	@echo "🔧 Setting up knowledge-db (first time)..."
	@echo "📦 Installing dependencies..."
	@pnpm install
	@echo "🐳 Starting PostgreSQL container..."
	@cd services/knowledge-db && docker-compose up -d
	@echo "⏳ Waiting for database to be ready..."
	@sleep 5
	@echo "🗄️  Generating database schema..."
	@cd services/knowledge-db && pnpm db:generate
	@echo "📊 Applying schema to database..."
	@cd services/knowledge-db && pnpm db:push
	@echo "✅ Knowledge DB setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  - Start API server: make db-start"
	@echo "  - Check status: make db-status"

# knowledge-db サービス起動（DB + API server）
db-start:
	@echo "🚀 Starting knowledge-db service..."
	@cd services/knowledge-db && docker-compose up -d
	@sleep 2
	@echo "🌐 Starting API server (port 3100)..."
	@cd services/knowledge-db && pnpm start > /dev/null 2>&1 &
	@sleep 2
	@echo "✅ Knowledge DB started"
	@echo ""
	@echo "Endpoints:"
	@echo "  - Health: http://localhost:3100/health"
	@echo "  - Posts:  http://localhost:3100/posts"
	@echo "  - Query:  http://localhost:3100/knowledge?query=xxx"

# knowledge-db サービス停止
db-stop:
	@echo "🛑 Stopping knowledge-db service..."
	@pkill -f "knowledge-db.*tsx" || true
	@cd services/knowledge-db && docker-compose down
	@echo "✅ Knowledge DB stopped"

# knowledge-db ステータス確認
db-status:
	@echo "📊 Knowledge DB Status"
	@echo ""
	@echo "🐳 Docker Containers:"
	@cd services/knowledge-db && docker-compose ps || echo "  ❌ Not running"
	@echo ""
	@echo "🌐 API Server:"
	@curl -s http://localhost:3100/health 2>/dev/null | jq . || echo "  ❌ Not running (port 3100)"
