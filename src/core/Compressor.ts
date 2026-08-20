/**
 * @fileoverview Compressor — main orchestrator bridging the public API to the pipeline.
 *
 * The Compressor:
 *   1. Validates and normalizes input options.
 *   2. Runs the analysis phase.
 *   3. Executes the pipeline (directly, not via Worker — Worker is handled by compressImage.ts).
 *   4. Assembles the final CompressionResult.
 *
 * The Worker layer (compression.worker.ts) uses Compressor internally.
 * The main-thread fallback also uses Compressor directly.
 */

import type {
  CompressionResult,
  CompressOptions,
  ImageFormat,
  CompressionWarning,
  NormalizedCompressOptions,
} from '../types/index.js';
import type { ImageAnalysis } from '../types/index.js';
import { analyzeImageFile } from '../analysis/ImageAnalyzer.js';
import { executePipeline } from './Pipeline.js';
import { MemoryManager } from './MemoryManager.js';
import { parseSizeToBytes } from './Optimizer.js';
import { formatToMime } from '../analysis/format.js';
import { invalidOptions, wrapUnknownError } from '../errors/ImageCompressionError.js';
import { ImageCompressionError } from '../errors/ImageCompressionError.js';

/**
 * Validate public CompressOptions and return a normalized form.
 */
