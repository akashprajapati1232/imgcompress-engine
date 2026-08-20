/**
 * @fileoverview Pipeline — ordered processing stages with progress reporting.
 *
 * The Pipeline orchestrates the full compression flow:
 *
 *   ANALYZING (0–10%)
 *       ↓
 *   DECODING (10–25%)
 *       ↓
 *   RESIZING (25–40%)  ← skipped if no resize needed
 *       ↓
 *   ENCODING (40–72%)
 *       ↓
 *   OPTIMIZING (72–91%) ← only when target/max size set
 *       ↓
 *   FINALIZING (91–100%)
 *
 * Cancellation is checked at the start of each stage and inside loops.
 */

import type {
  CompressionStage,
  CompressionProgressEvent,
  CompressionResult,
  CompressionWarning,
  ImageAnalysis,
  NormalizedCompressOptions,
} from '../types/index.js';
import { operationCancelled, transparencyNotSupported, wrapUnknownError } from '../errors/ImageCompressionError.js';
import { decode } from '../encoders/EncoderManager.js';
import { encodeAtQuality, runTargetSizeOptimizer, enforceMaxFileSize } from './Optimizer.js';
import { picaAdapter } from '../resize/PicaAdapter.js';
import { computeTargetDimensions, needsResize } from '../resize/ResizeEngine.js';
import { MemoryManager } from './MemoryManager.js';
import { formatToMime } from '../analysis/format.js';
import { flattenAlpha } from '../metadata/MetadataManager.js';

/** Stage progress ranges [start, end]. */
const STAGE_RANGES: Record<CompressionStage, [number, number]> = {
  analyzing:  [0,   10],
  decoding:   [10,  25],
  resizing:   [25,  40],
  encoding:   [40,  72],
  optimizing: [72,  91],
  finalizing: [91, 100],
  completed:  [100, 100],
};

export interface PipelineContext {
  analysis: ImageAnalysis;
  options: NormalizedCompressOptions;
  signal?: AbortSignal;
  onProgress?: (event: CompressionProgressEvent) => void;
  memoryManager: MemoryManager;
}

export interface PipelineResult {
  buffer: ArrayBuffer;
  outputWidth: number;
  outputHeight: number;
  achievedTarget: boolean;
  quality: number;
  warnings: CompressionWarning[];
}

/**
 * Execute the full compression pipeline.
 *
 * @param file The original image file.
 * @param ctx Pipeline context (analysis, options, signal, progress).
 */
export async function executePipeline(
  file: File | Blob,
  ctx: PipelineContext,
): Promise<PipelineResult> {
  const { analysis, options, signal, memoryManager } = ctx;
  const warnings: CompressionWarning[] = [];

  function emit(stage: CompressionStage, fraction = 0.5): void {
    if (!ctx.onProgress) return;
    const [start, end] = STAGE_RANGES[stage]!;
    const percent = Math.min(100, Math.round(start + (end - start) * fraction));
    ctx.onProgress({ percent, stage });
  }

  function checkCancel(): void {
    if (signal?.aborted) throw operationCancelled();
  }

  // ── ANALYZING ─────────────────────────────────────────────────────────
  emit('analyzing', 1);
  checkCancel();

  // Pixel limit check
  memoryManager.checkPixelLimit(analysis.width, analysis.height);

  // Transparency policy check — before decode, fast fail
  const targetFormat = options.outputFormat;
  if (analysis.hasAlpha && targetFormat === 'jpeg') {
    if (options.transparency === 'error') {
      throw transparencyNotSupported(analysis.format, 'jpeg');
    }
  }

  emit('analyzing', 1);

  // ── DECODING ──────────────────────────────────────────────────────────
  emit('decoding', 0.1);
  checkCancel();

  const decodeResult = await decode(file, analysis.format);
  let imageData = memoryManager.track(decodeResult.imageData);
  warnings.push(...decodeResult.warnings);

  emit('decoding', 1);
  checkCancel();

  // ── TRANSPARENCY HANDLING ─────────────────────────────────────────────
  if (analysis.hasAlpha && targetFormat === 'jpeg') {
    if (options.transparency === 'flatten') {
      imageData = flattenAlpha(imageData, options.transparencyBackground);
      warnings.push({
        code: 'TRANSPARENCY_LOST',
        message: `Alpha channel was composited onto a background color for JPEG output.`,
      });
    } else if (options.transparency === 'allow-loss') {
      // Alpha channel will be ignored during encode — no modification needed
      warnings.push({
        code: 'TRANSPARENCY_LOST',
        message: `JPEG does not support transparency. Alpha channel was discarded.`,
      });
    }
  }

  // ── RESIZING ──────────────────────────────────────────────────────────
  let outputWidth = imageData.width;
  let outputHeight = imageData.height;

  const resizeConstraints = {
    maxWidth: options.maxWidth,
    maxHeight: options.maxHeight,
  };

  if (needsResize({ width: imageData.width, height: imageData.height }, resizeConstraints)) {
    emit('resizing', 0.1);
    checkCancel();

    const targetDims = computeTargetDimensions(
      { width: imageData.width, height: imageData.height },
      {
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
        preserveAspectRatio: options.preserveAspectRatio,
      },
    );

    imageData = await picaAdapter.resize(imageData, targetDims);
    outputWidth = targetDims.width;
    outputHeight = targetDims.height;

    emit('resizing', 1);
    checkCancel();
  }

  // ── ENCODING / OPTIMIZING ─────────────────────────────────────────────
  let buffer: ArrayBuffer;
  let quality = options.qualityMax;
  let achievedTarget = false;

  if (options.targetSizeBytes !== null) {
    // Target size: run full optimizer
    emit('optimizing', 0.05);
    checkCancel();

    const optimizerResult = await runTargetSizeOptimizer(imageData, targetFormat, {
      targetSizeBytes: options.targetSizeBytes,
      qualityMin: options.qualityMin,
      qualityMax: options.qualityMax,
      allowDimensionReduction: true,
      signal,
    });

    buffer = optimizerResult.buffer;
    quality = optimizerResult.quality;
    achievedTarget = optimizerResult.achievedTarget;
    outputWidth = imageData.width;
    outputHeight = imageData.height;
    warnings.push(...optimizerResult.warnings);

    if (optimizerResult.scaleFactor < 1) {
      outputWidth = Math.round(imageData.width * optimizerResult.scaleFactor);
      outputHeight = Math.round(imageData.height * optimizerResult.scaleFactor);
    }

    emit('optimizing', 1);

  } else if (options.maxFileSizeBytes !== null) {
    // Max file size: encode and shrink if needed
    emit('optimizing', 0.05);
    checkCancel();

    const enforceResult = await enforceMaxFileSize(imageData, targetFormat, options.maxFileSizeBytes, {
      qualityMin: options.qualityMin,
      qualityMax: options.qualityMax,
      signal,
    });

    buffer = enforceResult.buffer;
    quality = enforceResult.quality;
    achievedTarget = enforceResult.achievedTarget;
    warnings.push(...enforceResult.warnings);

    emit('optimizing', 1);

  } else {
    // Fixed quality or auto encode
    emit('encoding', 0.1);
    checkCancel();

    buffer = await encodeAtQuality(imageData, targetFormat, quality);

    emit('encoding', 1);
  }

  // ── FINALIZING ────────────────────────────────────────────────────────
  emit('finalizing', 0.5);
  checkCancel();

  memoryManager.releaseAll();

  emit('completed', 1);

  return {
    buffer,
    outputWidth,
    outputHeight,
    achievedTarget,
    quality,
    warnings,
  };
}
