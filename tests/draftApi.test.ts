import { afterEach, describe, expect, it, vi } from "vitest";
import {
    draftAdd,
    draftBatchGet,
    draftCount,
    draftDelete,
    draftGet,
    draftUpdate,
} from "../src/wechat/draftApi.js";

const origFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
});

describe("draftApi", () => {
    it("draftCount parses total_count", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ total_count: 7 }),
        }) as unknown as typeof fetch;

        const n = await draftCount("tok");
        expect(n).toBe(7);
        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining("https://api.weixin.qq.com/cgi-bin/draft/count?access_token=tok"),
        );
    });

    it("draftCount throws on WeChat error", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ errcode: 40001, errmsg: "invalid credential" }),
        }) as unknown as typeof fetch;

        await expect(draftCount("bad")).rejects.toThrow(/40001/);
    });

    it("draftAdd returns media_id", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ media_id: "MID" }),
        }) as unknown as typeof fetch;

        const r = await draftAdd("tok", [{ title: "t", content: "c", thumb_media_id: "thumb" }]);
        expect(r.media_id).toBe("MID");
        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/draft/add?access_token=tok"),
            expect.objectContaining({ method: "POST" }),
        );
    });

    it("draftUpdate posts body", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ errcode: 0, errmsg: "ok" }),
        }) as unknown as typeof fetch;

        await draftUpdate("tok", { media_id: "m", index: 0, articles: { title: "x", content: "y" } });
        const call = vi.mocked(globalThis.fetch).mock.calls[0];
        expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({
            media_id: "m",
            index: 0,
            articles: { title: "x", content: "y" },
        });
    });

    it("draftBatchGet validates count", async () => {
        await expect(draftBatchGet("tok", { offset: 0, count: 0 })).rejects.toThrow(/1～20/);
    });

    it("draftDelete calls delete endpoint", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ errcode: 0, errmsg: "ok" }),
        }) as unknown as typeof fetch;

        await draftDelete("tok", "mid");
        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/draft/delete?access_token=tok"),
            expect.anything(),
        );
    });

    it("draftGet returns news_item", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ news_item: [{ title: "a" }] }),
        }) as unknown as typeof fetch;

        const r = await draftGet("tok", "mid");
        expect(r.news_item).toHaveLength(1);
    });
});
