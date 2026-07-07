/**
 * 微信公众号「图片消息 / 贴图」草稿（draft/add，article_type=newspic）。
 * @see https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_add.html
 */

import { draftAdd, type DraftArticlePayload } from "./draftApi.js";
import { uploadPermanentImage } from "./materialUpload.js";

export const MAX_NEWSPIC_IMAGES = 20;
export const DEFAULT_MAX_TITLE_CHARS = 20;

export interface NewspicPublishOptions {
    title: string;
    content: string;
    imagePaths: string[];
    needOpenComment?: 0 | 1;
    onlyFansCanComment?: 0 | 1;
    maxTitleChars?: number;
}

export interface NewspicPublishResult {
    media_id: string;
    title: string;
    image_count: number;
    image_media_ids: string[];
}

function trimTitle(title: string, maxChars: number): string {
    const cleaned = title.trim();
    if (cleaned.length <= maxChars) {
        return cleaned;
    }
    if (maxChars <= 1) {
        return "…";
    }
    return cleaned.slice(0, maxChars - 1) + "…";
}

export function buildNewspicArticle(options: NewspicPublishOptions, imageMediaIds: string[]): DraftArticlePayload {
    const maxTitle = options.maxTitleChars ?? DEFAULT_MAX_TITLE_CHARS;
    const title = trimTitle(options.title, maxTitle);
    if (!title) {
        throw new Error("贴图标题不能为空");
    }
    const content = options.content.trim();
    if (!content) {
        throw new Error("贴图描述 content 不能为空");
    }
    if (imageMediaIds.length === 0) {
        throw new Error("至少需要一张图片");
    }
    if (imageMediaIds.length > MAX_NEWSPIC_IMAGES) {
        throw new Error(`贴图最多 ${MAX_NEWSPIC_IMAGES} 张图片，当前 ${imageMediaIds.length} 张`);
    }

    return {
        article_type: "newspic",
        title,
        content,
        need_open_comment: options.needOpenComment ?? 0,
        only_fans_can_comment: options.onlyFansCanComment ?? 0,
        image_info: {
            image_list: imageMediaIds.map((image_media_id) => ({ image_media_id })),
        },
    };
}

export async function publishNewspicDraft(
    accessToken: string,
    options: NewspicPublishOptions,
): Promise<NewspicPublishResult> {
    const uniquePaths = [...new Set(options.imagePaths.map((p) => p.trim()).filter(Boolean))];
    if (uniquePaths.length === 0) {
        throw new Error("未提供有效图片路径");
    }

    const imageMediaIds: string[] = [];
    for (const imagePath of uniquePaths) {
        const { media_id } = await uploadPermanentImage(accessToken, imagePath);
        imageMediaIds.push(media_id);
    }

    const article = buildNewspicArticle(options, imageMediaIds);
    const { media_id } = await draftAdd(accessToken, [article]);
    const maxTitle = options.maxTitleChars ?? DEFAULT_MAX_TITLE_CHARS;

    return {
        media_id,
        title: trimTitle(options.title, maxTitle),
        image_count: imageMediaIds.length,
        image_media_ids: imageMediaIds,
    };
}
