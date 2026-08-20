/**
 * @fileoverview Tests for animation detection.
 */

import { describe, it, expect } from 'vitest';
import { detectAnimation } from '../src/analysis/animation.js';
import { PNG_1x1, WEBP_1x1, bufferToBlob } from './helpers/fixtures.js';

// ── APNG fixture with acTL chunk ───────────────────────────────────────────

function makeApngBuffer(): ArrayBuffer {
  // Embed an acTL chunk (animation control) after the PNG IHDR
  const pngSig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // acTL chunk: 4 bytes length + "acTL" + 4 bytes num_frames + 4 bytes num_plays + CRC
  const acTL = new Uint8Array([
    0x00, 0x00, 0x00, 0x08, // length = 8
    0x61, 0x63, 0x54, 0x4c, // "acTL"
    0x00, 0x00, 0x00, 0x03, // num_frames = 3
    0x00, 0x00, 0x00, 0x00, // num_plays = 0 (infinite)
    0x00, 0x00, 0x00, 0x00, // CRC (simplified — won't validate in test)
  ]);

  const combined = new Uint8Array(pngSig.length + acTL.length);
  combined.set(pngSig, 0);
  combined.set(acTL, pngSig.length);
  return combined.buffer;
}

// ── Animated WebP fixture ──────────────────────────────────────────────────

function makeAnimatedWebPBuffer(): ArrayBuffer {
  // Minimal RIFF container with ANIM chunk marker
  const buf = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x30, 0x00, 0x00, 0x00, // file size
    0x57, 0x45, 0x42, 0x50, // "WEBP"
    0x56, 0x50, 0x38, 0x58, // "VP8X" extended format
    0x0a, 0x00, 0x00, 0x00, // chunk size
    0x02, 0x00, 0x00, 0x00, // flags (animation bit)
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x41, 0x4e, 0x49, 0x4d, // "ANIM" — animation global parameters
    0x06, 0x00, 0x00, 0x00,
    0xff, 0xff, 0xff, 0x00, 0x01, 0x00,
  ]);
  return buf.buffer;
}

// ── AVIF sequence fixture ─────────────────────────────────────────────────

function makeAvifSequenceBuffer(): ArrayBuffer {
  // ftyp box with "avis" major brand
  const buf = new Uint8Array([
    0x00, 0x00, 0x00, 0x18, // box size
    0x66, 0x74, 0x79, 0x70, // "ftyp"
    0x61, 0x76, 0x69, 0x73, // major brand "avis" (sequence)
    0x00, 0x00, 0x00, 0x00, // minor version
    0x61, 0x76, 0x69, 0x66, // compatible "avif"
    0x6d, 0x69, 0x66, 0x31, // compatible "mif1"
  ]);
  return buf.buffer;
}

describe('detectAnimation', () => {
  it('returns animated=false for a static PNG', async () => {
    const blob = bufferToBlob(PNG_1x1, 'image/png');
    const result = await detectAnimation(blob, 'png');
    expect(result.animated).toBe(false);
  });

  it('returns animated=true for APNG (acTL chunk)', async () => {
    const blob = bufferToBlob(makeApngBuffer(), 'image/png');
    const result = await detectAnimation(blob, 'png');
    expect(result.animated).toBe(true);
    expect(result.frameCount).toBe(3);
  });

  it('returns animated=false for a static WebP', async () => {
    const blob = bufferToBlob(WEBP_1x1, 'image/webp');
    const result = await detectAnimation(blob, 'webp');
    expect(result.animated).toBe(false);
  });

  it('returns animated=true for animated WebP (ANIM chunk)', async () => {
    const blob = bufferToBlob(makeAnimatedWebPBuffer(), 'image/webp');
    const result = await detectAnimation(blob, 'webp');
    expect(result.animated).toBe(true);
  });

  it('returns animated=true for AVIF sequence (avis brand)', async () => {
    const blob = bufferToBlob(makeAvifSequenceBuffer(), 'image/avif');
    const result = await detectAnimation(blob, 'avif');
    expect(result.animated).toBe(true);
  });

  it('returns animated=false for JPEG (cannot be animated)', async () => {
    const result = await detectAnimation(new Blob([new Uint8Array([0xff, 0xd8])]), 'jpeg');
    expect(result.animated).toBe(false);
  });
});
