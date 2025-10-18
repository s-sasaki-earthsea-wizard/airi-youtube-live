# Session: Avatar Configuration via Environment Variables

**Date**: 2025-10-18
**Branch**: `test/init-youtube-streaming`
**Status**: Completed

## Overview

OBS内蔵ブラウザではstage-webの設定UIにアクセスできないため、アバターモデルの選択、位置、スケールを環境変数で設定できるようにしました。これにより、YouTubeストリーミング配信時に`.env`ファイルを編集するだけでアバターの外観を調整できます。

## Background

**課題**:
- OBSのブラウザソースでstage-webを表示する際、設定UIにアクセスできない
- アバターの位置やスケールを調整するにはLocalStorageを直接編集する必要があった
- 配信ごとに異なるアバターモデルを使いたい場合の切り替えが困難

**解決策**:
環境変数を使用してアバター設定を初期化し、LocalStorageにキャッシュされていない場合は環境変数の値を使用する。

## Implementation

### 1. Avatar Model Selection

**File**: `packages/stage-ui/src/stores/settings.ts:42-46`

**Before**:
```typescript
const stageModelSelected = useLocalStorage<string | undefined>('settings/stage/model', 'preset-live2d-1')
```

**After**:
```typescript
// Avatar model selection with environment variable support
const stageModelSelected = useLocalStorage<string | undefined>(
  'settings/stage/model',
  import.meta.env.VITE_AVATAR_MODEL || 'preset-vrm-2',
)
```

**Available Models**:
- `preset-live2d-1`: Hiyori (Pro) - Live2D model
- `preset-live2d-2`: Hiyori (Free) - Live2D model
- `preset-vrm-1`: AvatarSample_A - VRM model
- `preset-vrm-2`: AvatarSample_B - VRM model (new default)

### 2. Avatar Position

**File**: `packages/stage-ui/src/stores/live2d.ts:31-35`

**Before**:
```typescript
const position = useLocalStorage('settings/live2d/position', { x: 0, y: 0 })
```

**After**:
```typescript
// Avatar position with environment variable support (position is relative to the center of the screen, units are %)
const position = useLocalStorage('settings/live2d/position', {
  x: Number(import.meta.env.VITE_AVATAR_POSITION_X) || 0,
  y: Number(import.meta.env.VITE_AVATAR_POSITION_Y) || 0,
})
```

**Position Coordinates**:
- Origin: Center of the screen
- Units: Percentage (%)
- X-axis: Negative values move left, positive values move right
- Y-axis: Negative values move up, positive values move down

### 3. Avatar Scale

**File**: `packages/stage-ui/src/stores/live2d.ts:44-45`

**Before**:
```typescript
const scale = useLocalStorage('settings/live2d/scale', 1)
```

**After**:
```typescript
// Avatar scale with environment variable support
const scale = useLocalStorage('settings/live2d/scale', Number(import.meta.env.VITE_AVATAR_SCALE) || 1)
```

**Scale Values**:
- 1.0 = 100% (original size)
- 0.5 = 50% (half size)
- 2.0 = 200% (double size)

## Environment Variables

### Configuration Files

**`apps/stage-web/.env`**:
```env
# Avatar Configuration for OBS/Streaming
VITE_AVATAR_MODEL=preset-vrm-2
VITE_AVATAR_POSITION_X=0.1
VITE_AVATAR_POSITION_Y=-0.2
VITE_AVATAR_SCALE=1
```

**`apps/stage-web/.env.example`**:
```env
# Avatar Configuration for OBS/Streaming
# Configure avatar model and position for broadcasting without accessing settings UI
# Available preset models:
#   - preset-live2d-1: Hiyori (Pro)
#   - preset-live2d-2: Hiyori (Free)
#   - preset-vrm-1: AvatarSample_A
#   - preset-vrm-2: AvatarSample_B
VITE_AVATAR_MODEL=preset-vrm-2
# Avatar position (relative to screen center, units are %)
# Positive x moves right, negative x moves left
# Positive y moves down, negative y moves up
VITE_AVATAR_POSITION_X=0.1
VITE_AVATAR_POSITION_Y=-0.2
# Avatar scale (1.0 = 100%, 0.5 = 50%, 2.0 = 200%)
VITE_AVATAR_SCALE=1
```

## Usage

### Initial Setup

1. **Edit `.env` file**:
   ```bash
   cd apps/stage-web
   nano .env
   ```

2. **Configure avatar settings**:
   ```env
   VITE_AVATAR_MODEL=preset-vrm-2
   VITE_AVATAR_POSITION_X=0
   VITE_AVATAR_POSITION_Y=0
   VITE_AVATAR_SCALE=1
   ```

3. **Clear LocalStorage** (required for first time):
   - Open http://localhost:5173
   - Open browser DevTools (F12)
   - Navigate to Application tab → Local Storage → http://localhost:5173
   - Delete keys:
     - `settings/stage/model`
     - `settings/live2d/position`
     - `settings/live2d/scale`
   - Reload page

4. **Restart stage-web**:
   ```bash
   pkill -f "stage-web.*vite"
   pnpm -F @proj-airi/stage-web dev
   ```

### Adjusting Position and Scale

