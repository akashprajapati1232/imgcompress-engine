/**
 * @fileoverview PNG optimizer.
 *
 * PNG is lossless. Size reduction is achieved by:
 *   1. Lossless optimization via Oxipng (different optimization levels).
 *   2. Dimension reduction (resize to smaller canvas).
 *
 * If the target size cannot be reached with lossless methods, the engine
 * returns a warning. We do NOT silently convert to a lossy format.
 * The caller must explicitly set `outputFormat` to achieve lossy output.
 */

import type { CompressionWarning } from '../../types/index.js';
import { encodePng } from './encoder.js';
import { PNG_MAX_OXIPNG_LEVEL, PNG_MIN_OXIPNG_LEVEL } from './defaults.js';

export interface PngOptimizeOptions {
  targetSizeBytes: number;
  maxIterations?: number;
  sizeTolerance?: number;
}

export interface PngOptimizeResult {
  buffer: ArrayBuffer;
  oxipngLevel: number;
  achievedTarget: boolean;
  warnings: CompressionWarning[];
}

/**
 * Try to optimize a PNG to approach a target size using different
 * Oxipng compression levels.
 *
 * Because PNG is lossless, there are only 6 discrete optimization levels.
 * We try them in order from highest to lowest compression, stopping when
 * the output is within sizeTolerance of the target.
 */
export async function optimizePngToTargetSize(
  imageData: ImageData,
  options: PngOptimizeOptions,
): Promise<PngOptimizeResult> {
  const {
    targetSizeBytes,
    sizeTolerance = 0.05,
  } = options;

  const warnings: CompressionWarning[] = [];

  let bestBuffer: ArrayBuffer | null = null;
  let bestLevel = PNG_MAX_OXIPNG_LEVEL;
  let bestSize = Infinity;
  let achievedTarget = false;

  // Try levels from max to min (descending compression)
  for (let level = PNG_MAX_OXIPNG_LEVEL; level >= PNG_MIN_OXIPNG_LEVEL; level--) {
    const result = await encodePng(imageData, level);
    const size = result.buffer.byteLength;

    if (bestBuffer === null || size < bestSize) {
      bestBuffer = result.buffer;
      bestLevel = level;
      bestSize = size;
    }

    if (size <= targetSizeBytes) {
      const relativeError = Math.abs(size - targetSizeBytes) / targetSizeBytes;
      if (relativeError <= sizeTolerance || size <= targetSizeBytes) {
        bestBuffer = result.buffer;
        bestLevel = level;
        bestSize = size;
        achievedTarget = true;
        break;
      }
    }
  }

  if (!achievedTarget) {
    warnings.push({
      code: 'TARGET_SIZE_NOT_REACHED',
      message:
        `PNG is a lossless format — the target size of ${targetSizeBytes} bytes ` +
        `cannot be reached without dimension reduction or format conversion. ` +
        `Best lossless result: ${bestSize} bytes. ` +
        `Consider setting outputFormat: "webp" or "jpeg" for lossy compression.`,
    });
  }

  return {
    buffer: bestBuffer!,
    oxipngLevel: bestLevel,
    achievedTarget,
    warnings,
  };
}
