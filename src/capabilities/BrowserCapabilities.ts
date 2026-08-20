/**
 * @fileoverview Browser capability detection.
 *
 * Detects what the current browser can actually do at runtime.
 * This is used by the EncoderManager and Pipeline to select the
 * best available code paths.
 *
 * Important distinction:
 *   decode capability = browser can display/render this format
 *   encode capability = browser can produce this format via Canvas.toBlob()
 *
 * WASM-based encoding via jSquash is separate from native encode capability
 * and is always preferred when WebAssembly is available.
 */

import type { BrowserCapabilities, FormatCapabilities } from '../types/index.js';

// ---------------------------------------------------------------------------
// Tiny 1×1 test images for capability probing (data URIs)
// ---------------------------------------------------------------------------

// 1×1 JPEG
const TEST_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC'
  + 'AABAAEDASIA2wABEQECEQH/xABFAAEAAAAAAAAAAAAAAAAAAAAIAQADAQAAAAAAAAAAAAAAAAAAAAABEQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJgAB//Z';

// 1×1 PNG
const TEST_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// 1×1 WebP (lossy)
const TEST_WEBP =
  'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

// 1×1 AVIF
const TEST_AVIF =
  'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUEAAADybWV0YQAAAAAAAABo'
  + 'aGxhcgAAAFRtZGF0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  + 'AAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAyisom';

const TEST_IMAGES: Record<string, string> = {
  jpeg: TEST_JPEG,
  png: TEST_PNG,
  webp: TEST_WEBP,
  avif: TEST_AVIF,
};

// ---------------------------------------------------------------------------
// Individual capability probes
// ---------------------------------------------------------------------------

/** Returns true if the browser can render/display the given format. */
async function canDecode(dataUri: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width > 0);
    img.onerror = () => resolve(false);
    img.src = dataUri;
  });
}

/** Returns true if the browser's Canvas can encode to the given MIME type. */
async function canEncode(mimeType: string): Promise<boolean> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return await new Promise<boolean>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob !== null && blob.size > 0),
        mimeType,
        0.8,
      );
    });
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let cachedCapabilities: BrowserCapabilities | null = null;

/**
 * Detect and return browser capabilities.
 *
 * Results are cached after the first call to avoid repeated async probes.
 * Pass `force: true` to clear the cache and re-detect.
 */
export async function detectCapabilities(
  force = false,
): Promise<BrowserCapabilities> {
  if (cachedCapabilities && !force) return cachedCapabilities;

  const [
    jpegDecode,
    pngDecode,
    webpDecode,
    avifDecode,
    jpegEncode,
    pngEncode,
    webpEncode,
    avifEncode,
  ] = await Promise.all([
    canDecode(TEST_IMAGES['jpeg'] as string),
    canDecode(TEST_IMAGES['png'] as string),
    canDecode(TEST_IMAGES['webp'] as string),
    canDecode(TEST_IMAGES['avif'] as string),
    canEncode('image/jpeg'),
    canEncode('image/png'),
    canEncode('image/webp'),
    canEncode('image/avif'),
  ]);

  const decode: FormatCapabilities = {
    jpeg: jpegDecode,
    png: pngDecode,
    webp: webpDecode,
    avif: avifDecode,
  };

  const encode: FormatCapabilities = {
    jpeg: jpegEncode,
    png: pngEncode,
    webp: webpEncode,
    avif: avifEncode,
  };

  cachedCapabilities = {
    webWorker: typeof Worker !== 'undefined',
    wasm: typeof WebAssembly !== 'undefined',
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    createImageBitmap: typeof createImageBitmap !== 'undefined',
    webCodecs:
      typeof (globalThis as Record<string, unknown>)['ImageDecoder'] !== 'undefined',
    decode,
    encode,
  };

  return cachedCapabilities;
}

/** Synchronous check — returns cached capabilities or null if not yet detected. */
export function getCachedCapabilities(): BrowserCapabilities | null {
  return cachedCapabilities;
}
