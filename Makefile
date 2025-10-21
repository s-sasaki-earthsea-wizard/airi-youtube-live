.PHONY: help stream stream-stop dev-server dev-web dev-youtube test-youtube test-message stop stop-all \
        db-setup db-start db-stop db-restart db-status db-export db-sync-discord db-danger-clear-all \
        collect-discord collect-discord-stop collect-discord-restart \
        test-query-expansion

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
	@echo "  make test-youtube     - Send test message interactively (prompts for input)"
	@echo "  make test-message MSG='text' - Send test message directly"
	@echo "  make stop             - Stop all services"
	@echo ""
	@echo "テスト:"
	@echo "  make test-query-expansion - Test LLM-based query expansion for Knowledge DB"
	@echo ""
	@echo "Knowledge DB:"
	@echo "  make db-setup              - Initial setup (install deps + start DB + apply schema)"
	@echo "  make db-start              - Start knowledge-db service (DB + API server)"
	@echo "  make db-stop               - Stop knowledge-db service"
	@echo "  make db-restart            - Restart knowledge-db service (stop → start)"
	@echo "  make db-status             - Check knowledge-db status"
	@echo "  make db-export             - Export database to JSON file"
	@echo "  make db-sync-discord       - Sync ALL Discord messages (default, unlimited)"
	@echo "  make db-sync-discord LIMIT=N - Sync only last N Discord messages"
	@echo "  make collect-discord       - Start Discord message collector"
	@echo "  make collect-discord-stop  - Stop Discord message collector"
	@echo "  make collect-discord-restart - Restart Discord message collector"
	@echo ""
	@echo "⚠️  DANGER ZONE (requires confirmation):"
	@echo "  make db-danger-clear-all   - ⚠️  DELETE ALL records (can restore with db-sync-discord)"
	@echo ""

