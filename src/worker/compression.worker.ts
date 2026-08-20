/**
 * @fileoverview Compression Web Worker.
 *
 * This worker receives CompressRequest and AnalyzeRequest messages,
 * runs the full compression pipeline off the main thread, and posts
 * progress + result messages back.
 *
 * Cancellation: each request ID maps to an AbortController. A CancelRequest
 * for that ID triggers abort(), which propagates through the pipeline.
 *
 * Note: This file must be compiled to a self-contained worker script.
 * The main thread creates it via a Blob URL to avoid bundler worker
 * configuration requirements for NPM consumers.
 */

// Tell TypeScript this is a DedicatedWorkerGlobalScope so it picks the
// correct postMessage overload (not Window.postMessage with targetOrigin).
interface DedicatedWorkerGlobalScope {
  postMessage(message: any, transfer?: Transferable[]): void;
  onmessage: ((this: DedicatedWorkerGlobalScope, ev: MessageEvent) => any) | null;
}
declare const self: DedicatedWorkerGlobalScope;

import type { WorkerRequest, WorkerResponse } from './protocol.js';
import { postWorkerResponse } from './protocol.js';
import { analyzeImageFile } from '../analysis/ImageAnalyzer.js';
import { runCompressor } from '../core/Compressor.js';
import { ImageCompressionError } from '../errors/ImageCompressionError.js';

// Active AbortControllers by request ID
const controllers = new Map<string, AbortController>();

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  switch (request.type) {
    case 'analyze':
      await handleAnalyze(request);
      break;

    case 'compress':
      await handleCompress(request);
      break;

    case 'cancel': {
      const controller = controllers.get(request.id);
      if (controller) {
        controller.abort();
        controllers.delete(request.id);
      }
      break;
    }
  }
};

// ---------------------------------------------------------------------------
// Analyze handler
// ---------------------------------------------------------------------------

async function handleAnalyze(
  request: Extract<WorkerRequest, { type: 'analyze' }>,
): Promise<void> {
  const { id, buffer, fileName, fileType } = request;

  try {
    const file = new File([buffer], fileName, { type: fileType });
    const analysis = await analyzeImageFile(file);

    const response: WorkerResponse = {
      type: 'analyze-success',
      id,
      analysis,
    };
    postWorkerResponse(response);
  } catch (err) {
    postErrorResponse(id, err);
  }
}

// ---------------------------------------------------------------------------
// Compress handler
// ---------------------------------------------------------------------------

async function handleCompress(
  request: Extract<WorkerRequest, { type: 'compress' }>,
): Promise<void> {
  const { id, buffer, fileName, fileType, options } = request;

  const controller = new AbortController();
  controllers.set(id, controller);

  try {
    const file = new File([buffer], fileName, { type: fileType });

    const result = await runCompressor(file, {
      ...options,
      signal: controller.signal,
      onProgress: (progress) => {
        const progressResponse: WorkerResponse = {
          type: 'progress',
          id,
          percent: progress.percent,
          stage: progress.stage,
        };
        self.postMessage(progressResponse);
      },
    });

    // Transfer the compressed buffer (zero-copy)
    const resultBuffer = await result.blob.arrayBuffer();

    const response: WorkerResponse = {
      type: 'compress-success',
      id,
      resultBuffer,
      result: {
        original: result.original,
        output: result.output,
        compression: result.compression,
        processingTime: result.processingTime,
        achievedTarget: result.achievedTarget ?? false,
        warnings: result.warnings,
      },
    };

    // Transfer resultBuffer to avoid copying large pixel data
    self.postMessage(response, [resultBuffer] as Transferable[]);
  } catch (err) {
    postErrorResponse(id, err);
  } finally {
    controllers.delete(id);
  }
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function postErrorResponse(id: string, err: unknown): void {
  const response: WorkerResponse = {
    type: 'error',
    id,
    code:
      err instanceof ImageCompressionError
        ? err.code
        : 'COMPRESSION_FAILED',
    message:
      err instanceof Error ? err.message : String(err),
    details:
      err instanceof ImageCompressionError
        ? err.details
        : undefined,
  };
  postWorkerResponse(response);
}