function buildNormalizedOptions(
  detectedFormat: ImageFormat,
  raw: CompressOptions,
): NormalizedCompressOptions {
  // Quality normalization
  let qualityMin = 0.10;
  let qualityMax = 0.92;

  if (raw.auto) {
    qualityMin = 0.60;
    qualityMax = 0.92;
  } else if (raw.quality !== undefined) {
    if (typeof raw.quality === 'number') {
      if (raw.quality < 0 || raw.quality > 1) {
        throw invalidOptions('quality must be a number in [0, 1].');
      }
      qualityMin = raw.quality;
      qualityMax = raw.quality;
    } else {
      if (
        raw.quality.min < 0 || raw.quality.min > 1 ||
        raw.quality.max < 0 || raw.quality.max > 1 ||
        raw.quality.min > raw.quality.max
      ) {
        throw invalidOptions('quality.min and quality.max must be in [0, 1] with min ≤ max.');
      }
      qualityMin = raw.quality.min;
      qualityMax = raw.quality.max;
    }
  }

  // Target size
  let targetSizeBytes: number | null = null;
  if (raw.targetSize !== undefined) {
    try {
      targetSizeBytes = parseSizeToBytes(raw.targetSize as string | number);
    } catch (err) {
      throw invalidOptions(`targetSize is invalid: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (targetSizeBytes <= 0) {
      throw invalidOptions('targetSize must be a positive value.');
    }
  }

  // Max file size
  let maxFileSizeBytes: number | null = null;
  if (raw.maxFileSize !== undefined) {
    try {
      maxFileSizeBytes = parseSizeToBytes(raw.maxFileSize as string | number);
    } catch (err) {
      throw invalidOptions(`maxFileSize is invalid: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Conflict check
  if (targetSizeBytes !== null && maxFileSizeBytes !== null) {
    throw invalidOptions('Specify either targetSize or maxFileSize, not both.');
  }

  // Dimension constraints
  let maxWidth: number | null = null;
  let maxHeight: number | null = null;

  if (raw.maxDimension !== undefined) {
    maxWidth = raw.maxDimension;
    maxHeight = raw.maxDimension;
  }
  if (raw.maxWidth !== undefined) maxWidth = raw.maxWidth;
  if (raw.maxHeight !== undefined) maxHeight = raw.maxHeight;

  // Output format
  const outputFormat: ImageFormat = raw.outputFormat ?? detectedFormat;

  // Transparency background
  let transparencyBackground: [number, number, number] = [255, 255, 255];
  if (raw.transparencyBackground !== undefined) {
    if (Array.isArray(raw.transparencyBackground)) {
      transparencyBackground = raw.transparencyBackground as [number, number, number];
    } else {
      // CSS color string — parse to RGB
      transparencyBackground = parseCssColor(raw.transparencyBackground as string);
    }
  }

  return {
    outputFormat,
    qualityMin,
    qualityMax,
    targetSizeBytes,
    maxFileSizeBytes,
    maxWidth,
    maxHeight,
    preserveAspectRatio: raw.preserveAspectRatio !== false,
    preserveMetadata: raw.preserveMetadata ?? false,
    transparency: raw.transparency ?? 'error',
    transparencyBackground,
    maxPixels: raw.maxPixels ?? 40_000_000,
    auto: raw.auto ?? false,
  };
}

/**
 * Simple CSS color → RGB parser (supports hex only for V1).
 * Falls back to white for unrecognized formats.
 */
function parseCssColor(color: string): [number, number, number] {
  const hex = color.trim().replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return [r, g, b];
    }
  }
  return [255, 255, 255];
}

// ---------------------------------------------------------------------------
// Public compressor function (used by both Worker and main-thread paths)
// ---------------------------------------------------------------------------

/**
 * Run the complete compression pipeline and return a CompressionResult.
 *
 * This function is used both by the Worker (called inside worker context)
 * and by the main-thread fallback in compressImage.ts.
 */
export async function runCompressor(
  file: File | Blob,
  options: CompressOptions = {},
): Promise<CompressionResult> {
  const startTime = Date.now();
  const warnings: CompressionWarning[] = [];

  // ── Step 1: Analyze ──────────────────────────────────────────────────
  options.onProgress?.({ percent: 5, stage: 'analyzing' });

  let analysis: ImageAnalysis;
  try {
    analysis = await analyzeImageFile(file);
  } catch (err) {
    throw err instanceof ImageCompressionError ? err : wrapUnknownError(err, 'INVALID_IMAGE');
  }

  // Warn about animation
  if (analysis.animated) {
    warnings.push({
      code: 'ANIMATION_NOT_SUPPORTED',
      message:
        `The input image appears to be animated (${analysis.frameCount ?? 'multiple'} frames). ` +
        `Animated images are not supported in V1. Only the first frame will be processed.`,
    });
  }

  options.onProgress?.({ percent: 10, stage: 'analyzing' });

  // ── Step 2: Normalize options ────────────────────────────────────────
  let normalizedOptions: NormalizedCompressOptions;
  try {
    normalizedOptions = buildNormalizedOptions(analysis.format, options);
  } catch (err) {
    throw err instanceof ImageCompressionError ? err : wrapUnknownError(err, 'INVALID_OPTIONS');
  }

  const memoryManager = new MemoryManager(normalizedOptions.maxPixels);

  // ── Step 3: Execute pipeline ─────────────────────────────────────────
  const pipelineResult = await executePipeline(file, {
    analysis,
    options: normalizedOptions,
    signal: options.signal,
    onProgress: options.onProgress,
    memoryManager,
  });

  warnings.push(...pipelineResult.warnings);

  // ── Step 4: Assemble result ──────────────────────────────────────────
  const mimeType = formatToMime(normalizedOptions.outputFormat);
  const outputBlob = new Blob([pipelineResult.buffer], { type: mimeType });

  const savedBytes = file.size - outputBlob.size;
  const savedPercentage = file.size > 0
    ? Math.round((savedBytes / file.size) * 10000) / 100
    : 0;
  const ratio = savedPercentage;

  const result: CompressionResult = {
    blob: outputBlob,
    original: {
      size: file.size,
      width: analysis.width,
      height: analysis.height,
      format: analysis.format,
    },
    output: {
      size: outputBlob.size,
      width: pipelineResult.outputWidth,
      height: pipelineResult.outputHeight,
      format: normalizedOptions.outputFormat,
    },
    compression: {
      ratio,
      savedBytes,
      savedPercentage,
    },
    processingTime: Date.now() - startTime,
    achievedTarget: pipelineResult.achievedTarget,
    warnings,
  };

  return result;
}
