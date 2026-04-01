import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProgram } from "../src/cli.js";

const mockRenderAndPublish = vi.fn();
const mockPrepareRenderContext = vi.fn();

vi.mock("@wenyan-md/core/wrapper", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@wenyan-md/core/wrapper")>();
    return {
        ...actual,
        renderAndPublish: (...args: unknown[]) => mockRenderAndPublish(...args),
        prepareRenderContext: (...args: unknown[]) => mockPrepareRenderContext(...args),
    };
});

describe("CLI Argument Parsing", () => {
    let program: ReturnType<typeof createProgram>;

    beforeEach(() => {
        vi.clearAllMocks();
        program = createProgram("1.0.0");
        program.exitOverride();
        mockRenderAndPublish.mockResolvedValue("mock-media-id");
        mockPrepareRenderContext.mockResolvedValue({
            gzhContent: { content: "<h1>Hello</h1>" },
            absoluteDirPath: "/mock/path",
        });
    });

    it("should verify version flag", () => {
        expect(program.version()).toBe("1.0.0");
    });

    it("should call renderAndPublish with correct options for publish", async () => {
        const args = ["node", "wenyan", "publish", "-f", "test.md", "-t", "rainbow", "--no-mac-style"];

        await program.parseAsync(args);

        expect(mockRenderAndPublish).toHaveBeenCalledTimes(1);

        const expectedOptions = expect.objectContaining({
            file: "test.md",
            footnote: true,
            theme: "rainbow",
            macStyle: false,
            highlight: "solarized-light",
        });

        expect(mockRenderAndPublish).toHaveBeenCalledWith(undefined, expectedOptions, expect.any(Function));
    });

    it("should call render command with string input", async () => {
        const args = ["node", "wenyan", "render", "# Hello"];

        await program.parseAsync(args);

        expect(mockPrepareRenderContext).toHaveBeenCalledTimes(1);
        const expectedOptions = expect.objectContaining({
            footnote: true,
            theme: "default",
            macStyle: true,
            highlight: "solarized-light",
        });
        expect(mockPrepareRenderContext).toHaveBeenCalledWith("# Hello", expectedOptions, expect.any(Function));
    });

    it("should display help when no command is provided", async () => {
        const outputSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        const args = ["node", "wenyan"];

        await program.parseAsync(args);

        expect(outputSpy).toHaveBeenCalled();
        outputSpy.mockRestore();
    });
});
