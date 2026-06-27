type PromiseWithResolversResult<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

declare global {
  interface PromiseConstructor {
    withResolvers<T>(): PromiseWithResolversResult<T>;
  }
}

export function installBrowserPolyfills() {
  if (!Promise.withResolvers) {
    Promise.withResolvers = function withResolvers<T>(): PromiseWithResolversResult<T> {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });

      return { promise, resolve, reject };
    };
  }

  installReadableStreamAsyncIteratorPolyfill();
}

installBrowserPolyfills();

function installReadableStreamAsyncIteratorPolyfill() {
  const readableStreamPrototype = globalThis.ReadableStream?.prototype as
    | (ReadableStream<unknown> & {
        [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
      })
    | undefined;

  if (!readableStreamPrototype || readableStreamPrototype[Symbol.asyncIterator]) {
    return;
  }

  const asyncIterator = async function* readableStreamIterator(
    this: ReadableStream<unknown>
  ) {
    const reader = this.getReader();

    try {
      while (true) {
        const result = await reader.read();
        if (result.done) {
          return;
        }

        yield result.value;
      }
    } finally {
      reader.releaseLock();
    }
  };

  readableStreamPrototype[Symbol.asyncIterator] = asyncIterator as
    typeof readableStreamPrototype[typeof Symbol.asyncIterator];
}
