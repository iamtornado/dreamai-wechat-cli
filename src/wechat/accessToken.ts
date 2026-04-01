import { createWechatClient } from "@wenyan-md/core/wechat";
import { tokenStore } from "@wenyan-md/core/wrapper";

const nodeAdapter = {
    fetch: globalThis.fetch.bind(globalThis) as typeof fetch,
    createMultipart(): { body: BodyInit; headers?: Record<string, string> } {
        throw new Error("createMultipart is not used for access token");
    },
};

const { fetchAccessToken } = createWechatClient(nodeAdapter);

export interface WechatCredentials {
    appId?: string;
    appSecret?: string;
}

export async function getWechatAccessToken(creds: WechatCredentials = {}): Promise<string> {
    const appId = creds.appId ?? process.env.WECHAT_APP_ID;
    const appSecret = creds.appSecret ?? process.env.WECHAT_APP_SECRET;
    if (!appId || !appSecret) {
        throw new Error("请通过参数或环境变量 WECHAT_APP_ID / WECHAT_APP_SECRET 提供公众号凭据");
    }
    const cached = tokenStore.getToken(appId);
    if (cached) {
        return cached;
    }
    const result = await fetchAccessToken(appId, appSecret);
    await tokenStore.setToken(appId, result.access_token, result.expires_in);
    return result.access_token;
}
