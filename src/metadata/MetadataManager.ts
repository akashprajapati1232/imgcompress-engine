/**
 * @fileoverview MetadataManager — EXIF/ICC metadata policy abstraction.
 *
 * V1 implements:
 *   - strip: discard all metadata (default, achieved by re-encoding via jSquash)
 *   - preserve: stub — returns original bytes unmodified (best-effort)
 *
 * Architecture:
 *   The MetadataManager is intentionally kept separate from the core
 *   compression pipeline so that EXIF/ICC handling can be added later
 *   (e.g. using exifr or piexifjs) without touching the Optimizer or Pipeline.
 *
 * Also exports the `flattenAlpha` helper used by the Pipeline for
 * transparency handling.
 */

import type { MetadataPolicy } from '../types/index.js';

/**
 * Process metadata according to the given policy.
 *
 * In V1:
 *  - "strip": no-op — metadata is stripped by default during WASM re-encode.
 *  - "preserve": stub — returns the buffer unchanged. Full EXIF copy requires
 *    a dedicated EXIF library and will be implemented in a future version.
 *
 * @param inputBuffer The original image buffer.
 * @param outputBuffer The re-encoded (compressed) buffer.
 * @param policy Metadata policy.
 * @returns The buffer to use as the final output.
 */
export function applyMetadataPolicy(
  _inputBuffer: ArrayBuffer,
  outputBuffer: ArrayBuffer,
  policy: MetadataPolicy,
): ArrayBuffer {
  switch (policy) {
    case 'strip':
      // jSquash WASM encoders strip metadata by default — output is already clean.
      return outputBuffer;

    case 'preserve':
      // V1 stub: preserving metadata requires EXIF/ICC parsing.
      // Future: copy EXIF header from inputBuffer into outputBuffer.
      console.warn(
        '[imgcompress] preserveMetadata: true is not yet fully implemented. ' +
        'Metadata preservation requires a future EXIF library integration.',
      );
      return outputBuffer;
  }
}

/**
 * Flatten the alpha channel of an ImageData by compositing it over a
 * solid background color.
 *
 * Used when converting transparent PNG/WebP → JPEG with transparency: "flatten".
 *
 * @param imageData Source RGBA ImageData.
 * @param background RGB background color [r, g, b].
 * @returns New ImageData with alpha composited onto the background.
 */
export function flattenAlpha(
  imageData: ImageData,
  background: [number, number, number],
): ImageData {
  const [bgR, bgG, bgB] = background;
  const src = imageData.data;
  const output = new ImageData(imageData.width, imageData.height);
  const dst = output.data;

  for (let i = 0; i < src.length; i += 4) {
    const alpha = (src[i + 3] ?? 255) / 255;
    const inv = 1 - alpha;

    dst[i]     = Math.round((src[i]!     ?? 0) * alpha + (bgR ?? 255) * inv);
    dst[i + 1] = Math.round((src[i + 1]! ?? 0) * alpha + (bgG ?? 255) * inv);
    dst[i + 2] = Math.round((src[i + 2]! ?? 0) * alpha + (bgB ?? 255) * inv);
    dst[i + 3] = 255; // Fully opaque
  }

  return output;
}
