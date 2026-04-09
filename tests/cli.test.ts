import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProgram } from "../src/cli.js";
import { publishToWechatDraft } from "@wenyan-md/core/publish";

const mockPrepareRenderContext = vi.fn();

vi.mock("@wenyan-md/core/publish", () => ({
    publishToWechatDraft: vi.fn(),
}));

vi.mock("@wenyan-md/core/wrapper", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@wenyan-md/core/wrapper")>();
    return {
        ...actual,
        prepareRenderContext: (...args: unknown[]) => mockPrepareRenderContext(...args),
    };
});

describe("CLI Argument Parsing", () => {
    let program: ReturnType<typeof createProgram>;

    beforeEach(() => {
        vi.clearAllMocks();
        program = createProgram("1.0.0");
        program.exitOverride();
        mockPrepareRenderContext.mockResolvedValue({
            gzhContent: {
                content: "<h1>Hello</h1>",
                title: "Test Title",
                cover: "https://example.com/cover.jpg",
            },
            absoluteDirPath: "/mock/path",
        });
        vi.mocked(publishToWechatDraft).mockResolvedValue({ media_id: "mock-media-id" });
    });

    it("should verify version flag", () => {
        expect(program.version()).toBe("1.0.0");
    });

    it("should call publishToWechatDraft after prepareRenderContext for publish", async () => {
        const args = ["node", "dreamai-wechat-cli", "publish", "-f", "test.md", "-t", "rainbow", "--no-mac-style"];

        await program.parseAsync(args);

        expect(mockPrepareRenderContext).toHaveBeenCalledTimes(1);
        expect(publishToWechatDraft).toHaveBeenCalledTimes(1);

        const expectedOptions = expect.objectContaining({
            file: "test.md",
            footnote: true,
            theme: "rainbow",
            macStyle: false,
            highlight: "solarized-light",
            debug: false,
        });

        expect(mockPrepareRenderContext).toHaveBeenCalledWith(undefined, expectedOptions, expect.any(Function));
        expect(publishToWechatDraft).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "Test Title",
                content: "<h1>Hello</h1>",
                cover: "https://example.com/cover.jpg",
            }),
            { relativePath: "/mock/path" },
        );
    });

    it("should call render command with string input", async () => {
        const args = ["node", "dreamai-wechat-cli", "render", "# Hello"];

        await program.parseAsync(args);

        expect(mockPrepareRenderContext).toHaveBeenCalledTimes(1);
        const expectedOptions = expect.objectContaining({
            footnote: true,
            theme: "default",
            macStyle: true,
            highlight: "solarized-light",
            debug: false,
        });
        expect(mockPrepareRenderContext).toHaveBeenCalledWith("# Hello", expectedOptions, expect.any(Function));
    });

    it("should display help when no command is provided", async () => {
        const outputSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        const args = ["node", "dreamai-wechat-cli"];

        await program.parseAsync(args);

        expect(outputSpy).toHaveBeenCalled();
        outputSpy.mockRestore();
    });
});
