# Knowledge DB Integration Fix and Export Feature

**Date**: 2025-10-17
**Session Type**: Bug Fix & Feature Addition
**Status**: ✅ Completed

## Overview

Fixed Knowledge DB integration in stage-web by implementing persistent hooks system, resolved CORS issues, and added database export functionality.

## Problem Statement

### Issue 1: Knowledge DB Hook Not Working

Knowledge DB integration was not functioning in the browser. The hook was being registered but immediately cleared by `Stage.vue`'s `clearHooks()` call.

**Root Cause:**
- `Stage.vue` calls `clearHooks()` during mount to avoid duplicate hooks from re-mounting
- This cleared ALL hooks, including the Knowledge DB hook registered by `index.vue`
- Comment in `index.vue` incorrectly stated the hook "will NOT be cleared because it's registered after clearHooks()"

**Evidence from logs:**
```
[index.vue] Registering knowledge DB hook
[index.vue] Knowledge DB hook registered with persistent flag
[index.vue] Knowledge hook triggered for message: 好きな作家を教えて！
GET http://localhost:3100/knowledge?query=... net::ERR_FAILED 200 (OK)
```

### Issue 2: CORS Error

Browser couldn't access knowledge-db service due to missing CORS headers.

## Solution

### 1. Persistent Hooks System (Approach 2 Simplified)

Implemented a persistent flag system for chat hooks:

**packages/stage-ui/src/stores/chat.ts:**
- Added `HookOptions` interface with `persistent?: boolean` flag
- Added `HookWrapper<T>` interface to wrap callbacks with persistence metadata
- Modified all hook arrays to use `HookWrapper` types
- Updated `clearHooks()` to filter out only non-persistent hooks
- Added optional `options` parameter to all hook registration functions
- Updated all hook execution code to call `.callback` property

**apps/stage-web/src/pages/index.vue:**
- Updated Knowledge DB hook registration to include `{ persistent: true }` option
- Updated comments to reflect new behavior

### 2. CORS Configuration

**services/knowledge-db/src/index.ts:**
- Added CORS middleware before all routes
- Set `Access-Control-Allow-Origin: *`
- Handle preflight OPTIONS requests

### 3. Database Export Feature

**New file: services/knowledge-db/scripts/export-db.ts:**
- Exports all posts to JSON (excluding vector data)
- Default output: `exports/knowledge-db-{timestamp}.json` (project root)
- Supports custom output path via command argument

**services/knowledge-db/package.json:**
- Added `export:db` script

**Makefile:**
- Added `db-export` target
- Updated help text

**.gitignore:**
- Added `exports/` directory to exclude from version control

## Implementation Details

### Hook Wrapper Type System

```typescript
export interface HookOptions {
  persistent?: boolean
}

interface HookWrapper<T> {
  callback: T
  persistent: boolean
}

// Example usage
const onBeforeMessageComposedHooks = ref<Array<HookWrapper<(message: string) => Promise<void>>>>([])

function onBeforeMessageComposed(cb: (message: string) => Promise<void>, options?: HookOptions) {
  onBeforeMessageComposedHooks.value.push({
    callback: cb,
    persistent: options?.persistent || false,
  })
}

function clearHooks() {
  onBeforeMessageComposedHooks.value = onBeforeMessageComposedHooks.value.filter(h => h.persistent)
  // ... same for all hook types
}
```

### Hook Execution Pattern

```typescript
// Before
for (const hook of onBeforeMessageComposedHooks.value) {
  await hook(sendingMessage)
}

// After
for (const hook of onBeforeMessageComposedHooks.value) {
  await hook.callback(sendingMessage)
}
```

### CORS Middleware

```typescript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }

  next()
})
```

## Testing Results

### Knowledge DB Integration

✅ **Hook registration:**
```
[index.vue] Registering persistent knowledge DB hook
[index.vue] Knowledge DB hook registered with persistent flag
```

✅ **Hook execution:**
```
[index.vue] Knowledge hook triggered for message: 好きな作家を教えて！
[index.vue] Injected 2 knowledge results into system prompt
```

✅ **AI response reflects knowledge:**
```
あ、それなら迷わずアーシュラ・ル＝グウィンかな！
ゲド戦記の作者って言えばわかるかも？特に第2巻の「こわれた腕輪」が大好きなんだ。
```

### Database Export

✅ Command works: `make db-export`
✅ Output location: `exports/knowledge-db-{timestamp}.json`
✅ Gitignored properly

## Files Modified

### Core Implementation
- `packages/stage-ui/src/stores/chat.ts` - Persistent hooks system
- `apps/stage-web/src/pages/index.vue` - Use persistent flag for Knowledge DB hook
- `services/knowledge-db/src/index.ts` - CORS middleware

### Export Feature
- `services/knowledge-db/scripts/export-db.ts` - New export script
- `services/knowledge-db/package.json` - Added export:db script
- `Makefile` - Added db-export target
- `.gitignore` - Exclude exports directory

## Architecture Decisions

### Why Persistent Hooks (Approach 2)?

**Evaluated 3 approaches:**

1. **Stage.vue clears only its own hooks**
   - ❌ Requires hook registration to return unregister functions
   - ❌ Breaking API change

2. **Persistent hooks with flag** ✅ SELECTED
   - ✅ Minimal breaking changes (optional parameter)
   - ✅ Clear intent with `persistent: true`
   - ✅ Extensible to scope-based hooks later
   - ⚠️ Medium implementation complexity

3. **Event-based registration after Stage.vue mount**
   - ❌ Timing-dependent, fragile
   - ❌ Doesn't solve re-mount issue
   - ❌ Poor maintainability

### Export to Project Root

Exports go to project root (`exports/`) instead of service directory for:
- Easy access from any location
- Consistent with other project outputs
- Single gitignore entry

## Related Documentation

- [Knowledge DB README](../../services/knowledge-db/README.md)
- [Stage Web Integration](../../apps/stage-web/README.md)
- Previous session: [2025-10-16-tts-voice-fix](./2025-10-16-tts-voice-fix.md)

## Commands Reference

```bash
# Export database
make db-export

# Custom export location
cd services/knowledge-db
pnpm run export:db /path/to/output.json

# Check Knowledge DB status
make db-status

# Sync Discord messages
make db-sync-discord
```

## Technical Notes

### Hook Lifecycle

1. **App.vue** mounts → Initializes Knowledge DB integration state
2. **index.vue** mounts → Registers Knowledge DB hook with `persistent: true`
3. **Stage.vue** mounts → Calls `clearHooks()` → Only non-persistent hooks removed
4. **Stage.vue** registers its own hooks → All hooks coexist
5. User sends message → Both Stage.vue and Knowledge DB hooks execute

### Data Flow

```
User Message
    ↓
onBeforeMessageComposed hooks execute
    ↓
Knowledge DB hook (persistent)
    ↓
Query knowledge-db API
    ↓
Inject relevant knowledge into system prompt
    ↓
LLM receives enhanced prompt
    ↓
Response includes knowledge from database
```

## Future Improvements

- [ ] Add scope-based hook management for better organization
- [ ] Implement hook priority system
- [ ] Add hook debugging tools
- [ ] Consider hook unregister functionality for cleanup

---

**Session completed**: 2025-10-17 01:45 JST
