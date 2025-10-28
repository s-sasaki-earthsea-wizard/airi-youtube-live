# Custom Models Directory

This directory is for placing your custom VRM model files.

## How to Use

### 1. Place Your VRM Model

Copy your custom VRM file to the `vrm/` subdirectory:

```bash
cp /path/to/your-model.vrm apps/stage-web/public/custom-models/vrm/
```

### 2. Configure Environment Variables

Edit your `.env` file in `apps/stage-web/.env`:

```bash
# Specify the filename of your custom VRM model
VITE_CUSTOM_VRM_FILENAME=your-model.vrm

# Optional: Specify a custom name for display
VITE_CUSTOM_VRM_NAME=My Custom Avatar

# Optional: Specify a preview image (place in the same vrm/ directory)
VITE_CUSTOM_VRM_PREVIEW=your-model-preview.png
```

### 3. Restart the Application

```bash
pnpm dev
```

Your custom VRM model will be automatically loaded and selected as the default avatar.

## Directory Structure

```
custom-models/
├── README.md              # This file
└── vrm/                   # VRM models directory
    ├── .gitkeep          # Keeps directory in git
    └── your-model.vrm    # Your custom VRM file (gitignored)
```

## Notes

- VRM files placed in this directory are automatically excluded from git tracking to prevent redistribution of personal models
- Only the directory structure (`.gitkeep` files) is tracked by git
- Supported file types: `.vrm`
- You can also place a preview image (`.png`, `.jpg`) with the same naming convention

## For OBS Browser Source

This approach works perfectly with OBS Browser Source because:
- Uses relative paths (no absolute path needed)
- Files are served from the public directory
- Consistent behavior across different environments
