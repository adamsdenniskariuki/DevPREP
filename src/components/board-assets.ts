import { EXCALIDRAW_ASSET_DIR } from '../excalidraw-version'

declare global {
  interface Window { EXCALIDRAW_ASSET_PATH?: string | string[] }
}

/**
 * Points Excalidraw's font loader at our own copy of its fonts instead of a CDN. It must be an absolute
 * URL: Excalidraw resolves relative paths against the site origin, not the app's sub-path.
 */
export function setExcalidrawAssetPath() {
  window.EXCALIDRAW_ASSET_PATH = new URL(EXCALIDRAW_ASSET_DIR, document.baseURI).href
}
