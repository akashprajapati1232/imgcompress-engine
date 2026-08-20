/**
 * @fileoverview Typed Worker communication protocol.
 *
 * All messages between the main thread and the compression worker
 * are fully typed here. Using discriminated unions prevents protocol drift.
 *
 * Transferable objects (ArrayBuffer) are used to avoid copying large data
 * across the thread boundary.
 */

import type { CompressOptions, CompressionResult, ImageAnalysis } from '../types/index.js';

// In worker context, self is DedicatedWorkerGlobalScope not Window.
// Declaring it here ensures TypeScript picks the correct postMessage overload.
interface DedicatedWorkerGlobalScope {
  postMessage(message: any, transfer?: Transferable[]): void;
  onmessage: ((this: DedicatedWorkerGlobalScope, ev: MessageEvent) => any) | null;
}
declare const self: DedicatedWorkerGlobalScope;

// ---------------------------------------------------------------------------
// Request types (main thread → worker)
// ---------------------------------------------------------------------------

export interface AnalyzeRequest {
  type: 'analyze';
  id: string;
  buffer: ArrayBuffer;   // Transferable — original image bytes
  fileName: string;
  fileType: string;
}

export interface CompressRequest {
  type: 'compress';
  id: string;
  buffer: ArrayBuffer;   // Transferable — original image bytes
  fileName: string;
  fileType: string;
  fileSize: number;
  options: Omit<CompressOptions, 'signal' | 'onProgress'>; // Cannot transfer these
}

export interface CancelRequest {
  type: 'cancel';
  id: string;
}

export type WorkerRequest =
  | AnalyzeRequest
  | CompressRequest
  | CancelRequest;

// ---------------------------------------------------------------------------
// Response types (worker → main thread)
// ---------------------------------------------------------------------------

export interface ProgressResponse {
  type: 'progress';
  id: string;
  percent: number;
  stage: string;
}

export interface AnalyzeSuccessResponse {
  type: 'analyze-success';
  id: string;
  analysis: ImageAnalysis;
}

export interface CompressSuccessResponse {
  type: 'compress-success';
  id: string;
  resultBuffer: ArrayBuffer;   // Transferable — compressed image bytes
  result: Omit<CompressionResult, 'blob'>; // blob is reconstructed from buffer on main thread
}

export interface ErrorResponse {
  type: 'error';
  id: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type WorkerResponse =
  | ProgressResponse
  | AnalyzeSuccessResponse
  | CompressSuccessResponse
  | ErrorResponse;

// ---------------------------------------------------------------------------
// Helper to post typed messages
// ---------------------------------------------------------------------------

/** Post a typed response from the worker. */
export function postWorkerResponse(
  response: WorkerResponse,
  transfer: Transferable[] = [],
): void {
  if (transfer.length > 0) {
    self.postMessage(response, transfer);
  } else {
    self.postMessage(response);
  }
}
