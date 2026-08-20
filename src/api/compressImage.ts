/**
 * @fileoverview compressImage — primary public API entry point.
 *
 * Processing strategy:
 *   1. Try to run in a Web Worker (prevents UI blocking).
 *   2. If Workers are unavailable or spawning fails, fall back to
 *      running the same pipeline on the main thread.
 *
 * The Worker is created from a Blob URL (inline) so consumers do not
 * need to configure their bundler to handle worker file paths.
 */

import type { CompressOptions, CompressionResult, CompressionWarning, CompressionStage } from '../types/index.js';
import type {
  CompressRequest,
  WorkerResponse,
  ProgressResponse,
  CompressSuccessResponse,
  ErrorResponse,
} from '../worker/protocol.js';

import { ImageCompressionError, wrapUnknownError } from '../errors/ImageCompressionError.js';
import { formatToMime } from '../analysis/format.js';
import { invalidImage } from '../errors/ImageCompressionError.js';

// ---------------------------------------------------------------------------
// Worker management
// ---------------------------------------------------------------------------

/**
 * Get or create the compression worker.
 *
 * Uses standard ECMAScript worker instantiation (`new URL(..., import.meta.url)`).
 * Modern bundlers (Webpack 5, Vite, Rollup) and native browsers support this pattern
 * out of the box, allowing the library to be framework-agnostic.
 */
function createWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;

  try {
    // We point to the built .js file directly so Vite's worker plugin doesn't
    // spawn a duplicate build pass. Both entry points are built together in vite.config.ts.
    // String concatenation bypasses Vite's static analysis of new URL(..., import.meta.url)
    const workerFile = 'compression.worker.js';
    return new Worker(
      new URL('./' + workerFile, import.meta.url),
      { type: 'module' }
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Worker-based compression
// ---------------------------------------------------------------------------

function compressViaWorker(
  file: File | Blob,
  options: CompressOptions,
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    const worker = createWorker();

    if (!worker) {
      reject(new Error('Worker unavailable'));
      return;
    }

    const id = generateRequestId();
    let settled = false;

    // Handle AbortSignal
    const abortHandler = () => {
      if (settled) return;
      const cancelMsg = { type: 'cancel', id };
      worker.postMessage(cancelMsg);
      worker.terminate();
      settled = true;
      reject(new ImageCompressionError('OPERATION_CANCELLED', 'The operation was cancelled.'));
    };

    options.signal?.addEventListener('abort', abortHandler, { once: true });

    worker.onmessage = async (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.id !== id) return;

      switch (response.type) {
        case 'progress': {
          const p = response as ProgressResponse;
          options.onProgress?.({ percent: p.percent, stage: p.stage as CompressionStage });
          break;
        }

        case 'compress-success': {
          if (settled) return;
          settled = true;
          options.signal?.removeEventListener('abort', abortHandler);
          worker.terminate();

          const r = response as CompressSuccessResponse;
          const mimeType = formatToMime(r.result.output.format);
          const blob = new Blob([r.resultBuffer], { type: mimeType });

          resolve({
            blob,
            original: r.result.original,
            output: r.result.output,
            compression: r.result.compression,
            processingTime: r.result.processingTime,
            achievedTarget: r.result.achievedTarget,
            warnings: r.result.warnings,
          });
          break;
        }

        case 'error': {
          if (settled) return;
          settled = true;
          options.signal?.removeEventListener('abort', abortHandler);
          worker.terminate();

          const e = response as ErrorResponse;
          reject(
            new ImageCompressionError(
              e.code as ImageCompressionError['code'],
              e.message,
              e.details,
            ),
          );
          break;
        }
      }
    };

    worker.onerror = (err) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', abortHandler);
      worker.terminate();
      reject(wrapUnknownError(err, 'WORKER_UNAVAILABLE'));
    };

    // Post the compress request
    file.arrayBuffer().then((buffer) => {
      const request: CompressRequest = {
        type: 'compress',
        id,
        buffer,
        fileName: file instanceof File ? file.name : 'image',
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        options: {
          auto: options.auto,
          quality: options.quality,
          targetSize: options.targetSize,
          maxFileSize: options.maxFileSize,
          outputFormat: options.outputFormat,
          maxWidth: options.maxWidth,
          maxHeight: options.maxHeight,
          maxDimension: options.maxDimension,
          preserveAspectRatio: options.preserveAspectRatio,
          preserveMetadata: options.preserveMetadata,
          transparency: options.transparency,
          transparencyBackground: options.transparencyBackground,
          maxPixels: options.maxPixels ?? 40_000_000,
        },
      };

      worker.postMessage(request, [buffer]);
    }).catch((err) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(wrapUnknownError(err, 'INVALID_IMAGE'));
    });
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compress an image using the browser-side compression engine.
 *
 * Processing runs in a Web Worker when available to avoid blocking the UI.
 * Falls back to main-thread processing when Workers are unavailable.
 *
 * @param file A File or Blob containing the image to compress.
 * @param options Compression options.
 * @returns A CompressionResult with the compressed Blob and statistics.
 *
 * @throws {ImageCompressionError} On invalid input, unsupported format, or compression failure.
 *
 * @example
 * ```ts
 * // Simple usage
 * const result = await compressImage(file);
 *
 * // With target size
 * const result = await compressImage(file, {
 *   targetSize: "100KB",
 *   outputFormat: "webp",
 * });
 *
 * // With progress and cancellation
 * const controller = new AbortController();
 * const result = await compressImage(file, {
 *   targetSize: "500KB",
 *   signal: controller.signal,
 *   onProgress(progress) {
 *     console.log(`${progress.stage}: ${progress.percent}%`);
 *   },
 * });
 * ```
 */
export async function compressImage(
  file: File | Blob,
  options: CompressOptions = {},
): Promise<CompressionResult> {
  // Input validation
  if (!(file instanceof File) && !(file instanceof Blob)) {
    throw invalidImage('compressImage() requires a File or Blob instance.');
  }

  if (file.size === 0) {
    throw invalidImage('The provided file is empty (0 bytes).');
  }

  // Try worker path first
  if (typeof Worker !== 'undefined') {
    try {
      return await compressViaWorker(file, options);
    } catch (err) {
      // If worker creation failed (not a real compression error), fall through
      if (
        err instanceof ImageCompressionError &&
        (err.code === 'OPERATION_CANCELLED' || err.code === 'WORKER_UNAVAILABLE')
      ) {
        if (err.code === 'OPERATION_CANCELLED') throw err;
        // WORKER_UNAVAILABLE → fall through to main thread
      } else if (err instanceof ImageCompressionError) {
        throw err; // Real compression error — propagate
      }
      // Unknown worker error → fall through to main thread
    }
  }

  // Main-thread fallback
  const fallbackWarning: CompressionWarning = {
    code: 'ENCODER_FALLBACK',
    message: 'Web Worker unavailable. Processing on main thread may affect UI responsiveness.',
  };

  const { runCompressor } = await import('../core/Compressor.js');
  const result = await runCompressor(file, options);
  return {
    ...result,
    warnings: [fallbackWarning, ...result.warnings],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let requestCounter = 0;

function generateRequestId(): string {
  return `req-${Date.now()}-${++requestCounter}`;
}
