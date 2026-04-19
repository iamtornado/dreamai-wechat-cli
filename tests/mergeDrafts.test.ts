import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/wechat/draftApi.js", () => ({
    draftGet: vi.fn(),
    draftAdd: vi.fn(),
    draftDelete: vi.fn(),
}));

import { draftAdd, draftDelete, draftGet } from "../src/wechat/draftApi.js";
import { mergeDraftsAdd, MAX_MERGED_ARTICLES } from "../src/wechat/mergeDrafts.js";

describe("mergeDraftsAdd", () => {
    beforeEach(() => {
        vi.mocked(draftGet).mockReset();
        vi.mocked(draftAdd).mockReset();
        vi.mocked(draftDelete).mockReset();
    });

    it("concatenates news_item from multiple drafts and calls draftAdd", async () => {
        vi.mocked(draftGet)
            .mockResolvedValueOnce({
                news_item: [
                    {
                        title: "A",
                        article_type: "news",
                        content: "<p>a</p>",
                        thumb_media_id: "thumb-a",
                        url: "https://should-strip.example/",
                    },
                ],
            })
            .mockResolvedValueOnce({
                news_item: [
                    {
                        title: "B",
                        article_type: "news",
                        content: "<p>b</p>",
                        thumb_media_id: "thumb-b",
                    },
                ],
            });
        vi.mocked(draftAdd).mockResolvedValue({ media_id: "NEW_MID" });

        const r = await mergeDraftsAdd("tok", ["m1", "m2"]);

        expect(r).toEqual({ media_id: "NEW_MID", articleCount: 2, sourceMediaIds: ["m1", "m2"] });
        expect(draftGet).toHaveBeenCalledTimes(2);
        expect(draftAdd).toHaveBeenCalledTimes(1);
        const articles = vi.mocked(draftAdd).mock.calls[0][1];
        expect(articles).toHaveLength(2);
        expect(articles[0]).not.toHaveProperty("url");
        expect(articles[0]).toMatchObject({ title: "A", thumb_media_id: "thumb-a" });
        expect(articles[1]).toMatchObject({ title: "B" });
    });

    it("dedupes duplicate media_id in source list", async () => {
        vi.mocked(draftGet).mockResolvedValue({
            news_item: [{ title: "A", article_type: "news", content: "<p>x</p>", thumb_media_id: "t" }],
        });
        vi.mocked(draftAdd).mockResolvedValue({ media_id: "N" });

        await mergeDraftsAdd("tok", ["same", "same"]);

        expect(draftGet).toHaveBeenCalledTimes(1);
    });

    it("throws when merged article count exceeds max", async () => {
        const many = Array.from({ length: MAX_MERGED_ARTICLES + 1 }, (_, i) => ({
            title: `T${i}`,
            article_type: "news",
            content: "<p>c</p>",
            thumb_media_id: "th",
        }));
        vi.mocked(draftGet).mockResolvedValue({ news_item: many });

        await expect(mergeDraftsAdd("tok", ["one"])).rejects.toThrow(/超过单条草稿图文上限/);
        expect(draftAdd).not.toHaveBeenCalled();
    });

    it("deleteSources deletes each source after add", async () => {
        vi.mocked(draftGet).mockResolvedValue({
            news_item: [{ title: "A", article_type: "news", content: "<p>x</p>", thumb_media_id: "t" }],
        });
        vi.mocked(draftAdd).mockResolvedValue({ media_id: "N" });
        vi.mocked(draftDelete).mockResolvedValue(undefined);

        await mergeDraftsAdd("tok", ["a", "b"], { deleteSources: true });

        expect(draftDelete).toHaveBeenCalledTimes(2);
        expect(draftDelete).toHaveBeenNthCalledWith(1, "tok", "a");
        expect(draftDelete).toHaveBeenNthCalledWith(2, "tok", "b");
    });
});
