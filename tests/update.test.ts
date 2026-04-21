import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmUpdatePrompt, resolveRegistryVersion } from "../src/update.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
});

describe("resolveRegistryVersion", () => {
    it("returns version from npm registry response", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ version: "2.0.3" }),
        }) as unknown as typeof fetch;

        const result = await resolveRegistryVersion("@tornadoami/dreamai-wechat-cli", "latest");
        expect(result).toBe("2.0.3");
        expect(globalThis.fetch).toHaveBeenCalledWith(
            "https://registry.npmjs.org/@tornadoami%2Fdreamai-wechat-cli/latest",
        );
    });

    it("throws when response does not include version", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ distTags: { latest: "2.0.3" } }),
        }) as unknown as typeof fetch;

        await expect(resolveRegistryVersion("@tornadoami/dreamai-wechat-cli", "latest")).rejects.toThrow(/响应异常/);
    });
});

describe("confirmUpdatePrompt", () => {
    it("throws in non-interactive terminal", async () => {
        const stdinDesc = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
        const stdoutDesc = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
        Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
        Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
        await expect(confirmUpdatePrompt("confirm?")).rejects.toThrow(/--yes/);
        if (stdinDesc) {
            Object.defineProperty(process.stdin, "isTTY", stdinDesc);
        }
        if (stdoutDesc) {
            Object.defineProperty(process.stdout, "isTTY", stdoutDesc);
        }
    });
});
