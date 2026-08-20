/**
 * @imgcompress/engine
 *
 * Production-grade browser-side image compression engine.
 *
 * Public API surface — only what is exported here is part of the
 * stable public interface of this package.
 */

// ---------------------------------------------------------------------------
// Primary API functions
// ---------------------------------------------------------------------------

export { compressImage } from './api/compressImage.js';
export { analyzeImage } from './api/analyzeImage.js';
export { getCapabilities } from './api/getCapabilities.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type {
  // Core options
  CompressOptions,
  QualityInput,
  SizeInput,
  TransparencyPolicy,
  MetadataPolicy,

  // Formats
  ImageFormat,
  ImageMimeType,

  // Results
  CompressionResult,
  CompressionStats,
  ImageStats,
  ImageAnalysis,

  // Progress
  CompressionProgressEvent,
  CompressionStage,

  // Warnings
  CompressionWarning,
  CompressionWarningCode,

  // Capabilities
  BrowserCapabilities,
  FormatCapabilities,

  // Normalized options (for advanced/library use)
  NormalizedCompressOptions,
} from './types/index.js';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export { ImageCompressionError } from './errors/ImageCompressionError.js';
export type { CompressionErrorCode } from './errors/ImageCompressionError.js';
