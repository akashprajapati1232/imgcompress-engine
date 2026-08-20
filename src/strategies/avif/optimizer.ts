/**
 * @fileoverview AVIF optimizer — binary search quality for target file size.
 *
 * AVIF uses CQ (Constant Quality) levels, inverted vs JPEG/WebP.
 * We normalize to [0,1] internally and convert to CQ level at encode time.
 */

import type { CompressionWarning } from '../../types/index.js';
import { encodeAvif } from './encoder.js';
import {
  AVIF_MIN_CQ_LEVEL,
  AVIF_MAX_CQ_LEVEL,
  avifCqLevelToNormalized,
  normalizedToAvifCqLevel,
} from './defaults.js';

export interface AvifOptimizeOptions {
  targetSizeBytes: number;
  qualityMin?: number;
  qualityMax?: number;
  maxIterations?: number;
  sizeTolerance?: number;
}

export interface AvifOptimizeResult {
  buffer: ArrayBuffer;
  quality: number;
  achievedTarget: boolean;
  warnings: CompressionWarning[];
}

/**
 * Binary-search AVIF quality to approach a target file size.
 */
export async function optimizeAvifToTargetSize(
  imageData: ImageData,
  options: AvifOptimizeOptions,
): Promise<AvifOptimizeResult> {
  const {
    targetSizeBytes,
    qualityMin = avifCqLevelToNormalized(AVIF_MAX_CQ_LEVEL),
    qualityMax = avifCqLevelToNormalized(AVIF_MIN_CQ_LEVEL),
    maxIterations = 12,
    sizeTolerance = 0.05,
  } = options;

  const warnings: CompressionWarning[] = [];

  let lo = qualityMin;
  let hi = qualityMax;
  let bestBuffer: ArrayBuffer | null = null;
  let bestQuality = hi;
  let bestSize = Infinity;
  let achievedTarget = false;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    const result = await encodeAvif(imageData, mid);
    const size = result.buffer.byteLength;

    if (size <= targetSizeBytes) {
      if (bestBuffer === null || size > bestSize) {
        bestBuffer = result.buffer;
        bestQuality = mid;
        bestSize = size;
      }
    }

    const relativeError = Math.abs(size - targetSizeBytes) / targetSizeBytes;
    if (relativeError <= sizeTolerance) {
      bestBuffer = result.buffer;
      bestQuality = mid;
      bestSize = size;
      achievedTarget = true;
      break;
    }

    if (size > targetSizeBytes) {
      hi = mid;
    } else {
      lo = mid;
    }

    if (hi - lo < 0.005) break;
  }

  if (bestBuffer === null) {
    const result = await encodeAvif(imageData, lo);
    bestBuffer = result.buffer;
    bestQuality = lo;
    bestSize = result.buffer.byteLength;
  }

  if (!achievedTarget) {
    warnings.push({
      code: 'TARGET_SIZE_NOT_REACHED',
      message:
        `Could not reach target size of ${targetSizeBytes} bytes for AVIF. ` +
        `Best result: ${bestSize} bytes at CQ level ${normalizedToAvifCqLevel(bestQuality)}.`,
    });
  }

  if (bestQuality <= qualityMin + 0.01) {
    warnings.push({
      code: 'QUALITY_CLAMPED',
      message: `AVIF quality hit minimum bound. Output may show significant artifacts.`,
    });
  }

  return {
    buffer: bestBuffer,
    quality: bestQuality,
    achievedTarget,
    warnings,
  };
}
