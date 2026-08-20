/**
 * @fileoverview Typed error hierarchy for @imgcompress/engine
 *
 * All errors thrown by the library are instances of `ImageCompressionError`
 * with a typed `code` field that consumers can switch on for precise handling.
 */

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

/** All possible error codes thrown by the compression engine. */
export type CompressionErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'INVALID_IMAGE'
  | 'CORRUPTED_IMAGE'
  | 'IMAGE_TOO_LARGE'
  | 'PIXEL_LIMIT_EXCEEDED'
  | 'TARGET_SIZE_IMPOSSIBLE'
  | 'ENCODER_UNAVAILABLE'
  | 'BROWSER_CAPABILITY_UNAVAILABLE'
  | 'COMPRESSION_FAILED'
  | 'RESIZE_FAILED'
  | 'OPERATION_CANCELLED'
  | 'TRANSPARENCY_NOT_SUPPORTED'
  | 'WORKER_UNAVAILABLE'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'TARGET_SIZE_NOT_REACHED'
  | 'DECODE_FAILED'
  | 'INVALID_OPTIONS';

// ---------------------------------------------------------------------------
// Error Class
// ---------------------------------------------------------------------------

/**
 * The base error class for all errors thrown by @imgcompress/engine.
 *
 * Consumers can use the `code` property to distinguish error types:
 *
 * @example
 * ```ts
 * try {
 *   await compressImage(file);
 * } catch (err) {
 *   if (err instanceof ImageCompressionError) {
 *     switch (err.code) {
 *       case 'UNSUPPORTED_FORMAT':
 *         // handle unsupported format
 *         break;
 *       case 'OPERATION_CANCELLED':
 *         // handle user cancellation
 *         break;
 *     }
 *   }
 * }
 * ```
 */
export class ImageCompressionError extends Error {
  /** Machine-readable error code. */
  readonly code: CompressionErrorCode;

  /** Optional additional context (e.g. format name, size value). */
  readonly details?: Record<string, unknown>;

  constructor(
    code: CompressionErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ImageCompressionError';
    this.code = code;
    this.details = details;

    // Restore prototype chain (required for custom Error classes in TS).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Factory helpers — keep throw sites DRY
// ---------------------------------------------------------------------------

/** Creates an UNSUPPORTED_FORMAT error. */
export function unsupportedFormat(format: string): ImageCompressionError {
  return new ImageCompressionError(
    'UNSUPPORTED_FORMAT',
    `Image format "${format}" is not supported. Supported formats: jpeg, png, webp, avif.`,
    { format },
  );
}

/** Creates an INVALID_IMAGE error. */
export function invalidImage(reason?: string): ImageCompressionError {
  return new ImageCompressionError(
    'INVALID_IMAGE',
    `The provided file is not a valid image${reason ? ': ' + reason : '.'}`,
    { reason },
  );
}

/** Creates a CORRUPTED_IMAGE error. */
export function corruptedImage(reason?: string): ImageCompressionError {
  return new ImageCompressionError(
    'CORRUPTED_IMAGE',
    `Image data appears to be corrupted${reason ? ': ' + reason : '.'}`,
    { reason },
  );
}

/** Creates a PIXEL_LIMIT_EXCEEDED error. */
export function pixelLimitExceeded(
  pixels: number,
  maxPixels: number,
): ImageCompressionError {
  return new ImageCompressionError(
    'PIXEL_LIMIT_EXCEEDED',
    `Image has ${pixels.toLocaleString()} pixels which exceeds the limit of ${maxPixels.toLocaleString()} pixels. ` +
      `Pass a higher maxPixels option to override.`,
    { pixels, maxPixels },
  );
}

/** Creates an OPERATION_CANCELLED error. */
export function operationCancelled(): ImageCompressionError {
  return new ImageCompressionError(
    'OPERATION_CANCELLED',
    'The compression operation was cancelled.',
  );
}

/** Creates a TRANSPARENCY_NOT_SUPPORTED error. */
export function transparencyNotSupported(
  inputFormat: string,
  outputFormat: string,
): ImageCompressionError {
  return new ImageCompressionError(
    'TRANSPARENCY_NOT_SUPPORTED',
    `Cannot convert transparent ${inputFormat} to ${outputFormat} because ${outputFormat} does not support transparency. ` +
      `Set transparency: "flatten" to composite on a background color, or transparency: "allow-loss" to discard the alpha channel.`,
    { inputFormat, outputFormat },
  );
}

/** Creates an ENCODER_UNAVAILABLE error. */
export function encoderUnavailable(format: string): ImageCompressionError {
  return new ImageCompressionError(
    'ENCODER_UNAVAILABLE',
    `No encoder is available for the "${format}" format in this browser.`,
    { format },
  );
}

/** Creates a COMPRESSION_FAILED error. */
export function compressionFailed(reason?: string): ImageCompressionError {
  return new ImageCompressionError(
    'COMPRESSION_FAILED',
    `Compression failed${reason ? ': ' + reason : '.'}`,
    { reason },
  );
}

/** Creates a RESIZE_FAILED error. */
export function resizeFailed(reason?: string): ImageCompressionError {
  return new ImageCompressionError(
    'RESIZE_FAILED',
    `Resize failed${reason ? ': ' + reason : '.'}`,
    { reason },
  );
}

/** Creates a DECODE_FAILED error. */
export function decodeFailed(format: string, reason?: string): ImageCompressionError {
  return new ImageCompressionError(
    'DECODE_FAILED',
    `Failed to decode ${format} image${reason ? ': ' + reason : '.'}`,
    { format, reason },
  );
}

/** Creates an INVALID_OPTIONS error. */
export function invalidOptions(reason: string): ImageCompressionError {
  return new ImageCompressionError('INVALID_OPTIONS', reason);
}

/** Creates a BROWSER_CAPABILITY_UNAVAILABLE error. */
export function browserCapabilityUnavailable(
  capability: string,
): ImageCompressionError {
  return new ImageCompressionError(
    'BROWSER_CAPABILITY_UNAVAILABLE',
    `Required browser capability "${capability}" is not available.`,
    { capability },
  );
}

/** Checks if an error is an AbortError from AbortController. */
export function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'AbortError' ||
      (err instanceof ImageCompressionError && err.code === 'OPERATION_CANCELLED'))
  );
}

/** Wraps an unknown throw value into an ImageCompressionError. */
export function wrapUnknownError(
  err: unknown,
  fallbackCode: CompressionErrorCode = 'COMPRESSION_FAILED',
): ImageCompressionError {
  if (err instanceof ImageCompressionError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new ImageCompressionError(fallbackCode, message);
}
