/**
 * @fileoverview WebP optimizer — binary search quality for target file size.
 */

import type { CompressionWarning } from '../../types/index.js';
import { encodeWebp } from './encoder.js';
import { WEBP_MIN_QUALITY, WEBP_MAX_QUALITY } from './defaults.js';

export interface WebpOptimizeOptions {
  targetSizeBytes: number;
  qualityMin?: number;
  qualityMax?: number;
  maxIterations?: number;
  sizeTolerance?: number;
}

export interface WebpOptimizeResult {
  buffer: ArrayBuffer;
  quality: number;
  achievedTarget: boolean;
  warnings: CompressionWarning[];
}

/**
 * Binary-search WebP quality to approach a target file size.
 */
export async function optimizeWebpToTargetSize(
  imageData: ImageData,
  options: WebpOptimizeOptions,
): Promise<WebpOptimizeResult> {
  const {
    targetSizeBytes,
    qualityMin = WEBP_MIN_QUALITY,
    qualityMax = WEBP_MAX_QUALITY,
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
    const result = await encodeWebp(imageData, mid);
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
    const result = await encodeWebp(imageData, lo);
    bestBuffer = result.buffer;
    bestQuality = lo;
    bestSize = result.buffer.byteLength;
  }

  if (!achievedTarget) {
    warnings.push({
      code: 'TARGET_SIZE_NOT_REACHED',
      message:
        `Could not reach target size of ${targetSizeBytes} bytes for WebP. ` +
        `Best result: ${bestSize} bytes at quality ${bestQuality.toFixed(3)}.`,
    });
  }

  if (bestQuality <= qualityMin + 0.01) {
    warnings.push({
      code: 'QUALITY_CLAMPED',
      message: `WebP quality hit minimum bound (${qualityMin}). Output may show artifacts.`,
    });
  }

  return {
    buffer: bestBuffer,
    quality: bestQuality,
    achievedTarget,
    warnings,
  };
}