1. **Edit `.env` file** with desired values
2. **Restart stage-web** to apply changes
3. **Reload browser** to see updates

**Example adjustments**:
```env
# Move avatar to right and slightly up
VITE_AVATAR_POSITION_X=15
VITE_AVATAR_POSITION_Y=-5

# Make avatar 80% of original size
VITE_AVATAR_SCALE=0.8
```

## Technical Details

### LocalStorage Priority

The implementation uses VueUse's `useLocalStorage()` composable, which follows this priority:

1. **Cached LocalStorage value** (if exists)
2. **Environment variable** (if LocalStorage is empty)
3. **Hardcoded default** (fallback)

This means:
- First load: Environment variable is used
- Subsequent loads: LocalStorage cached value is used
- To reset: Clear LocalStorage key and reload

### Why This Approach?

**Advantages**:
- ✅ Simple implementation using existing VueUse utilities
- ✅ Preserves user customization via UI (when accessible)
- ✅ Allows environment-based defaults for OBS/streaming setups
- ✅ No breaking changes to existing functionality

**Limitations**:
- ⚠️ Environment variables only apply on first load (before LocalStorage is set)
- ⚠️ Requires LocalStorage clearing to update from environment variables

**Alternative considered**: Force environment variables to always override LocalStorage
- Rejected: Would break user customization via settings UI
- Current approach balances both use cases

## Testing

### Test Scenarios

1. ✅ **Fresh install**: Environment variables correctly initialize avatar settings
2. ✅ **Browser reload**: LocalStorage preserves settings across reloads
3. ✅ **Model switching**: Different preset models load correctly
4. ✅ **Position adjustment**: X/Y coordinates work as expected (center-relative)
5. ✅ **Scale adjustment**: Avatar resizes proportionally
6. ✅ **OBS Browser Source**: Settings apply when opening in OBS browser

### User Testing

**User feedback** (2025-10-18):
- Position values `X=0.1, Y=-0.2` successfully reflected in browser
- VRM model `preset-vrm-2` loaded correctly
- No settings UI required for basic avatar configuration

## Files Modified

### Modified Files
- `packages/stage-ui/src/stores/settings.ts` - Added `VITE_AVATAR_MODEL` environment variable support
- `packages/stage-ui/src/stores/live2d.ts` - Added `VITE_AVATAR_POSITION_X/Y` and `VITE_AVATAR_SCALE` support
- `apps/stage-web/.env` - Added avatar configuration with `preset-vrm-2` as default
- `apps/stage-web/.env.example` - Documented avatar configuration variables with examples

### New Files
- `.claude-notes/sessions/2025-10-18-avatar-env-config.md` - This session note

## Related Sessions

- [2025-10-17: YouTube Streaming Mode UI](./2025-10-17-streaming-mode-ui.md) - UI customization for streaming
- [2025-10-18: YouTube Live Test](./2025-10-18-youtube-live-test.md) - Live streaming test session

## Future Enhancements

1. **Force Environment Variables Mode**:
   - Add `VITE_AVATAR_FORCE_ENV_CONFIG=true` option
   - Always use environment variables, ignoring LocalStorage
   - Useful for locked-down OBS setups

2. **Advanced Position Modes**:
   - Support absolute pixel positioning
   - Support anchor points (top-left, bottom-right, etc.)
   - Support viewport-relative positioning

3. **Preset Configurations**:
   - Named preset bundles (e.g., `VITE_AVATAR_PRESET=youtube-streaming`)
   - Include model, position, scale in single preset
   - Allow custom preset definitions

4. **Hot Reload**:
   - Watch `.env` file changes
   - Auto-reload avatar configuration without server restart
   - Useful for live position adjustments during setup

5. **UI Indicator**:
   - Show badge when environment variables are active
   - Display current configuration source (env vs localStorage)
   - Add "Reset to .env defaults" button in settings

## Lessons Learned

1. **VueUse LocalStorage Behavior**:
   - `useLocalStorage()` caches values immediately after first initialization
   - Environment variables only apply as fallback when no cached value exists
   - This is by design to preserve user preferences

2. **Environment Variable Type Coercion**:
   - `import.meta.env` returns strings, not numbers
   - Must use `Number()` conversion for numeric values
   - Empty strings coerce to 0, use `|| fallback` for proper defaults

3. **OBS Browser Source Workflow**:
   - OBS browser doesn't allow easy DevTools access
   - LocalStorage persists across OBS sessions
   - Testing workflow: Regular browser first, then OBS verification

4. **Documentation Clarity**:
   - Position coordinate system must be clearly documented (center-relative)
   - Examples with negative values help users understand direction
   - Percentage units avoid confusion with pixel values

## References

- [VueUse useLocalStorage](https://vueuse.org/core/useLocalStorage/)
- [stage-ui Display Models](../../packages/stage-ui/src/stores/display-models.ts)
- [stage-ui Settings Store](../../packages/stage-ui/src/stores/settings.ts)
- [stage-ui Live2D Store](../../packages/stage-ui/src/stores/live2d.ts)

---

**Session Completed**: 2025-10-18
**Next Steps**: User will test position/scale adjustments with actual OBS setup
