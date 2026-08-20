/**
 * @fileoverview Extract image dimensions via createImageBitmap.
 *
 * Using createImageBitmap is significantly faster than full canvas decode
 * and does not require reading all pixel data into memory.
 */

import { invalidImage, corruptedImage } from '../errors/ImageCompressionError.js';

export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

/**
 * Extract width and height from a File/Blob using `createImageBitmap`.
 *
 * Falls back to a canvas decode if createImageBitmap is unavailable
 * (should not happen in modern browsers).
 *
 * @throws {ImageCompressionError} INVALID_IMAGE — if the image cannot be decoded.
 */
export async function extractDimensions(
  file: File | Blob,
): Promise<ImageDimensions> {
  if (typeof createImageBitmap === 'undefined') {
    // Fallback: canvas decode
    return extractDimensionsViaCanvas(file);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    throw corruptedImage(
      err instanceof Error ? err.message : 'createImageBitmap failed',
    );
  }

  const { width, height } = bitmap;
  bitmap.close();

  if (width === 0 || height === 0) {
    throw invalidImage('Image has zero dimensions.');
  }

  return { width, height, aspectRatio: width / height };
}

/** Fallback dimension extraction via HTMLCanvasElement. */
async function extractDimensionsViaCanvas(
  file: File | Blob,
): Promise<ImageDimensions> {
  return new Promise<ImageDimensions>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: width, naturalHeight: height } = img;
      if (width === 0 || height === 0) {
        reject(invalidImage('Image has zero dimensions.'));
        return;
      }
      resolve({ width, height, aspectRatio: width / height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(corruptedImage('Image element failed to load.'));
    };

    img.src = url;
  });
}
