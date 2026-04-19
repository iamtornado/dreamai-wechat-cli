/**
 * 微信公众号「高级群发」相关 API（与官方字段一致）。
 * @see https://developers.weixin.qq.com/doc/subscription/api/notify/message/api_sendall.html
 */

const BASE = "https://api.weixin.qq.com/cgi-bin/message/mass";

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

export interface MassSendAllMpnewsParams {
    /** 用于群发的图文 media_id（来自新增草稿 draft/add 或临时素材等） */
    mediaId: string;
    /** true：全员；false：需配合 tagId */
    isToAll: boolean;
    /** isToAll 为 false 时必填 */
    tagId?: number;
    /** 0/1，默认 0；参见官方 send_ignore_reprint */
    sendIgnoreReprint?: 0 | 1;
    /** 可选，≤32 字节（UTF-8），用于防重复群发 */
    clientmsgid?: string;
}

export interface MassSendAllMpnewsResult {
    errcode: number;
    errmsg: string;
    msg_id: number;
    msg_data_id?: number;
}

/**
 * 根据标签或全员群发图文（官方：message/mass/sendall，msgtype=mpnews）
 */
export async function massSendAllMpnews(accessToken: string, params: MassSendAllMpnewsParams): Promise<MassSendAllMpnewsResult> {
    if (!params.mediaId) {
        throw new Error("media_id 不能为空");
    }
    if (!params.isToAll && (params.tagId === undefined || Number.isNaN(params.tagId))) {
        throw new Error("按标签群发时必须提供有效的 tag_id");
    }

    const filter = params.isToAll ? { is_to_all: true } : { is_to_all: false, tag_id: params.tagId! };

    const body: Record<string, unknown> = {
        filter,
        mpnews: { media_id: params.mediaId },
        msgtype: "mpnews",
        send_ignore_reprint: params.sendIgnoreReprint ?? 0,
    };

    if (params.clientmsgid !== undefined && params.clientmsgid !== "") {
        if (Buffer.byteLength(params.clientmsgid, "utf8") > 32) {
            throw new Error("clientmsgid 长度不能超过 32 字节（UTF-8）");
        }
        body.clientmsgid = params.clientmsgid;
    }

    const res = await fetch(`${BASE}/sendall?access_token=${encodeURIComponent(accessToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as unknown;
    throwIfFailed(data);

    if (
        !data ||
        typeof data !== "object" ||
        !("msg_id" in data) ||
        typeof (data as MassSendAllMpnewsResult).msg_id !== "number"
    ) {
        throw new Error(`群发接口返回异常: ${JSON.stringify(data)}`);
    }
    return data as MassSendAllMpnewsResult;
}
