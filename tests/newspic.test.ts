import { describe, it, expect } from "vitest";
import { buildNewspicArticle, DEFAULT_MAX_TITLE_CHARS, MAX_NEWSPIC_IMAGES } from "../src/wechat/newspic.js";

describe("buildNewspicArticle", () => {
    it("builds official newspic payload with image_media_id", () => {
        const article = buildNewspicArticle(
            {
                title: "测试贴图标题",
                content: "这是一段贴图描述",
                imagePaths: ["a.png", "b.png"],
            },
            ["mid_a", "mid_b"],
        );

        expect(article.article_type).toBe("newspic");
        expect(article.title).toBe("测试贴图标题");
        expect(article.content).toBe("这是一段贴图描述");
        expect(article.need_open_comment).toBe(0);
        expect(article.image_info).toEqual({
            image_list: [{ image_media_id: "mid_a" }, { image_media_id: "mid_b" }],
        });
        expect(article.cover_info).toBeUndefined();
    });

    it("truncates title to max chars", () => {
        const long = "一二三四五六七八九零一二三四五六七八九零一二三四";
        const article = buildNewspicArticle(
            { title: long, content: "描述", imagePaths: ["a.png"], maxTitleChars: 20 },
            ["mid"],
        );
        expect(article.title).toHaveLength(20);
        expect(String(article.title).endsWith("…")).toBe(true);
    });

    it("rejects too many images", () => {
        const ids = Array.from({ length: MAX_NEWSPIC_IMAGES + 1 }, (_, i) => `m${i}`);
        expect(() =>
            buildNewspicArticle({ title: "t", content: "c", imagePaths: ids }, ids),
        ).toThrow(/最多/);
    });

    it("uses default max title chars constant", () => {
        expect(DEFAULT_MAX_TITLE_CHARS).toBe(20);
    });
});