# 配信開始（全サービス起動、ログ最小化）
stream:
	@make stop-all
	@echo "🗑️ Removing obs-browser cache..."
	rm -rf ~/Library/Application\ Support/obs-studio/plugin_config/obs-browser/*
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

# テストメッセージ送信（インタラクティブ）
test-youtube:
	@echo "✉️  Sending test message to AIRI Server..."
	@read -p "Enter message (default: テストメッセージです): " msg; \
	pnpm -F @proj-airi/youtube-bot test-message "$${msg:-テストメッセージです}"

# テストメッセージ送信（ダイレクト）
# Usage: make test-message MSG="your message here"
test-message:
	@if [ -z "$(MSG)" ]; then \
		echo "✉️  Sending default test message..."; \
		pnpm -F @proj-airi/youtube-bot test-message "テストメッセージです"; \
	else \
		echo "✉️  Sending test message: $(MSG)"; \
		pnpm -F @proj-airi/youtube-bot test-message "$(MSG)"; \
	fi

# すべてのサービスを停止（共通処理）
stop-all:
	@echo "🛑 Stopping all AIRI services..."
	@count=0; \
	for proc in "server-runtime" "stage-web" "youtube-bot"; do \
		num=$$(pgrep -f "$$proc" | wc -l); \
		if [ $$num -gt 0 ]; then \
			echo "  Stopping $$num process(es) for $$proc..."; \
			pkill -f "$$proc" || true; \
			count=$$((count + num)); \
		fi; \
	done; \
	sleep 1; \
	if [ $$count -gt 0 ]; then \
		echo "✅ Stopped $$count process(es)"; \
	else \
		echo "✅ No processes running"; \
	fi

# 配信停止（stop-allのエイリアス）
stream-stop: stop-all

# すべてのサービスを停止（stop-allのエイリアス）
stop: stop-all

# ========================================
# Test Commands
# ========================================

# Query Expansion テスト（LLM-based keyword expansion for Knowledge DB）
test-query-expansion:
	@echo "🧪 Testing Query Expansion feature..."
	@echo ""
	@cd apps/stage-web && pnpm tsx src/test-query-expansion.ts

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

# knowledge-db サービス再起動
db-restart:
	@echo "🔄 Restarting knowledge-db service..."
	@echo "🛑 Stopping API server..."
	@pkill -f "knowledge-db.*tsx" || true
	@sleep 1
	@echo "🌐 Starting API server (port 3100)..."
	@cd services/knowledge-db && pnpm start > /dev/null 2>&1 &
	@sleep 2
	@echo "✅ Knowledge DB API server restarted"
	@echo ""
	@echo "Endpoints:"
	@echo "  - Health: http://localhost:3100/health"
	@echo "  - Posts:  http://localhost:3100/posts"
	@echo "  - Query:  http://localhost:3100/knowledge?query=xxx"
	@echo "  - Random: http://localhost:3100/knowledge/random?limit=5"

# knowledge-db ステータス確認
db-status:
	@echo "📊 Knowledge DB Status"
	@echo ""
	@echo "🐳 Docker Containers:"
	@cd services/knowledge-db && docker-compose ps || echo "  ❌ Not running"
	@echo ""
	@echo "🌐 API Server:"
	@curl -s http://localhost:3100/health 2>/dev/null | jq . || echo "  ❌ Not running (port 3100)"

# データベースをJSONファイルにエクスポート
db-export:
	@echo "📤 Exporting knowledge database to JSON..."
	@pnpm -F @proj-airi/knowledge-db export:db
	@echo "✅ Export complete!"

# Discord同期（Collector停止 → DB停止 → DB起動 → Collector起動）
# Usage:
#   make db-sync-discord              - Sync all Discord messages (default)
#   make db-sync-discord LIMIT=100    - Sync only last 100 messages
db-sync-discord:
	@echo "🔄 Syncing Discord messages..."
	@if [ -n "$(LIMIT)" ]; then \
		echo "📊 Limit: $(LIMIT) messages"; \
	else \
		echo "📊 Fetching ALL messages (no limit)"; \
	fi
	@echo "🛑 Stopping Discord collector..."
	$(MAKE) collect-discord-stop
	@echo "🛑 Stopping database..."
	$(MAKE) db-stop
	@sleep 2
	@echo "🚀 Starting database..."
	$(MAKE) db-start
	@sleep 2
	@echo "📡 Starting Discord collector..."
	@if [ -n "$(LIMIT)" ]; then \
		cd services/knowledge-db && DISCORD_HISTORICAL_LIMIT=$(LIMIT) pnpm collect:discord > /tmp/discord-collector.log 2>&1 & \
	else \
		cd services/knowledge-db && pnpm collect:discord > /tmp/discord-collector.log 2>&1 & \
	fi
	@sleep 3
	@echo "✅ Discord sync complete!"
	@echo ""
	@echo "Discord collector is running in background"
	@echo "Check logs: tail -f /tmp/discord-collector.log"
	@echo "Stop collector: make collect-discord-stop"

# knowledge-db Discord collector起動（バックグラウンド実行）
collect-discord:
	@echo "📡 Starting Discord collector in background..."
	@cd services/knowledge-db && pnpm collect:discord > /tmp/discord-collector.log 2>&1 &
	@sleep 3
	@echo "✅ Discord collector started"
	@echo ""
	@echo "Check logs: tail -f /tmp/discord-collector.log"
	@echo "Stop collector: make collect-discord-stop"

# Discord collector停止
collect-discord-stop:
	@echo "🛑 Stopping Discord collector..."
	@pkill -f "discord.ts" || true
	@echo "✅ Discord collector stopped"

# Discord collector再起動
collect-discord-restart:
	@echo "🔄 Restarting Discord collector..."
	@pkill -f "discord.ts" || true
	@sleep 1
	@pnpm -F @proj-airi/knowledge-db collect:discord

# ========================================
# ⚠️  DANGER ZONE: Destructive Operations
# ========================================

# ⚠️  全レコード削除（要確認、復元可能）
db-danger-clear-all:
	@echo ""
	@echo "╔═══════════════════════════════════════════════════════════════╗"
	@echo "║                    ⚠️  ⚠️  ⚠️  WARNING  ⚠️  ⚠️  ⚠️                    ║"
	@echo "╠═══════════════════════════════════════════════════════════════╣"
	@echo "║  This will DELETE ALL RECORDS from the knowledge database!   ║"
	@echo "║                                                               ║"
	@echo "║  • All posts will be permanently removed                     ║"
	@echo "║  • All embeddings will be deleted                            ║"
	@echo "║  • This cannot be undone without backup                      ║"
	@echo "║                                                               ║"
	@echo "║  Recovery option:                                            ║"
	@echo "║    Run 'make db-sync-discord' to restore from Discord        ║"
	@echo "║                                                               ║"
	@echo "╚═══════════════════════════════════════════════════════════════╝"
	@echo ""
	@read -p "Type 'DELETE ALL' to confirm (or Ctrl+C to cancel): " confirm; \
	if [ "$$confirm" != "DELETE ALL" ]; then \
		echo "❌ Cancelled. Confirmation failed."; \
		exit 1; \
	fi
	@echo ""
	@read -p "Are you absolutely sure? Type 'YES I AM SURE': " confirm2; \
	if [ "$$confirm2" != "YES I AM SURE" ]; then \
		echo "❌ Cancelled. Final confirmation failed."; \
		exit 1; \
	fi
	@echo ""
	@echo "🗑️  Deleting all records from knowledge database..."
	@docker exec -i airi-knowledge-db psql -U airi -d airi_knowledge -c "TRUNCATE TABLE posts RESTART IDENTITY CASCADE;" 2>&1 | grep -v "TRUNCATE TABLE" || true
	@echo "✅ All records deleted!"
	@echo ""
	@echo "To restore from Discord:"
	@echo "  make db-sync-discord"
	@echo ""
