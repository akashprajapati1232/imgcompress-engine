/**
 * @fileoverview Native browser encoder using Canvas.toBlob().
 *
 * This encoder uses the browser's built-in canvas encoding capabilities.
 * It is non-deterministic (quality semantics differ across browsers/OS)
 * and does not support AVIF in most browsers.
 *
 * It is used as a fallback when WASM is unavailable or a format
 * cannot be handled by jSquash.
 */

import type { ImageFormat } from '../types/index.js';
import { formatToMime } from '../analysis/format.js';
import { compressionFailed, encoderUnavailable } from '../errors/ImageCompressionError.js';

/**
 * Encode ImageData to a Blob using the native Canvas API.
 *
 * @param imageData RGBA pixel data to encode.
 * @param format Target image format.
 * @param quality Quality in [0, 1] for lossy formats.
 * @returns Encoded image as ArrayBuffer.
 * @throws {ImageCompressionError} ENCODER_UNAVAILABLE or COMPRESSION_FAILED.
 */
export async function nativeEncode(
  imageData: ImageData,
  format: ImageFormat,
  quality: number,
): Promise<ArrayBuffer> {
  const mimeType = formatToMime(format);

  // Create canvas and draw the pixel data
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(imageData.width, imageData.height);
    ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  } else if (typeof document !== 'undefined') {
    const htmlCanvas = document.createElement('canvas');
    htmlCanvas.width = imageData.width;
    htmlCanvas.height = imageData.height;
    canvas = htmlCanvas;
    ctx = htmlCanvas.getContext('2d');
  } else {
    throw encoderUnavailable(format);
  }

  if (!ctx) {
    throw compressionFailed('Could not get 2D canvas context for native encoding.');
  }

  ctx.putImageData(imageData, 0, 0);

  // Encode to Blob
  if (canvas instanceof OffscreenCanvas) {
    try {
      const blob = await canvas.convertToBlob({ type: mimeType, quality });
      if (!blob) throw new Error('convertToBlob returned null');
      return blob.arrayBuffer();
    } catch (err) {
      throw compressionFailed(
        err instanceof Error ? err.message : 'OffscreenCanvas encoding failed',
      );
    }
  } else {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (blob) => {
          if (!blob) {
            reject(encoderUnavailable(format));
            return;
          }
          blob.arrayBuffer().then(resolve).catch(reject);
        },
        mimeType,
        quality,
      );
    });
  }
}

/**
 * Decode an image file to ImageData using the browser canvas.
 *
 * @param file The image file to decode.
 * @returns RGBA ImageData.
 */
export async function nativeDecode(file: File | Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  let canvas: HTMLCanvasElement | OffscreenCanvas;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  } else {
    const htmlCanvas = document.createElement('canvas');
    htmlCanvas.width = width;
    htmlCanvas.height = height;
    canvas = htmlCanvas;
    ctx = htmlCanvas.getContext('2d');
  }

  if (!ctx) {
    bitmap.close();
    throw compressionFailed('Could not get 2D canvas context for native decode.');
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  return ctx.getImageData(0, 0, width, height);
}
