/**
 * @fileoverview Animation detection for APNG, Animated WebP, and AVIF sequences.
 *
 * We scan the raw binary data of the file for animation-specific markers
 * without decoding the full image. This is intentionally lightweight.
 *
 * Animation processing is NOT supported in V1, but detection is required
 * so the engine can warn the caller rather than silently destroying frames.
 */

export interface AnimationInfo {
  animated: boolean;
  frameCount?: number;
}

/**
 * Detect whether an image file contains animation.
 *
 * @param file The image file/blob to scan.
 * @param format The pre-detected image format.
 */
export async function detectAnimation(
  file: File | Blob,
  format: string,
): Promise<AnimationInfo> {
  switch (format) {
    case 'png':
      return detectApng(file);
    case 'webp':
      return detectAnimatedWebP(file);
    case 'avif':
      return detectAnimatedAvif(file);
    default:
      return { animated: false };
  }
}

// ---------------------------------------------------------------------------
// APNG — look for the acTL (animation control) chunk
// ---------------------------------------------------------------------------

const APNG_ACTL = new Uint8Array([0x61, 0x63, 0x54, 0x4c]); // "acTL"

async function detectApng(file: File | Blob): Promise<AnimationInfo> {
  // acTL chunk contains num_frames in bytes 8–11 of the chunk data
  // We scan the first 32 KB for efficiency
  const slice = file.slice(0, 32768);
  const buffer = await slice.arrayBuffer();
  const data = new Uint8Array(buffer);

  for (let i = 8; i < data.length - 12; i++) {
    if (
      data[i] === APNG_ACTL[0] &&
      data[i + 1] === APNG_ACTL[1] &&
      data[i + 2] === APNG_ACTL[2] &&
      data[i + 3] === APNG_ACTL[3]
    ) {
      // num_frames is 4 bytes big-endian immediately after the chunk type
      const numFrames =
        ((data[i + 4] ?? 0) << 24) |
        ((data[i + 5] ?? 0) << 16) |
        ((data[i + 6] ?? 0) << 8) |
        (data[i + 7] ?? 0);
      return { animated: numFrames > 1, frameCount: numFrames };
    }
  }

  return { animated: false };
}

// ---------------------------------------------------------------------------
// Animated WebP — look for the ANIM chunk in the RIFF container
// ---------------------------------------------------------------------------

const WEBP_ANIM = new Uint8Array([0x41, 0x4e, 0x49, 0x4d]); // "ANIM"

async function detectAnimatedWebP(file: File | Blob): Promise<AnimationInfo> {
  const slice = file.slice(0, 64);
  const buffer = await slice.arrayBuffer();
  const data = new Uint8Array(buffer);

  for (let i = 12; i < data.length - 4; i++) {
    if (
      data[i] === WEBP_ANIM[0] &&
      data[i + 1] === WEBP_ANIM[1] &&
      data[i + 2] === WEBP_ANIM[2] &&
      data[i + 3] === WEBP_ANIM[3]
    ) {
      return { animated: true };
    }
  }

  return { animated: false };
}

// ---------------------------------------------------------------------------
// Animated AVIF — check for sequence brand "avis" in ftyp compatible brands
// ---------------------------------------------------------------------------

const AVIS = new Uint8Array([0x61, 0x76, 0x69, 0x73]); // "avis"

async function detectAnimatedAvif(file: File | Blob): Promise<AnimationInfo> {
  const slice = file.slice(0, 64);
  const buffer = await slice.arrayBuffer();
  const data = new Uint8Array(buffer);

  // Compatible brands start at offset 16
  for (let i = 8; i < Math.min(data.length - 4, 64); i += 4) {
    if (
      data[i] === AVIS[0] &&
      data[i + 1] === AVIS[1] &&
      data[i + 2] === AVIS[2] &&
      data[i + 3] === AVIS[3]
    ) {
      return { animated: true };
    }
  }

  return { animated: false };
}
