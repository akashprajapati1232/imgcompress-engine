/**
 * @fileoverview PicaAdapter — high-quality Lanczos3 resize via Pica.
 *
 * Pica is a battle-tested browser resize library that uses WebAssembly
 * and WebWorkers internally for fast, high-quality Lanczos3 downscaling.
 *
 * This adapter:
 *   1. Converts ImageData → canvas
 *   2. Calls Pica to resize to a destination canvas
 *   3. Reads back the result as ImageData
 *
 * Pica is lazy-loaded on first use.
 */

import type { ResizeEngine, ResizeDimensions } from './ResizeEngine.js';
import { resizeFailed } from '../errors/ImageCompressionError.js';

// Pica doesn't have great ESM types; use dynamic import with loose typing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PicaInstance = { resize(from: any, to: any, options?: any): Promise<any> };

/** Lazily-loaded Pica instance (shared across all calls). */
let picaInstance: PicaInstance | null = null;

async function getPica(): Promise<PicaInstance> {
  if (!picaInstance) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const picaModule = await import('pica') as any;
    // Pica v9+ default export is a factory function or constructor
    const picaFactory: (() => PicaInstance) | undefined =
      picaModule.default ?? picaModule;
    picaInstance = typeof picaFactory === 'function' ? picaFactory() : picaModule;
  }
  return picaInstance as PicaInstance;
}

/** Helper: close an OffscreenCanvas safely (not in TS DOM lib but supported at runtime). */
function closeOffscreenCanvas(canvas: HTMLCanvasElement | OffscreenCanvas): void {
  if ('close' in canvas) {
    (canvas as OffscreenCanvas & { close(): void }).close();
  }
}

/** Helper: ImageData → HTMLCanvasElement or OffscreenCanvas. */
function imageDataToCanvas(
  imageData: ImageData,
): HTMLCanvasElement | OffscreenCanvas {
  const canvas =
    typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined'
      ? new OffscreenCanvas(imageData.width, imageData.height)
      : document.createElement('canvas');

  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;

  if (!ctx) {
    throw resizeFailed('Could not get 2D context from canvas for Pica source.');
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** Helper: canvas → ImageData. */
function canvasToImageData(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number,
): ImageData {
  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;

  if (!ctx) {
    throw resizeFailed('Could not read back ImageData from Pica destination canvas.');
  }

  return ctx.getImageData(0, 0, width, height);
}

/**
 * Pica-based high-quality image resizer.
 *
 * Implements `ResizeEngine` interface.
 * Uses Lanczos3 filter for maximum quality downscaling.
 */
export class PicaAdapter implements ResizeEngine {
  async resize(
    source: ImageData,
    target: ResizeDimensions,
  ): Promise<ImageData> {
    // Fast path: dimensions are already correct
    if (source.width === target.width && source.height === target.height) {
      return source;
    }

    try {
      const pica = await getPica();

      // Source canvas
      const from = imageDataToCanvas(source);

      // Destination canvas
      let to: HTMLCanvasElement | OffscreenCanvas;
      if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') {
        to = new OffscreenCanvas(target.width, target.height);
      } else {
        to = document.createElement('canvas');
        to.width = target.width;
        to.height = target.height;
      }

      // Pica only accepts HTMLCanvasElement | ImageBitmap as source in some versions.
      // We cast — in practice pica v9 handles OffscreenCanvas in workers.
      await pica.resize(from, to, { filter: 'lanczos3' });

      const result = canvasToImageData(to, target.width, target.height);

      // Clean up OffscreenCanvas if possible
      closeOffscreenCanvas(from);
      closeOffscreenCanvas(to);

      return result;
    } catch (err) {
      if (err instanceof Error && err.name === 'ImageCompressionError') {
        throw err;
      }
      throw resizeFailed(err instanceof Error ? err.message : String(err));
    }
  }
}

/** Singleton Pica adapter instance. */
export const picaAdapter = new PicaAdapter();
