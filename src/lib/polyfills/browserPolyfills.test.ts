import { afterEach, describe, expect, it } from "vitest";
import { installBrowserPolyfills } from "./browserPolyfills";

const nativeWithResolvers = Promise.withResolvers;

afterEach(() => {
  if (nativeWithResolvers) {
    Promise.withResolvers = nativeWithResolvers;
  } else {
    Reflect.deleteProperty(Promise, "withResolvers");
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
});
