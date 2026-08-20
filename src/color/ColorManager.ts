/**
 * @fileoverview ColorManager — color space management stub.
 *
 * V1: passthrough — no color space transformation is applied.
 *
 * Architecture is reserved for future:
 *   - sRGB conversion
 *   - ICC profile stripping / embedding
 *   - Gamma correction
 *   - Wide-gamut → sRGB conversion for JPEG output
 *
 * The ColorManager sits between decode and encode in the Pipeline.
 * Adding ICC support in the future should require changes only here.
 */

export type ColorPolicy = 'passthrough' | 'srgb';

/**
 * Apply color space policy to ImageData.
 *
 * V1: always returns the input ImageData unchanged.
 *
 * @param imageData RGBA ImageData from decoder.
 * @param policy Color policy to apply.
 * @returns Processed ImageData.
 */
export function applyColorPolicy(
  imageData: ImageData,
  policy: ColorPolicy = 'passthrough',
): ImageData {
  switch (policy) {
    case 'passthrough':
      return imageData;

    case 'srgb':
      // Future: apply sRGB conversion matrix
      // For now, passthrough
      return imageData;
  }
}
