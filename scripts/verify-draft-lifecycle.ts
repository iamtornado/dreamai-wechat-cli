/**
 * 端到端验证：上传图片素材 → draft/add → draft/update → draft/get → draft/delete
 * 需环境变量 WECHAT_APP_ID、WECHAT_APP_SECRET，且当前出口 IP 在公众号白名单内。
 *
 * 运行：pnpm exec tsx scripts/verify-draft-lifecycle.ts
 */
import { Readable } from "node:stream";
import { createWechatClient } from "@wenyan-md/core/wechat";
import type { HttpAdapter } from "@wenyan-md/core/http";
import { FormData } from "formdata-node";
import { FormDataEncoder } from "form-data-encoder";
import { getWechatAccessToken } from "../src/wechat/accessToken.js";
import { draftAdd, draftDelete, draftGet, draftUpdate } from "../src/wechat/draftApi.js";

/** 1×1 PNG；配合 pic_crop 传满幅坐标，避免默认裁剪报错 53402 */
const MIN_PNG = Uint8Array.from(
    Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
    ),
);

const adapter: HttpAdapter = {
    fetch: globalThis.fetch.bind(globalThis),
    createMultipart(field: string, file: Blob, filename: string) {
        const form = new FormData();
        form.append(field, file, filename);
        const encoder = new FormDataEncoder(form);
        return {
            body: Readable.from(encoder),
            headers: encoder.headers,
            duplex: "half",
        };
    },
};

async function main(): Promise<void> {
    const { uploadMaterial } = createWechatClient(adapter);
    const token = await getWechatAccessToken();
    const stamp = Date.now();

    const titleCreate = `dreamai-draft-verify-${stamp}`;
    const thumbBlob = new Blob([MIN_PNG], { type: "image/png" });
    const { media_id: thumbMediaId } = await uploadMaterial("image", thumbBlob, `verify-${stamp}.png`, token);

    const { media_id: draftMediaId } = await draftAdd(token, [
        {
            article_type: "news",
            title: titleCreate,
            thumb_media_id: thumbMediaId,
            content: "<p>初始段落（自动化验证）</p>",
            author: "verify-bot",
            pic_crop_235_1: "0_0_1_1",
            pic_crop_1_1: "0_0_1_1",
        },
    ]);
    console.log("[1/4] draft/add 成功, media_id=", draftMediaId);

    const titleUpdated = `dreamai-draft-verify-UPDATED-${stamp}`;
    await draftUpdate(token, {
        media_id: draftMediaId,
        index: 0,
        articles: {
            article_type: "news",
            title: titleUpdated,
            thumb_media_id: thumbMediaId,
            content: "<p>更新后段落（自动化验证）</p>",
            author: "verify-bot",
            pic_crop_235_1: "0_0_1_1",
            pic_crop_1_1: "0_0_1_1",
        },
    });
    console.log("[2/4] draft/update 成功");

    const detail = await draftGet(token, draftMediaId);
    const first = detail.news_item[0];
    const gotTitle = typeof first.title === "string" ? first.title : "";
    if (gotTitle !== titleUpdated) {
        throw new Error(`draft/get 标题与更新不一致: 期望 ${titleUpdated}, 实际 ${gotTitle}`);
    }
    const gotContent = typeof first.content === "string" ? first.content : "";
    if (!gotContent.includes("更新后段落")) {
        throw new Error("draft/get 正文未包含更新后文案");
    }
    console.log("[3/4] draft/get 校验通过");

    await draftDelete(token, draftMediaId);
    console.log("[4/4] draft/delete 成功");
    console.log("全部步骤通过。");
}

main().catch((e) => {
    console.error("验证失败:", e instanceof Error ? e.message : e);
    process.exit(1);
});
