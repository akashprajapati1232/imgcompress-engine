/**
 * @fileoverview WebP encoder.
 */

import type { EncodeResult } from '../../encoders/EncoderManager.js';
import { encode as encoderEncode } from '../../encoders/EncoderManager.js';
import { WEBP_DEFAULTS, normalizedToWebpQuality } from './defaults.js';

/**
 * Encode ImageData as lossy WebP at the given quality.
 *
 * @param imageData RGBA pixel data.
 * @param quality Normalized quality in [0, 1].
 */
export async function encodeWebp(
  imageData: ImageData,
  quality: number,
): Promise<EncodeResult> {
  const webpQuality = normalizedToWebpQuality(quality);
  return encoderEncode(
    imageData,
    'webp',
    { ...WEBP_DEFAULTS, quality: webpQuality },
    quality,
  );
}

/**
 * Encode ImageData as lossless WebP.
 *
 * @param imageData RGBA pixel data.
 */
export async function encodeWebpLossless(imageData: ImageData): Promise<EncodeResult> {
  return encoderEncode(
    imageData,
    'webp',
    { ...WEBP_DEFAULTS, quality: 100, lossless: 1 },
    1,
  );
}
