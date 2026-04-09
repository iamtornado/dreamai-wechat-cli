import { publishToWechatDraft } from "@wenyan-md/core/publish";
import type { ClientPublishOptions, GetInputContentFn, PublishOptions } from "@wenyan-md/core/wrapper";
import { prepareRenderContext, renderAndPublishToServer } from "@wenyan-md/core/wrapper";
import { contentFingerprint, createDebugLog, maskWechatAppId } from "./debug.js";

export async function publishLocalWithDebug(
    inputContent: string | undefined,
    options: PublishOptions,
    getInputContent: GetInputContentFn,
    debugEnabled: boolean,
): Promise<string> {
    const log = createDebugLog(debugEnabled);
    const t0 = Date.now();

    log.phase("publish_local_begin", {
        hasInlineMarkdown: Boolean(inputContent && inputContent.length > 0),
        inlineChars: inputContent?.length ?? 0,
        file: options.file ?? null,
        theme: options.theme,
        customTheme: options.customTheme ?? null,
        highlight: options.highlight,
        macStyle: options.macStyle,
        footnote: options.footnote,
        appIdMasked: maskWechatAppId(),
    });
    log.hint("每一次成功的 publish 都会调用微信 draft/add 新建一篇草稿；重试/重复执行会产生多篇草稿，可用 fingerprint 比对是否同源。");

    const tRender = Date.now();
    const { gzhContent, absoluteDirPath } = await prepareRenderContext(inputContent, options, getInputContent);

    const fp = contentFingerprint(
        gzhContent.title ?? "",
        gzhContent.content ?? "",
        gzhContent.source_url,
    );

    log.phase("publish_local_render_done", {
        ms: Date.now() - tRender,
        title: gzhContent.title ?? null,
        titleLen: (gzhContent.title ?? "").length,
        htmlChars: (gzhContent.content ?? "").length,
        cover: gzhContent.cover ?? null,
        author: gzhContent.author ?? null,
        source_url: gzhContent.source_url ?? null,
        absoluteDirPath: absoluteDirPath ?? null,
        contentFingerprint: fp,
    });

    if (!gzhContent.title) {
        log.phase("publish_local_abort", { reason: "missing_title" });
        throw new Error("未能找到文章标题");
    }

    const tDraft = Date.now();
    log.phase("wechat_publishToWechatDraft_begin", {
        note: "内部顺序：上传正文/封面图素材 → cgi-bin/draft/add",
    });

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

    log.phase("wechat_publishToWechatDraft_end", {
        ms: Date.now() - tDraft,
        ok: typeof (data as { media_id?: string }).media_id === "string",
    });

    const mediaId = (data as { media_id?: string }).media_id;
    if (mediaId) {
        log.phase("publish_local_success", {
            totalMs: Date.now() - t0,
            media_id: mediaId,
            contentFingerprint: fp,
        });
        return mediaId;
    }

    log.phase("publish_local_fail", {
        response: typeof data === "object" ? data : String(data),
        totalMs: Date.now() - t0,
    });
    throw new Error(`发布到微信公众号失败，\n${JSON.stringify(data)}`);
}

export async function publishServerWithDebug(
    inputContent: string | undefined,
    options: ClientPublishOptions,
    getInputContent: GetInputContentFn,
    debugEnabled: boolean,
): Promise<string> {
    const log = createDebugLog(debugEnabled);
    const t0 = Date.now();

    log.phase("publish_server_begin", {
        serverUrl: options.server ?? null,
        hasApiKey: Boolean(options.apiKey),
        clientVersion: options.clientVersion ?? null,
        file: options.file ?? null,
        theme: options.theme,
        hasInlineMarkdown: Boolean(inputContent && inputContent.length > 0),
    });
    log.hint("远程模式：渲染/指纹在服务端完成；若出现多篇重复草稿，请核对客户端是否多次发起 publish 或服务端是否重试。");

    const mediaId = await renderAndPublishToServer(inputContent, options, getInputContent);

    log.phase("publish_server_success", {
        totalMs: Date.now() - t0,
        media_id: mediaId,
    });
    return mediaId;
}
