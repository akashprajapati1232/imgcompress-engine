/**
 * @fileoverview Optimizer — intelligent target-size optimization engine.
 *
 * This is the core intellectual contribution of @imgcompress/engine.
 *
 * The optimizer coordinates:
 *   1. Format-specific binary search (quality dimension)
 *   2. Dimension reduction fallback (resize dimension)
 *   3. Multi-candidate evaluation for best perceptual quality
 *   4. Cancellation checks throughout the loop
 *
 * Algorithm (for lossy formats — JPEG, WebP, AVIF):
 * ─────────────────────────────────────────────────
 *   1. Parse target size in bytes.
 *   2. Initial probe at qualityMax.
 *   3. Binary search: probe at (lo + hi) / 2.
 *   4. If result > target: hi = mid (go lower quality)
 *      If result < target: lo = mid (try higher quality)
 *   5. Convergence: relative error < sizeTolerance OR hi-lo < 0.005
 *   6. If quality hits qualityMin AND still > target:
 *        a. Reduce dimensions by scale factor (0.75×, 0.5×, 0.35×)
 *        b. Re-run binary search on smaller ImageData
 *   7. Return best result across all candidates.
 *
 * For PNG (lossless):
 *   - Try Oxipng levels 6 → 1.
 *   - If still > target, apply dimension reduction then retry.
 */

import type { ImageFormat, CompressionWarning, NormalizedCompressOptions } from '../types/index.js';
import { operationCancelled } from '../errors/ImageCompressionError.js';
import { optimizeJpegToTargetSize } from '../strategies/jpeg/optimizer.js';
import { optimizePngToTargetSize } from '../strategies/png/optimizer.js';
import { optimizeWebpToTargetSize } from '../strategies/webp/optimizer.js';
import { optimizeAvifToTargetSize } from '../strategies/avif/optimizer.js';
import { encodeJpeg } from '../strategies/jpeg/encoder.js';
import { encodePng } from '../strategies/png/encoder.js';
import { encodeWebp } from '../strategies/webp/encoder.js';
import { encodeAvif } from '../strategies/avif/encoder.js';
import { picaAdapter } from '../resize/PicaAdapter.js';

/** Dimension scale steps used when quality optimization is not enough. */
const DIMENSION_SCALES = [0.75, 0.5, 0.35, 0.25];

export interface OptimizerResult {
  buffer: ArrayBuffer;
  quality: number;
  achievedTarget: boolean;
  scaleFactor: number;
  warnings: CompressionWarning[];
}

export interface OptimizerOptions {
  targetSizeBytes: number;
  qualityMin: number;
  qualityMax: number;
  maxIterations?: number;
  sizeTolerance?: number;
  allowDimensionReduction?: boolean;
  signal?: AbortSignal;
}

/**
 * Run the target-size optimizer for the given format and ImageData.
 *
 * If quality-only optimization cannot reach the target and
 * `allowDimensionReduction` is true, the optimizer will also try
 * progressively smaller dimensions.
 */
