/**
 * @fileoverview FallbackEncoder — last-resort encoding path.
 *
 * Delegates to NativeEncoder when WASM is completely unavailable.
 * This intentionally uses canvas.toBlob() which has less precise
 * quality semantics but is universally available.
 *
 * The target-size optimizer may be less accurate when using this encoder
 * because quality-to-size relationships differ between browser implementations.
 */

import type { ImageFormat } from '../types/index.js';
import { nativeDecode, nativeEncode } from './NativeEncoder.js';
import type { CompressionWarning } from '../types/index.js';

export interface FallbackEncodeResult {
  buffer: ArrayBuffer;
  warnings: CompressionWarning[];
}

/**
 * Encode image data using the browser's native Canvas encoder.
 * Attaches an ENCODER_FALLBACK warning to the result.
 */
export async function fallbackEncode(
  imageData: ImageData,
  format: ImageFormat,
  quality: number,
): Promise<FallbackEncodeResult> {
  const buffer = await nativeEncode(imageData, format, quality);
  return {
    buffer,
    warnings: [
      {
        code: 'ENCODER_FALLBACK',
        message:
          `WebAssembly is unavailable in this environment. Using the browser's ` +
          `native Canvas encoder for "${format}". Quality semantics may differ ` +
          `from the deterministic WASM encoder.`,
      },
    ],
  };
}

export { nativeDecode as fallbackDecode };
