# Changelog

All notable changes to `@imgcompress/engine` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-08-21

### Added

- `compressImage(file, options)` — primary public API
- `analyzeImage(file)` — image analysis without compression
- `getCapabilities()` — browser capability detection
- **Format support**: JPEG, PNG, WebP, AVIF (input and output)
- **Magic-byte format detection** — never trusts file extensions alone
- **WASM encoders** via `@jsquash/jpeg`, `@jsquash/png`, `@jsquash/oxipng`, `@jsquash/webp`, `@jsquash/avif`
- **Lazy codec loading** — only loads WASM for the formats actually used
- **Target-size optimization** — binary search over quality + dimension reduction fallback
- **Max file size enforcement** — binary search to stay under a size limit
- **High-quality resize** via Pica (Lanczos3)
- **Web Worker processing** — runs compression off the main thread
- **Main-thread fallback** — works when Workers are unavailable
- **Progress reporting** via `onProgress` callback with stage labels
- **AbortSignal cancellation** — propagates to worker and optimizer loop
- **Transparency policy** — `"error"` (default), `"flatten"`, `"allow-loss"` for PNG/WebP/AVIF → JPEG
- **Memory safety** — `maxPixels` limit enforced before decode (default: 40 MP)
- **Typed error hierarchy** — `ImageCompressionError` with `code` enum
- **Animation detection** — detects APNG, animated WebP, AVIF sequences; warns instead of silently destroying frames
- **Browser capability detection** — separately detects decode and encode capabilities per format
- **Format-specific strategies** — separate optimizer for JPEG, PNG (lossless), WebP, AVIF
- **Full TypeScript strict mode** — no `any`
- **ESM + CJS dual output**
- **Tree-shaking friendly** — `"sideEffects": false`

### Architecture

- `Analyzer` → `Pipeline` → `Optimizer` → `Strategy` → `EncoderManager` → `Worker` → `Result`
- `MetadataManager` stub for future EXIF/ICC support
- `ColorManager` stub for future wide-gamut/ICC profile handling
- `ResizeEngine` interface for swappable resize backends (current: `PicaAdapter`)
