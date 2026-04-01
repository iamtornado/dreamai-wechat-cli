import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prepareRenderContext } from "../src/commands/render";
import { getInputContent } from "../src/utils.js";
import fs from "node:fs/promises";
import path from "node:path";

describe("prepareRenderContext", () => {
    const defaultOptions = {
        theme: "default",
        highlight: "solarized-light",
        macStyle: true,
        footnote: true,
    };

    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(process, "exit").mockImplementation((code) => {
            throw new Error(`Process exit with code ${code}`);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should render content from direct string argument", async () => {
        const input = "# Hello";

        const { gzhContent } = await prepareRenderContext(input, defaultOptions as any, getInputContent);

        expect(gzhContent.content).toContain("<span>Hello</span></h1>");
    });

    it("should render content from stdin when input arg is missing", async () => {
        const originalIsTTY = process.stdin.isTTY;
        process.stdin.isTTY = false;

        setTimeout(() => {
            process.stdin.emit("data", "# From Stdin");
            process.stdin.emit("end");
        }, 50);

        const { gzhContent } = await prepareRenderContext(undefined, defaultOptions as any, getInputContent);

        expect(gzhContent.content).toContain("<span>From Stdin</span></h1>");
        process.stdin.isTTY = originalIsTTY;
    });

    it("should render content from file when input arg and stdin are missing", async () => {
        const originalIsTTY = process.stdin.isTTY;
        process.stdin.isTTY = true;

        const fileContent = "# From File";
        const readSpy = vi.spyOn(fs, "readFile").mockResolvedValue(fileContent as any);

        const { gzhContent } = await prepareRenderContext(
            undefined,
            { ...defaultOptions, file: "test.md" } as any,
            getInputContent,
        );

        expect(readSpy).toHaveBeenCalledWith(path.resolve(process.cwd(), "test.md"), "utf-8");
        expect(gzhContent.content).toContain("<span>From File</span></h1>");

        process.stdin.isTTY = originalIsTTY;
    });

    it("should throw error (which leads to exit) when no input source is provided", async () => {
        const originalIsTTY = process.stdin.isTTY;
        process.stdin.isTTY = true;

        await expect(prepareRenderContext(undefined, defaultOptions as any, getInputContent)).rejects.toThrow(
            /missing input-content/,
        );

        process.stdin.isTTY = originalIsTTY;
    });

    it("should load custom theme css if option provided", async () => {
        const input = "# Content";
        const cssContent = ".test { color: red; }";
        const themePath = path.join(process.cwd(), `dreamai-test-theme-${Date.now()}.css`);
        await fs.writeFile(themePath, cssContent, "utf-8");
        try {
            const { gzhContent } = await prepareRenderContext(
                input,
                {
                    ...defaultOptions,
                    customTheme: themePath,
                },
                getInputContent,
            );

            expect(gzhContent.content).toContain("<span>Content</span></h1>");
        } finally {
            await fs.unlink(themePath).catch(() => {});
        }
    });
});