export async function runTargetSizeOptimizer(
  imageData: ImageData,
  format: ImageFormat,
  options: OptimizerOptions,
): Promise<OptimizerResult> {
  const {
    targetSizeBytes,
    qualityMin,
    qualityMax,
    maxIterations = 12,
    sizeTolerance = 0.05,
    allowDimensionReduction = true,
    signal,
  } = options;

  checkCancellation(signal);

  const allWarnings: CompressionWarning[] = [];

  // ── Phase 1: quality-only optimization ─────────────────────────────────
  const qualityResult = await runQualitySearch(
    imageData,
    format,
    { targetSizeBytes, qualityMin, qualityMax, maxIterations, sizeTolerance },
    signal,
  );

  allWarnings.push(...qualityResult.warnings);

  if (qualityResult.achievedTarget) {
    return {
      buffer: qualityResult.buffer,
      quality: qualityResult.quality,
      achievedTarget: true,
      scaleFactor: 1,
      warnings: allWarnings,
    };
  }

  // ── Phase 2: dimension reduction ────────────────────────────────────────
  if (!allowDimensionReduction) {
    return {
      buffer: qualityResult.buffer,
      quality: qualityResult.quality,
      achievedTarget: false,
      scaleFactor: 1,
      warnings: allWarnings,
    };
  }

  let bestBuffer = qualityResult.buffer;
  let bestQuality = qualityResult.quality;
  let bestScale = 1;
  let achievedTarget = false;

  for (const scale of DIMENSION_SCALES) {
    checkCancellation(signal);

    const targetW = Math.max(1, Math.round(imageData.width * scale));
    const targetH = Math.max(1, Math.round(imageData.height * scale));

    // Resize imageData
    let resized: ImageData;
    try {
      resized = await picaAdapter.resize(imageData, { width: targetW, height: targetH });
    } catch {
      continue; // Skip this scale if resize fails
    }

    checkCancellation(signal);

    const scaled = await runQualitySearch(
      resized,
      format,
      { targetSizeBytes, qualityMin, qualityMax, maxIterations, sizeTolerance },
      signal,
    );

    if (scaled.achievedTarget) {
      bestBuffer = scaled.buffer;
      bestQuality = scaled.quality;
      bestScale = scale;
      achievedTarget = true;

      allWarnings.push({
        code: 'DIMENSION_REDUCED',
        message:
          `Image dimensions reduced to ${targetW}×${targetH} (${Math.round(scale * 100)}% of original) ` +
          `to achieve the target file size.`,
      });

      break;
    }

    // Keep best so far (smallest output closest to target)
    if (scaled.buffer.byteLength < bestBuffer.byteLength) {
      bestBuffer = scaled.buffer;
      bestQuality = scaled.quality;
      bestScale = scale;
    }
  }

  if (!achievedTarget) {
    allWarnings.push({
      code: 'TARGET_SIZE_NOT_REACHED',
      message:
        `Could not reach the target size of ${targetSizeBytes} bytes even after dimension reduction. ` +
        `Best result: ${bestBuffer.byteLength} bytes.`,
    });
  }

  return {
    buffer: bestBuffer,
    quality: bestQuality,
    achievedTarget,
    scaleFactor: bestScale,
    warnings: allWarnings,
  };
}

// ---------------------------------------------------------------------------
// Encode a single candidate at a given quality (no search)
// ---------------------------------------------------------------------------

export async function encodeAtQuality(
  imageData: ImageData,
  format: ImageFormat,
  quality: number,
): Promise<ArrayBuffer> {
  switch (format) {
    case 'jpeg': return (await encodeJpeg(imageData, quality)).buffer;
    case 'png':  return (await encodePng(imageData)).buffer;
    case 'webp': return (await encodeWebp(imageData, quality)).buffer;
    case 'avif': return (await encodeAvif(imageData, quality)).buffer;
  }
}

// ---------------------------------------------------------------------------
// Max file size check (simpler than target — just ensure we're below)
// ---------------------------------------------------------------------------

export async function enforceMaxFileSize(
  imageData: ImageData,
  format: ImageFormat,
  maxSizeBytes: number,
  options: Pick<OptimizerOptions, 'qualityMin' | 'qualityMax' | 'signal'>,
): Promise<OptimizerResult> {
  // First encode at max quality — if it's already small enough, done.
  const initialBuffer = await encodeAtQuality(
    imageData,
    format,
    options.qualityMax,
  );

  if (initialBuffer.byteLength <= maxSizeBytes) {
    return {
      buffer: initialBuffer,
      quality: options.qualityMax,
      achievedTarget: true,
      scaleFactor: 1,
      warnings: [],
    };
  }

  // Otherwise use the full optimizer
  return runTargetSizeOptimizer(imageData, format, {
    targetSizeBytes: maxSizeBytes,
    ...options,
    allowDimensionReduction: true,
  });
}

