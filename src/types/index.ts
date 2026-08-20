/**
 * @fileoverview Core public TypeScript types for @imgcompress/engine
 *
 * All types used in the public API are exported from this file.
 * Internal implementation types live alongside their respective modules.
 */

// ---------------------------------------------------------------------------
// Image Format
// ---------------------------------------------------------------------------

/** Supported image input and output formats. */
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif';

/** All supported MIME types. */
export type ImageMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/avif';

// ---------------------------------------------------------------------------
// Size Input
// ---------------------------------------------------------------------------

/**
 * A size value expressed as a number (bytes), a kilobyte string, or a
 * megabyte string.
 *
 * @example
 * 102400          // 100 KB in bytes
 * "100KB"
 * "1.5MB"
 */
export type SizeInput = number | `${number}KB` | `${number}MB`;

// ---------------------------------------------------------------------------
// Quality
// ---------------------------------------------------------------------------

/**
 * Quality may be a single number in [0, 1] or a range object
 * specifying min/max bounds for the optimizer.
 */
export type QualityInput =
  | number
  | { min: number; max: number };

// ---------------------------------------------------------------------------
// Transparency Policy
// ---------------------------------------------------------------------------

/**
 * Determines how transparency is handled when converting to a format
 * that does not support an alpha channel (e.g. PNG → JPEG).
 *
 * - `"error"` — throw `TRANSPARENCY_NOT_SUPPORTED` (default)
 * - `"flatten"` — composite image on a solid background color
 * - `"allow-loss"` — silently discard alpha channel
 */
export type TransparencyPolicy = 'error' | 'flatten' | 'allow-loss';

// ---------------------------------------------------------------------------
// Metadata Policy
// ---------------------------------------------------------------------------

/**
 * Controls EXIF/ICC metadata handling.
 *
 * - `"strip"` — remove all metadata (default)
 * - `"preserve"` — attempt to preserve metadata (best-effort)
 */
export type MetadataPolicy = 'strip' | 'preserve';

// ---------------------------------------------------------------------------
// Compression Options
// ---------------------------------------------------------------------------

/** Full set of options accepted by `compressImage()`. */
export interface CompressOptions {
  /**
   * Automatically select all compression parameters.
   * When `true`, other quality/size settings are ignored.
   * @default false
   */
  auto?: boolean;

  /**
   * Manual quality control.
   * - `number`: fixed quality in [0, 1]
   * - `{ min, max }`: quality range the optimizer may use
   */
  quality?: QualityInput;

  /**
   * Target output file size. The optimizer will binary-search for the
   * best quality/dimension combination that approaches this size.
   *
   * @example "100KB", "500KB", "2MB", 102400
   */
  targetSize?: SizeInput;

  /**
   * Maximum output file size. Unlike `targetSize`, the optimizer only
   * ensures the output does NOT exceed this value; it does not try to
   * reach the target from below.
   */
  maxFileSize?: SizeInput;

  /**
   * Output format.
   * Defaults to the same format as the input.
   */
  outputFormat?: ImageFormat;

  /**
   * Maximum output width in pixels. Image is resized down if wider.
   */
  maxWidth?: number;

  /**
   * Maximum output height in pixels. Image is resized down if taller.
   */
  maxHeight?: number;

  /**
   * Constrain both width and height to this value.
   * Equivalent to setting the same value for maxWidth and maxHeight.
   */
  maxDimension?: number;

  /**
   * Preserve the original aspect ratio during resize.
   * @default true
   */
  preserveAspectRatio?: boolean;

  /**
   * Whether to preserve image metadata (EXIF, ICC, etc.).
   * @default false
   */
  preserveMetadata?: boolean;

  /**
   * How to handle transparency when the target format does not support alpha.
   * @default "error"
   */
  transparency?: TransparencyPolicy;

  /**
   * Background color used when `transparency` is `"flatten"`.
   * CSS color string or `[r, g, b]` array.
   * @default "#ffffff"
   */
  transparencyBackground?: string | [number, number, number];

  /**
   * Maximum pixel count (width × height) allowed for input images.
   * Images exceeding this limit throw `PIXEL_LIMIT_EXCEEDED`.
   * @default 40_000_000
   */
  maxPixels?: number;

  /**
   * AbortSignal to cancel the compression operation.
   */
  signal?: AbortSignal;

