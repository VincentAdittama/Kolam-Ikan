import { platform } from '@tauri-apps/plugin-os';

// Layout constants
export const getDragRegionHeight = async (): Promise<number> => {
  const os = await platform();
  switch (os) {
    case 'macos':
      return 53; // macOS traffic light area
    case 'windows':
      return 32; // Windows title bar
    case 'linux':
      return 32; // Linux window decorations (approximate)
    default:
      return 32; // Default fallback
  }
};

// For synchronous access, use a default value
export const DRAG_REGION_HEIGHT_DEFAULT = 53;