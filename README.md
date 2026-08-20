# @imgcompress/engine

[![npm](https://img.shields.io/npm/v/@imgcompress/engine.svg)](https://www.npmjs.com/package/@imgcompress/engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Browser Only](https://img.shields.io/badge/runtime-browser--only-green.svg)](#browser-compatibility)

> **Production-grade, browser-side image compression engine.**  
> Powered by WASM codecs (MozJPEG, libwebp, libavif, Oxipng), high-quality Pica resize, Web Workers, and an intelligent target-size binary-search optimizer.

No server. No uploads. Everything runs locally in the browser.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Supported Formats](#supported-formats)
- [API Reference](#api-reference)
  - [compressImage()](#compressimage)
  - [analyzeImage()](#analyzeimage)
  - [getCapabilities()](#getcapabilities)
- [Compression Options](#compression-options)
- [Target-Size Examples](#target-size-examples)
- [Resize Examples](#resize-examples)
- [Progress Reporting](#progress-reporting)
- [Cancellation](#cancellation)
- [Transparency Handling](#transparency-handling)
- [Error Handling](#error-handling)
- [Browser Compatibility](#browser-compatibility)
- [Bundler Configuration](#bundler-configuration)
- [Performance Considerations](#performance-considerations)
- [Memory Limitations](#memory-limitations)
- [Architecture Overview](#architecture-overview)
- [Target-Size Algorithm](#target-size-algorithm)
- [WASM Asset Handling](#wasm-asset-handling)
- [Worker Architecture](#worker-architecture)

---

## Installation

```bash
npm install @imgcompress/engine
```

---

## Quick Start

```ts
import { compressImage, analyzeImage, getCapabilities } from '@imgcompress/engine';

// Simple compression (same format, auto quality)
const result = await compressImage(file);
const url = URL.createObjectURL(result.blob);

// Analyze first
const analysis = await analyzeImage(file);
console.log(analysis.format, analysis.width, analysis.height, analysis.hasAlpha);

// Check browser capabilities
const caps = await getCapabilities();
console.log(caps.wasm, caps.decode.avif, caps.encode.webp);
```

---

## Supported Formats

| Format | Input | Output | Notes |
|--------|-------|--------|-------|
| JPEG   | ✅    | ✅     | MozJPEG WASM — progressive, optimal Huffman |
| PNG    | ✅    | ✅     | Lossless via Oxipng optimizer |
| WebP   | ✅    | ✅     | Lossy + lossless modes |
| AVIF   | ✅    | ✅     | Capability-gated; falls back if unavailable |

> **Format detection is magic-byte based.** File extensions and MIME types are never trusted as the sole source of truth.

---

## API Reference

### `compressImage()`

```ts
function compressImage(
  file: File | Blob,
  options?: CompressOptions
): Promise<CompressionResult>
```

Compress an image. Runs in a Web Worker when available.

```ts
interface CompressionResult {
  blob: Blob;
  original: { size: number; width: number; height: number; format: ImageFormat };
  output:   { size: number; width: number; height: number; format: ImageFormat };
  compression: { ratio: number; savedBytes: number; savedPercentage: number };
  processingTime: number;
  achievedTarget?: boolean;
  warnings: CompressionWarning[];
}
```

---

### `analyzeImage()`

```ts
function analyzeImage(file: File | Blob): Promise<ImageAnalysis>
```

Analyze an image without compressing it. Reads only the file header and a canvas sample — does not fully decode into memory.

```ts
interface ImageAnalysis {
  format: 'jpeg' | 'png' | 'webp' | 'avif';
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  aspectRatio: number;
  hasAlpha: boolean;
  animated: boolean;
  frameCount?: number;
}
```

---

### `getCapabilities()`

```ts
function getCapabilities(): Promise<BrowserCapabilities>
```

Detect what the current browser can do. Results are cached after the first call.

```ts
interface BrowserCapabilities {
  webWorker: boolean;
  wasm: boolean;
  offscreenCanvas: boolean;
  createImageBitmap: boolean;
  webCodecs: boolean;
  decode: { jpeg: boolean; png: boolean; webp: boolean; avif: boolean };
  encode: { jpeg: boolean; png: boolean; webp: boolean; avif: boolean };
}
```

> **Important:** `decode` and `encode` are separate capabilities.  
> A browser can display AVIF (decode) without supporting Canvas AVIF encoding.

---

## Compression Options

```ts
interface CompressOptions {
  // Mode selection
  auto?: boolean;                        // Auto-select all parameters
  quality?: number | { min: number; max: number }; // Fixed or range [0, 1]

  // Size constraints
  targetSize?: SizeInput;                // "100KB" | "2MB" | 102400
  maxFileSize?: SizeInput;               // Maximum output size

  // Format
  outputFormat?: 'jpeg' | 'png' | 'webp' | 'avif'; // Default: same as input

  // Dimensions
  maxWidth?: number;
  maxHeight?: number;
  maxDimension?: number;
  preserveAspectRatio?: boolean;         // Default: true

  // Metadata
  preserveMetadata?: boolean;            // Default: false (strip)

  // Transparency (for transparent → JPEG conversion)
  transparency?: 'error' | 'flatten' | 'allow-loss'; // Default: "error"
  transparencyBackground?: string | [number, number, number]; // Default: "#ffffff"

  // Safety
  maxPixels?: number;                    // Default: 40_000_000

  // Control
  signal?: AbortSignal;
  onProgress?: (progress: CompressionProgressEvent) => void;
}

// SizeInput accepts:
type SizeInput = number | `${number}KB` | `${number}MB`;
```

---

## Target-Size Examples

```ts
// Compress to approximately 100 KB
const result = await compressImage(file, {
  targetSize: '100KB',
});
console.log(result.achievedTarget); // true if within 5% of target
console.log(result.output.size);    // actual output size in bytes

// Target size with format conversion
const result = await compressImage(file, {
  targetSize: '200KB',
  outputFormat: 'webp',
  quality: { min: 0.45, max: 0.92 },
});

// Maximum file size (do not exceed)
const result = await compressImage(file, {
  maxFileSize: '500KB',
});
```

If the target cannot be achieved even at minimum quality and after dimension reduction, the engine returns `achievedTarget: false` with a `TARGET_SIZE_NOT_REACHED` warning. It **never pretends to have achieved the target**.

---

## Resize Examples

```ts
// Limit to 1920px on longest side
const result = await compressImage(file, {
  maxWidth: 1920,
  maxHeight: 1920,
});

// Constrain to max dimension
const result = await compressImage(file, {
  maxDimension: 3000,
});

// Resize + target size
const result = await compressImage(file, {
  maxWidth: 1920,
  targetSize: '500KB',
  outputFormat: 'webp',
});
```

> Resize uses **Pica with Lanczos3 filter** for maximum quality. Images are **never upscaled** by default.

---

## Progress Reporting

```ts
const result = await compressImage(file, {
  targetSize: '100KB',
  onProgress(progress) {
    console.log(`${progress.stage}: ${progress.percent}%`);
    // analyzing: 10%
    // decoding: 25%
    // encoding: 65%
    // optimizing: 85%
    // completed: 100%
  },
});
```

Progress stages:
- `analyzing` (0–10%)
- `decoding` (10–25%)
- `resizing` (25–40%) — only if resizing
- `encoding` (40–72%)
- `optimizing` (72–91%) — only if target/max size set
- `finalizing` (91–100%)
- `completed` (100%)

Progress is always between 0 and 100, never exceeds 100.

---

## Cancellation

```ts
const controller = new AbortController();

// Start compression
const compressionPromise = compressImage(file, {
  targetSize: '100KB',
  signal: controller.signal,
  onProgress: (p) => console.log(p.percent),
});

// Cancel after 1 second
setTimeout(() => controller.abort(), 1000);

try {
  const result = await compressionPromise;
} catch (err) {
  if (err instanceof ImageCompressionError && err.code === 'OPERATION_CANCELLED') {
    console.log('Compression was cancelled');
  }
}
```

Cancellation propagates through the Worker, optimizer loop, decode, resize, and encode stages.

---

## Transparency Handling

JPEG does not support alpha transparency. When converting a transparent image to JPEG:

```ts
// Default: throw an error
const result = await compressImage(transparentPng, {
  outputFormat: 'jpeg',
  // transparency: 'error' — default
});
// Throws: ImageCompressionError { code: 'TRANSPARENCY_NOT_SUPPORTED' }

// Flatten on white background
const result = await compressImage(transparentPng, {
  outputFormat: 'jpeg',
  transparency: 'flatten',
  transparencyBackground: '#ffffff',
});

// Silently discard alpha (not recommended)
const result = await compressImage(transparentPng, {
  outputFormat: 'jpeg',
  transparency: 'allow-loss',
});
```

WebP, AVIF, and PNG fully support transparency.

---

## Error Handling

All errors are instances of `ImageCompressionError` with a typed `code` property:

```ts
import { compressImage, ImageCompressionError } from '@imgcompress/engine';

try {
  const result = await compressImage(file);
} catch (err) {
  if (err instanceof ImageCompressionError) {
    switch (err.code) {
      case 'UNSUPPORTED_FORMAT':
        // GIF, BMP, HEIC, etc.
        break;
      case 'PIXEL_LIMIT_EXCEEDED':
        // Image is too large; pass maxPixels option to override
        break;
      case 'TRANSPARENCY_NOT_SUPPORTED':
        // Transparent image → JPEG with transparency: "error"
        break;
      case 'OPERATION_CANCELLED':
        // AbortController.abort() was called
        break;
      case 'TARGET_SIZE_NOT_REACHED':
        // Impossible target — check result.warnings
        break;
      case 'ENCODER_UNAVAILABLE':
        // WASM unavailable and no native fallback
        break;
      default:
        console.error(err.code, err.message, err.details);
    }
  }
}
```

All error codes:

| Code | Meaning |
|------|---------|
| `UNSUPPORTED_FORMAT` | Input format not supported (GIF, BMP, HEIC, etc.) |
| `INVALID_IMAGE` | Input is not a valid File/Blob |
| `CORRUPTED_IMAGE` | Image data cannot be decoded |
| `PIXEL_LIMIT_EXCEEDED` | Image exceeds `maxPixels` limit |
| `TRANSPARENCY_NOT_SUPPORTED` | Transparent → JPEG with `transparency: "error"` |
| `OPERATION_CANCELLED` | AbortController cancelled the operation |
| `ENCODER_UNAVAILABLE` | No encoder available for format |
| `COMPRESSION_FAILED` | Internal encode error |
| `RESIZE_FAILED` | Pica resize error |
| `DECODE_FAILED` | WASM decode error |
| `WORKER_UNAVAILABLE` | Worker failed to spawn |
| `MEMORY_LIMIT_EXCEEDED` | Memory limit reached |
| `INVALID_OPTIONS` | Invalid option values |
| `BROWSER_CAPABILITY_UNAVAILABLE` | Required browser API not available |

---

## Browser Compatibility

| Browser | Min Version | Notes |
|---------|-------------|-------|
| Chrome  | 90+         | Full support including AVIF |
| Edge    | 90+         | Full support |
| Firefox | 88+         | Full support; AVIF in FF93+ |
| Safari  | 15+         | Limited AVIF encoding; WASM fallback |

The engine uses feature detection at runtime. It never assumes a capability without checking first.

Features degrade gracefully:
- No WASM → Native Canvas encoder (with `ENCODER_FALLBACK` warning)
- No Worker → Main-thread processing (with `ENCODER_FALLBACK` warning)  
- No AVIF encode → Error or fallback to native Canvas

---

## Bundler Configuration

### Vite

```ts
// vite.config.ts
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  optimizeDeps: {
    exclude: ['@jsquash/jpeg', '@jsquash/png', '@jsquash/webp', '@jsquash/avif', '@jsquash/oxipng'],
  },
});
```

### Webpack 5

```js
// webpack.config.js
module.exports = {
  experiments: {
    asyncWebAssembly: true,
  },
};
```

### Next.js

```js
// next.config.js
module.exports = {
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};
```

---

## Performance Considerations

- **Web Worker**: All compression runs in a Worker by default — the main thread is never blocked.
- **Lazy WASM loading**: Only the codec for the format being used is loaded. If you compress JPEG, the AVIF and PNG WASM are never initialized.
- **Transferable buffers**: Image data is transferred (not copied) between main thread and worker via `ArrayBuffer` transfer.
- **Pica workers**: Pica uses its own internal WebWorkers for high-quality resize.
- **Large images**: For images with many megapixels, processing time is dominated by the WASM encode step. Use `maxPixels` to limit input size.

---

## Memory Limitations

Raw decoded image data consumes significantly more RAM than the compressed file:

```
8000 × 6000 × 4 bytes = 192 MB RAM
```

The default `maxPixels` limit (40 megapixels) exists to prevent OOM crashes:

```ts
// Override the pixel limit (use carefully)
const result = await compressImage(file, {
  maxPixels: 80_000_000, // 80 MP — requires sufficient browser RAM
});
```

The `MemoryManager` tracks and releases ImageData allocations after each pipeline stage. All buffers are explicitly released after the pipeline completes.

---

## Architecture Overview

```
compressImage()
     │
     ├─ Worker available? ──→ Compression Worker
     │                              │
     └─ Main thread fallback        │
                │                   │
                └──────────────────→┤
                                    │
                              Compressor
                                    │
                              analyzeImage()
                                    │
                               Pipeline
                                    │
                    ┌───────────────┼────────────────┐
                    │               │                │
                  Decode         Resize           Optimize
                    │               │                │
              EncoderManager   PicaAdapter       Optimizer
                    │                           (binary search)
              ┌─────┴─────┐          │
           WasmEncoder  NativeEncoder  │
                    │          │      │
              @jsquash/*   Canvas    Strategy
                               ↓
                          JPEG / PNG / WebP / AVIF
```

**Subsystems:**
- `Analyzer` — format detection, dimensions, alpha, animation
- `MemoryManager` — pixel limits, buffer tracking
- `Pipeline` — stage orchestration, progress, cancellation
- `Optimizer` — binary search quality + dimension reduction
- `Strategy` — format-specific encoder configuration
- `EncoderManager` — WASM → native → fallback selection
- `ResizeEngine` / `PicaAdapter` — high-quality Lanczos3 resize
- `MetadataManager` — EXIF/ICC policy (strip by default)
- `ColorManager` — color space hook (passthrough in V1)
- `BrowserCapabilities` — runtime feature detection

---

## Target-Size Algorithm

When `targetSize` is specified, the optimizer runs a **binary search** over quality:

```
1. Parse target to bytes (e.g., "100KB" → 102400)
2. Initial probe at qualityMax (e.g., 0.92)
3. Binary search:
   a. mid = (lo + hi) / 2
   b. Encode at quality=mid
   c. Measure output bytes
   d. If size > target: hi = mid  (lower quality)
      If size < target: lo = mid  (higher quality)
   e. Stop if |size - target| / target < 5%, or hi-lo < 0.005
4. Max iterations: 12 (configurable)
5. If quality hits qualityMin AND still > target:
   a. Try dimension scales: 0.75×, 0.5×, 0.35×, 0.25×
   b. Resize + re-run binary search
6. Return best result found, with TARGET_SIZE_NOT_REACHED warning if applicable
```

For **PNG** (lossless), the optimizer tries Oxipng levels 6→1, then falls back to dimension reduction.

---

## WASM Asset Handling

Each `@jsquash/*` package bundles its own `.wasm` file. When using Vite with `vite-plugin-wasm`, WASM files are automatically handled.

WASM modules are **lazily loaded** — the JPEG WASM is only loaded when compressing a JPEG. If you only use WebP, the JPEG/PNG/AVIF WASM files are never downloaded or initialized.

This is important for bundle size and initial page load performance.

---

## Worker Architecture

The compression worker runs the **full pipeline** off the main thread:

```
Main Thread                  Compression Worker
     │                              │
     │ postMessage(CompressRequest) │
     │ [Transferable ArrayBuffer]   │
     │────────────────────────────→│
     │                              │ analyze()
     │                              │ decode()
     │◄────────────────────────────│ postMessage(progress)
     │                              │ resize()
     │◄────────────────────────────│ postMessage(progress)
     │                              │ encode()
     │◄────────────────────────────│ postMessage(progress)
     │                              │ optimize()
     │◄────────────────────────────│ postMessage(progress)
     │                              │
     │◄────────────────────────────│ postMessage(CompressSuccessResponse)
     │ [Transferable resultBuffer]  │
```

The result buffer is transferred (zero-copy) back to the main thread. The worker is terminated after each operation.

To cancel: the main thread sends a `CancelRequest` which calls `AbortController.abort()` inside the worker.