// ---------------------------------------------------------------------------
// Internal: route quality search to format-specific optimizer
// ---------------------------------------------------------------------------

interface QualitySearchOptions {
  targetSizeBytes: number;
  qualityMin: number;
  qualityMax: number;
  maxIterations: number;
  sizeTolerance: number;
}

interface QualitySearchResult {
  buffer: ArrayBuffer;
  quality: number;
  achievedTarget: boolean;
  warnings: CompressionWarning[];
}

async function runQualitySearch(
  imageData: ImageData,
  format: ImageFormat,
  options: QualitySearchOptions,
  signal?: AbortSignal,
): Promise<QualitySearchResult> {
  checkCancellation(signal);

  switch (format) {
    case 'jpeg': {
      const r = await optimizeJpegToTargetSize(imageData, options);
      return { buffer: r.buffer, quality: r.quality, achievedTarget: r.achievedTarget, warnings: r.warnings };
    }
    case 'png': {
      const r = await optimizePngToTargetSize(imageData, { ...options });
      return { buffer: r.buffer, quality: 1, achievedTarget: r.achievedTarget, warnings: r.warnings };
    }
    case 'webp': {
      const r = await optimizeWebpToTargetSize(imageData, options);
      return { buffer: r.buffer, quality: r.quality, achievedTarget: r.achievedTarget, warnings: r.warnings };
    }
    case 'avif': {
      const r = await optimizeAvifToTargetSize(imageData, options);
      return { buffer: r.buffer, quality: r.quality, achievedTarget: r.achievedTarget, warnings: r.warnings };
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkCancellation(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw operationCancelled();
  }
}

/**
 * Parse a SizeInput value to bytes.
 *
 * @example
 * parseSizeToBytes("100KB") // 102400
 * parseSizeToBytes("1.5MB") // 1572864
 * parseSizeToBytes(102400)  // 102400
 */
export function parseSizeToBytes(size: number | string): number {
  if (typeof size === 'number') {
    if (size <= 0 || !isFinite(size)) {
      throw new Error(`Invalid size value: ${size}`);
    }
    return Math.round(size);
  }

  const match = /^(\d+(?:\.\d+)?)\s*(KB|MB|B)?$/i.exec(size.trim());
  if (!match) {
    throw new Error(`Invalid size string: "${size}". Expected format: "100KB", "1.5MB", or a number.`);
  }

  const value = parseFloat(match[1] as string);
  const unit = (match[2] ?? 'B').toUpperCase();

  switch (unit) {
    case 'KB': return Math.round(value * 1024);
    case 'MB': return Math.round(value * 1024 * 1024);
    default:   return Math.round(value);
  }
}

/**
 * Normalize CompressOptions to the internal NormalizedCompressOptions form.
 * Resolves defaults, parses size strings, etc.
 */
export function normalizeOptions(
  format: ImageFormat,
  raw: Partial<NormalizedCompressOptions>,
): NormalizedCompressOptions {
  return {
    outputFormat: raw.outputFormat ?? format,
    qualityMin: raw.qualityMin ?? 0.10,
    qualityMax: raw.qualityMax ?? 0.92,
    targetSizeBytes: raw.targetSizeBytes ?? null,
    maxFileSizeBytes: raw.maxFileSizeBytes ?? null,
    maxWidth: raw.maxWidth ?? null,
    maxHeight: raw.maxHeight ?? null,
    preserveAspectRatio: raw.preserveAspectRatio !== false,
    preserveMetadata: raw.preserveMetadata ?? false,
    transparency: raw.transparency ?? 'error',
    transparencyBackground: raw.transparencyBackground ?? [255, 255, 255],
    maxPixels: raw.maxPixels ?? 40_000_000,
    auto: raw.auto ?? false,
  };
}
