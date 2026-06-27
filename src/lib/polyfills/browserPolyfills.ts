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
}

installBrowserPolyfills();
