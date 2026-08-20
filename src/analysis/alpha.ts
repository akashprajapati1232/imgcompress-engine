/**
 * @fileoverview Alpha channel detection.
 *
 * Determines whether an image contains any transparent pixels by
 * sampling the decoded RGBA pixel data from a canvas.
 *
 * We sample rather than scanning every pixel to keep this fast for
 * large images. The sampling grid is fine enough to catch common
 * transparency patterns (full alpha, partial alpha, rounded corners).
 */

/** The number of sample points along each axis. */
const SAMPLE_GRID = 32;

/**
 * Detect whether an image contains any transparent (alpha < 255) pixels.
 *
 * For formats that cannot contain alpha (JPEG), this always returns false
 * without performing any actual analysis.
 *
 * @param file The image file/blob to analyze.
 * @param format The image format (used to skip analysis for opaque formats).
 */
export async function detectAlpha(
  file: File | Blob,
  format: string,
): Promise<boolean> {
  // JPEG cannot have transparency — fast path
  if (format === 'jpeg') return false;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Cannot decode — assume no alpha rather than failing the analysis
    return false;
  }

  const { width, height } = bitmap;
  const canvas = createOffscreenOrRegularCanvas(width, height);
  const ctx = getContext2D(canvas);

  if (!ctx) {
    bitmap.close();
    return false;
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  // Sample across the image in a grid
  const stepX = Math.max(1, Math.floor(width / SAMPLE_GRID));
  const stepY = Math.max(1, Math.floor(height / SAMPLE_GRID));
  const hasAlpha = sampleAlpha(ctx, width, height, stepX, stepY);

  // Cleanup canvas if possible (close() is not in TS DOM lib but is supported at runtime)
  if ('close' in canvas) {
    (canvas as OffscreenCanvas & { close(): void }).close();
  }

  return hasAlpha;
}

function sampleAlpha(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  stepX: number,
  stepY: number,
): boolean {
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const pixel = ctx.getImageData(x, y, 1, 1);
      // Alpha is the 4th channel (index 3)
      const alpha = pixel.data[3];
      if (alpha !== undefined && alpha < 255) {
        return true;
      }
    }
  }
  return false;
}

function createOffscreenOrRegularCanvas(
  width: number,
  height: number,
): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getContext2D(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  return canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
}
