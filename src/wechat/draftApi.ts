/**
 * 微信公众号「草稿箱」原始 API（与官方字段一致）。
 * 文档：
 * - 新增草稿 https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_add.html
 * - 更新草稿 https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_update.html
 * - 获取草稿列表 https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_batchget.html
 * - 获取草稿总数 https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_count.html
 * - 删除草稿 https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_delete.html
 * - 获取草稿详情 https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_getdraft.html
 */

const BASE = "https://api.weixin.qq.com/cgi-bin/draft";

export interface WechatApiError {
    errcode: number;
    errmsg: string;
}

function isWechatError(data: unknown): data is WechatApiError {
    return (
        typeof data === "object" &&
        data !== null &&
        "errcode" in data &&
        typeof (data as WechatApiError).errcode === "number" &&
        (data as WechatApiError).errcode !== 0
    );
}

function throwIfFailed(data: unknown): void {
    if (isWechatError(data)) {
        throw new Error(`${data.errcode}: ${data.errmsg}`);
    }
}

async function postJson(accessToken: string, path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${BASE}${path}?access_token=${encodeURIComponent(accessToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<unknown>;
}

async function getJson(accessToken: string, path: string): Promise<unknown> {
    const res = await fetch(`${BASE}${path}?access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<unknown>;
}

/** 单篇图文 / 图片消息结构与官方 articles / news_item 一致；此处用宽松类型便于透传 JSON。 */
export type DraftArticlePayload = Record<string, unknown>;

export interface DraftAddResponse {
    media_id: string;
}

/**
 * 新增草稿（官方：draft/add）。articles 为图文素材数组。
 * @see https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_add.html
 */
export async function draftAdd(accessToken: string, articles: DraftArticlePayload[]): Promise<DraftAddResponse> {
    const data = await postJson(accessToken, "/add", { articles });
    throwIfFailed(data);
    if (!data || typeof data !== "object" || !("media_id" in data) || typeof (data as DraftAddResponse).media_id !== "string") {
        throw new Error(`新增草稿返回异常: ${JSON.stringify(data)}`);
    }
    return data as DraftAddResponse;
}

export interface DraftUpdateParams {
    media_id: string;
    index: number;
    articles: DraftArticlePayload;
}

/**
 * 更新草稿（官方：draft/update）
 * @see https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_update.html
 */
export async function draftUpdate(accessToken: string, params: DraftUpdateParams): Promise<void> {
    const data = await postJson(accessToken, "/update", params);
    throwIfFailed(data);
}

export interface DraftBatchGetParams {
    offset: number;
    count: number;
    /** 1 表示不返回 content，0 表示返回；官方默认 0 */
    no_content?: number;
}

export interface DraftBatchGetResponse {
    total_count: number;
    item_count: number;
    item: DraftListItem[];
}

export interface DraftListItem {
    media_id: string;
    content: {
        news_item: DraftNewsItem[];
    };
    update_time: number;
}

export type DraftNewsItem = Record<string, unknown>;

/**
 * 获取草稿列表（官方：draft/batchget）
 * @see https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_batchget.html
 */
export async function draftBatchGet(accessToken: string, params: DraftBatchGetParams): Promise<DraftBatchGetResponse> {
    if (params.count < 1 || params.count > 20) {
        throw new Error("count 需在 1～20 之间");
    }
    const data = await postJson(accessToken, "/batchget", {
        offset: params.offset,
        count: params.count,
        ...(params.no_content !== undefined ? { no_content: params.no_content } : {}),
    });
    throwIfFailed(data);
    return data as DraftBatchGetResponse;
}

/**
 * 获取草稿总数（官方：draft/count）
 * @see https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_count.html
 */
export async function draftCount(accessToken: string): Promise<number> {
    const data = await getJson(accessToken, "/count");
    throwIfFailed(data);
    if (!data || typeof data !== "object" || !("total_count" in data) || typeof (data as { total_count: unknown }).total_count !== "number") {
        throw new Error(`获取草稿总数返回异常: ${JSON.stringify(data)}`);
    }
    return (data as { total_count: number }).total_count;
}

/**
 * 删除草稿（官方：draft/delete）
 * @see https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_delete.html
 */
export async function draftDelete(accessToken: string, mediaId: string): Promise<void> {
    const data = await postJson(accessToken, "/delete", { media_id: mediaId });
    throwIfFailed(data);
}

export interface DraftGetResponse {
    news_item: DraftNewsItem[];
}

/**
 * 获取草稿详情（官方：draft/get）
 * @see https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_getdraft.html
 */
export async function draftGet(accessToken: string, mediaId: string): Promise<DraftGetResponse> {
    const data = await postJson(accessToken, "/get", { media_id: mediaId });
    throwIfFailed(data);
    if (!data || typeof data !== "object" || !("news_item" in data) || !Array.isArray((data as DraftGetResponse).news_item)) {
        throw new Error(`获取草稿详情返回异常: ${JSON.stringify(data)}`);
    }
    return data as DraftGetResponse;
}
