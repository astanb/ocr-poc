import { afterEach, describe, expect, it } from "vitest";
import { installBrowserPolyfills } from "./browserPolyfills";

const nativeWithResolvers = Promise.withResolvers;
const nativeReadableStreamAsyncIterator =
  globalThis.ReadableStream?.prototype[Symbol.asyncIterator];

afterEach(() => {
  if (nativeWithResolvers) {
    Promise.withResolvers = nativeWithResolvers;
  } else {
    Reflect.deleteProperty(Promise, "withResolvers");
  }

  if (globalThis.ReadableStream) {
    if (nativeReadableStreamAsyncIterator) {
      globalThis.ReadableStream.prototype[Symbol.asyncIterator] =
        nativeReadableStreamAsyncIterator;
    } else {
      Reflect.deleteProperty(globalThis.ReadableStream.prototype, Symbol.asyncIterator);
    }
  }
});

describe("installBrowserPolyfills", () => {
  it("installs Promise.withResolvers when the browser does not provide it", async () => {
    Reflect.deleteProperty(Promise, "withResolvers");

    installBrowserPolyfills();
    const capability = Promise.withResolvers<string>();
    capability.resolve("ready");

    await expect(capability.promise).resolves.toBe("ready");
  });

  it("installs async iteration for ReadableStream when the browser does not provide it", async () => {
    Reflect.deleteProperty(globalThis.ReadableStream.prototype, Symbol.asyncIterator);

    installBrowserPolyfills();
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue("one");
        controller.enqueue("two");
        controller.close();
      }
    });
    const chunks: string[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["one", "two"]);
  });
});