  /**
   * Called periodically with progress updates.
   */
  onProgress?: (progress: CompressionProgressEvent) => void;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/** Processing stage identifiers. */
export type CompressionStage =
  | 'analyzing'
  | 'decoding'
  | 'resizing'
  | 'encoding'
  | 'optimizing'
  | 'finalizing'
  | 'completed';

/** Progress event emitted during compression. */
export interface CompressionProgressEvent {
  /** Current progress percentage, 0–100 (never exceeds 100). */
  percent: number;
  /** Current processing stage. */
  stage: CompressionStage;
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

/** Warning codes that may appear in `CompressionResult.warnings`. */
export type CompressionWarningCode =
  | 'TARGET_SIZE_NOT_REACHED'
  | 'TRANSPARENCY_LOST'
  | 'ANIMATION_NOT_SUPPORTED'
  | 'ENCODER_FALLBACK'
  | 'QUALITY_CLAMPED'
  | 'DIMENSION_REDUCED'
  | 'FORMAT_CONVERTED';

/** A non-fatal warning attached to a compression result. */
export interface CompressionWarning {
  code: CompressionWarningCode;
  message: string;
}

// ---------------------------------------------------------------------------
// Image Analysis
// ---------------------------------------------------------------------------

/** Detailed analysis of an input image before compression. */
export interface ImageAnalysis {
  /** Detected image format (from magic bytes, not file extension). */
  format: ImageFormat;
  /** MIME type string. */
  mimeType: ImageMimeType;
  /** File size in bytes. */
  fileSize: number;
  /** Image width in pixels. */
  width: number;
  /** Image height in pixels. */
  height: number;
  /** Width / Height ratio. */
  aspectRatio: number;
  /** Whether the image has any transparent pixels. */
  hasAlpha: boolean;
  /** Whether the image contains animation frames. */
  animated: boolean;
  /** Number of frames (present for animated images). */
  frameCount?: number;
}

// ---------------------------------------------------------------------------
// Compression Result
// ---------------------------------------------------------------------------

/** Statistics for the original and output images. */
export interface ImageStats {
  /** File size in bytes. */
  size: number;
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
  /** Image format. */
  format: ImageFormat;
}

/** Compression delta statistics. */
export interface CompressionStats {
  /** Percentage compressed (0–100). */
  ratio: number;
  /** Bytes removed. */
  savedBytes: number;
  /** Percentage of original size that was removed. */
  savedPercentage: number;
}

/** The result returned by `compressImage()`. */
export interface CompressionResult {
  /** The compressed image as a Blob. */
  blob: Blob;
  /** Stats for the original input image. */
  original: ImageStats;
  /** Stats for the compressed output image. */
  output: ImageStats;
  /** Compression delta metrics. */
  compression: CompressionStats;
  /** Total processing time in milliseconds. */
  processingTime: number;
  /** Whether the target size (if specified) was achieved. */
  achievedTarget?: boolean;
  /** Non-fatal warnings generated during processing. */
  warnings: CompressionWarning[];
}

// ---------------------------------------------------------------------------
// Browser Capabilities
// ---------------------------------------------------------------------------

/** Browser format support for decoding and encoding. */
export interface FormatCapabilities {
  jpeg: boolean;
  png: boolean;
  webp: boolean;
  avif: boolean;
}

/** Full browser capabilities as detected at runtime. */
export interface BrowserCapabilities {
  /** Web Workers are available. */
  webWorker: boolean;
  /** WebAssembly is available. */
  wasm: boolean;
  /** OffscreenCanvas is available. */
  offscreenCanvas: boolean;
  /** createImageBitmap is available. */
  createImageBitmap: boolean;
  /** WebCodecs API is available. */
  webCodecs: boolean;
  /** Format-specific decode capabilities (browser can display/decode). */
  decode: FormatCapabilities;
  /** Format-specific encode capabilities (browser can encode via canvas). */
  encode: FormatCapabilities;
}

// ---------------------------------------------------------------------------
// Internal re-exports for strategy/encoder layers
// ---------------------------------------------------------------------------

/**
 * Normalized encode options passed through the pipeline.
 * This is internal but typed to prevent `any` leakage.
 */
export interface NormalizedCompressOptions {
  outputFormat: ImageFormat;
  qualityMin: number;
  qualityMax: number;
  targetSizeBytes: number | null;
  maxFileSizeBytes: number | null;
  maxWidth: number | null;
  maxHeight: number | null;
  preserveAspectRatio: boolean;
  preserveMetadata: boolean;
  transparency: TransparencyPolicy;
  transparencyBackground: [number, number, number];
  maxPixels: number;
  auto: boolean;
}
