/**
 * @fileoverview PNG encoder — encodes + applies Oxipng lossless optimization.
 */

import type { EncodeResult } from '../../encoders/EncoderManager.js';
import { encode as encoderEncode, optimizePng } from '../../encoders/EncoderManager.js';
import { PNG_ENCODE_DEFAULTS, OXIPNG_DEFAULTS } from './defaults.js';

/**
 * Encode ImageData as PNG and apply Oxipng lossless optimization.
 *
 * @param imageData RGBA pixel data.
 * @param oxipngLevel Oxipng optimization level (1–6). Higher = smaller but slower.
 */
export async function encodePng(
  imageData: ImageData,
  oxipngLevel = 4,
): Promise<EncodeResult> {
  // Step 1: encode to PNG bytes
  const encodeResult = await encoderEncode(
    imageData,
    'png',
    { ...PNG_ENCODE_DEFAULTS },
    1, // quality not used for PNG, normalized value is 1
  );

  // Step 2: run Oxipng lossless optimizer
  const optimized = await optimizePng(encodeResult.buffer, {
    ...OXIPNG_DEFAULTS,
    level: oxipngLevel,
  });

  return {
    buffer: optimized.buffer,
    encoder: encodeResult.encoder,
    warnings: [...encodeResult.warnings, ...optimized.warnings],
  };
}
