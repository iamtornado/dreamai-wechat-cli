import { publishToWechatDraft } from "@wenyan-md/core/publish";
import type { PublishOptions } from "@wenyan-md/core/wrapper";
import { getInputContent } from "../utils.js";
import { prepareRenderContext } from "./render.js";

function hasMediaId(data: unknown): data is { media_id: string } {
    return typeof data === "object" && data !== null && "media_id" in data && typeof (data as { media_id: unknown }).media_id === "string";
}

/**
 * 供测试与脚本复用：将 Markdown 渲染为公众号 HTML 并写入草稿箱（draft/add）。
 */
export async function publishCommand(
    inputContent: string | undefined,
    options: PublishOptions,
): Promise<string> {
    const { gzhContent, absoluteDirPath } = await prepareRenderContext(inputContent, options, getInputContent);

    if (!gzhContent.title) {
        throw new Error("未能找到文章标题");
    }
    if (!gzhContent.cover) {
        throw new Error("未能找到文章封面");
    }

    const data = await publishToWechatDraft(
        {
            title: gzhContent.title,
            content: gzhContent.content,
            cover: gzhContent.cover,
            author: gzhContent.author,
            source_url: gzhContent.source_url,
        },
        { relativePath: absoluteDirPath },
    );

    if (!hasMediaId(data)) {
        throw new Error(`上传失败: ${typeof data === "string" ? data : JSON.stringify(data)}`);
    }

    return data.media_id;
}
