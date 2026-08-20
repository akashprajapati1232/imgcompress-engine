/**
 * Vitest global test setup.
 * Shims browser APIs for jsdom environment.
 */

// jsdom does not include createImageBitmap — stub it
if (typeof globalThis.createImageBitmap === 'undefined') {
  globalThis.createImageBitmap = async (
    source: ImageBitmapSource,
  ): Promise<ImageBitmap> => {
    // Minimal stub that returns a 1×1 ImageBitmap-like object
    return {
      width: 1,
      height: 1,
      close: () => {},
    } as unknown as ImageBitmap;
  };
}

// jsdom does not have OffscreenCanvas — stub it
if (typeof globalThis.OffscreenCanvas === 'undefined') {
  class OffscreenCanvasStub {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext(_type: string) {
      return {
        putImageData: () => {},
        drawImage: () => {},
        getImageData: (x: number, y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4).fill(255),
          width: w,
          height: h,
        }),
        convertToBlob: async () => new Blob([new Uint8Array(100)], { type: 'image/png' }),
      };
    }
    convertToBlob = async () => new Blob([new Uint8Array(100)], { type: 'image/png' });
    close = () => {};
  }
  (globalThis as Record<string, unknown>)['OffscreenCanvas'] = OffscreenCanvasStub;
}

// Stub Worker
if (typeof globalThis.Worker === 'undefined') {
  (globalThis as Record<string, unknown>)['Worker'] = class {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: ErrorEvent) => void) | null = null;
    postMessage() {}
    terminate() {}
  };
}

// Stub WebAssembly (jsdom may not have it)
if (typeof globalThis.WebAssembly === 'undefined') {
  (globalThis as Record<string, unknown>)['WebAssembly'] = {
    instantiate: async () => ({ instance: {}, module: {} }),
    compile: async () => ({}),
  };
}

// Stub ImageData
if (typeof globalThis.ImageData === 'undefined') {
  class ImageDataStub {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(width: number, height: number);
    constructor(data: Uint8ClampedArray, width: number, height?: number);
    constructor(arg1: any, arg2: any, arg3?: any) {
      if (arg1 instanceof Uint8ClampedArray) {
        this.data = arg1;
        this.width = arg2;
        this.height = arg3 ?? (arg1.length / 4) / arg2;
      } else {
        this.width = arg1;
        this.height = arg2;
        this.data = new Uint8ClampedArray(arg1 * arg2 * 4);
      }
    }
  }
  (globalThis as Record<string, unknown>)['ImageData'] = ImageDataStub;
}

// Stub Blob.prototype.arrayBuffer if missing
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function() {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(this);
    });
  };
}
