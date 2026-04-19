/**
 * 将多篇已有草稿合并为一篇多图文草稿（draft/get → 拼 articles → draft/add）。
 * 微信对单条多图文条数有上限，见 MAX_MERGED_ARTICLES。
 */

import { draftAdd, draftDelete, draftGet, type DraftArticlePayload, type DraftNewsItem } from "./draftApi.js";

/** 与公众平台常见限制一致：单条多图文最多 8 篇（以微信后台与接口报错为准）。 */
export const MAX_MERGED_ARTICLES = 8;

/** draft/get 的 news_item 里常见只读/展示字段，回传 draft/add 时去掉更稳妥。 */
const NEWS_ITEM_KEYS_OMIT = new Set([
    "url",
    "thumb_url",
    "share_url",
    "item_show_type",
    "is_deleted",
]);

function newsItemToDraftAddArticle(raw: DraftNewsItem, indexInMerge: number): DraftArticlePayload {
    if (!raw || typeof raw !== "object") {
        throw new Error(`第 ${indexInMerge + 1} 条 news_item 非法`);
    }
    const item = raw as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(item)) {
        if (NEWS_ITEM_KEYS_OMIT.has(k)) continue;
        out[k] = v;
    }
    if (out.article_type === undefined || out.article_type === null || out.article_type === "") {
        out.article_type = "news";
    }
    return out as DraftArticlePayload;
}

function dedupeMediaIdsPreserveOrder(ids: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
        const t = id.trim();
        if (!t) continue;
        if (seen.has(t)) continue;
        seen.add(t);
        out.push(t);
    }
    return out;
}

function validateArticlesForAdd(articles: DraftArticlePayload[]): void {
    if (articles.length === 0) {
        throw new Error("没有可合并的文章");
    }
    if (articles.length > MAX_MERGED_ARTICLES) {
        throw new Error(`合并后共 ${articles.length} 篇，超过单条草稿图文上限 ${MAX_MERGED_ARTICLES} 篇，请分批合并`);
    }
    articles.forEach((a, i) => {
        const title = typeof a.title === "string" ? a.title.trim() : "";
        if (!title) {
            throw new Error(`合并后第 ${i + 1} 篇缺少有效 title`);
        }
        const at = a.article_type;
        const typeStr = typeof at === "string" ? at : "news";
        if (typeStr === "news") {
            const content = typeof a.content === "string" ? a.content : "";
            if (!content.trim()) {
                throw new Error(`合并后第 ${i + 1} 篇（${title}）缺少 content`);
            }
            const thumb = typeof a.thumb_media_id === "string" ? a.thumb_media_id.trim() : "";
            if (!thumb) {
                throw new Error(`合并后第 ${i + 1} 篇（${title}）缺少 thumb_media_id`);
            }
        }
    });
}

export interface MergeDraftsResult {
    media_id: string;
    articleCount: number;
    sourceMediaIds: string[];
}

/**
 * 按顺序拉取多篇草稿，将其中的全部 news_item 拼成一篇新草稿并 draft/add。
 */
export async function mergeDraftsAdd(
    accessToken: string,
    sourceMediaIds: string[],
    options?: { deleteSources?: boolean },
): Promise<MergeDraftsResult> {
    const sources = dedupeMediaIdsPreserveOrder(sourceMediaIds);
    if (sources.length === 0) {
        throw new Error("请至少提供一个有效的 --media-id");
    }

    const articles: DraftArticlePayload[] = [];
    for (const mid of sources) {
        const detail = await draftGet(accessToken, mid);
        const items = detail.news_item ?? [];
        for (const raw of items) {
            articles.push(newsItemToDraftAddArticle(raw, articles.length));
        }
    }

    validateArticlesForAdd(articles);

    const { media_id } = await draftAdd(accessToken, articles);

    if (options?.deleteSources) {
        for (const mid of sources) {
            await draftDelete(accessToken, mid);
        }
    }

    return { media_id, articleCount: articles.length, sourceMediaIds: sources };
}
