/**
 * @fileoverview ResizeEngine — abstract resize interface.
 *
 * All resize implementations conform to this interface.
 * This makes it possible to swap Pica for another implementation
 * without touching the rest of the codebase.
 */

/** Target dimensions for a resize operation. */
export interface ResizeDimensions {
  width: number;
  height: number;
}

/**
 * Abstract resize engine interface.
 * Implementations must be stateless and safe to call concurrently.
 */
export interface ResizeEngine {
  /**
   * Resize RGBA ImageData to the specified dimensions.
   *
   * @param source The source ImageData (RGBA).
   * @param target The desired output dimensions.
   * @returns New ImageData at the target dimensions.
   */
  resize(source: ImageData, target: ResizeDimensions): Promise<ImageData>;
}

/**
 * Compute the output dimensions for a resize operation given constraints.
 *
 * Rules:
 * - Aspect ratio is always preserved when `preserveAspectRatio` is true.
 * - Only scales DOWN — never scales up unless `allowUpscale` is explicitly true.
 * - Returns original dimensions if no constraint requires resizing.
 */
export function computeTargetDimensions(
  original: ResizeDimensions,
  constraints: {
    maxWidth?: number | null;
    maxHeight?: number | null;
    maxDimension?: number | null;
    preserveAspectRatio?: boolean;
    allowUpscale?: boolean;
  },
): ResizeDimensions {
  let { width, height } = original;

  const maxW = constraints.maxDimension ?? constraints.maxWidth ?? null;
  const maxH = constraints.maxDimension ?? constraints.maxHeight ?? null;
  const preserveAR = constraints.preserveAspectRatio !== false;

  // Check if resize is actually needed
  const needsResize =
    (maxW !== null && width > maxW) ||
    (maxH !== null && height > maxH);

  if (!needsResize) return { width, height };

  if (preserveAR) {
    const scaleX = maxW !== null ? maxW / width : Infinity;
    const scaleY = maxH !== null ? maxH / height : Infinity;
    const scale = Math.min(scaleX, scaleY, 1); // Never scale up

    width = Math.round(width * scale);
    height = Math.round(height * scale);
  } else {
    if (maxW !== null) width = Math.min(width, maxW);
    if (maxH !== null) height = Math.min(height, maxH);
  }

  // Ensure minimum 1×1
  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

/** Returns true if a resize is needed given original dims and constraints. */
export function needsResize(
  original: ResizeDimensions,
  constraints: {
    maxWidth?: number | null;
    maxHeight?: number | null;
    maxDimension?: number | null;
  },
): boolean {
  const target = computeTargetDimensions(original, constraints);
  return target.width !== original.width || target.height !== original.height;
}
