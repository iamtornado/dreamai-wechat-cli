import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getWechatAccessToken, type WechatCredentials } from "../wechat/accessToken.js";
import { publishNewspicDraft, type NewspicPublishResult } from "../wechat/newspic.js";

export interface NewspicPublishCliOptions {
    title?: string;
    content?: string;
    wechatPostFile?: string;
    fromDir?: string;
    images: string[];
    imagesDir?: string;
    imageGlob?: string;
    needOpenComment: 0 | 1;
    onlyFansCanComment: 0 | 1;
    maxTitleChars: number;
    appId?: string;
    appSecret?: string;
}

interface WechatPostJson {
    title?: string;
    description?: string;
}

async function loadWechatPostJson(filePath: string): Promise<WechatPostJson> {
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as WechatPostJson;
    if (!data || typeof data !== "object") {
        throw new Error(`无效的 wechat_post JSON: ${filePath}`);
    }
    return data;
}

async function collectPanelImages(comicDir: string): Promise<string[]> {
    const abs = resolve(comicDir);
    const entries = await readdir(abs);
    const panels = entries
        .filter((name) => /^panel_\d+\.(png|jpe?g|gif|webp)$/i.test(name))
        .sort((a, b) => {
            const ai = parseInt(a.match(/(\d+)/)?.[1] ?? "0", 10);
            const bi = parseInt(b.match(/(\d+)/)?.[1] ?? "0", 10);
            return ai - bi;
        });
    if (panels.length === 0) {
        throw new Error(`目录中未找到 panel_*.png 等分镜图: ${abs}`);
    }
    return panels.map((name) => join(abs, name));
}

async function collectImagesFromDir(dir: string): Promise<string[]> {
    const abs = resolve(dir);
    const entries = await readdir(abs);
    const images = entries
        .filter((name) => /\.(png|jpe?g|gif|webp)$/i.test(name))
        .sort();
    if (images.length === 0) {
        throw new Error(`目录中未找到图片: ${abs}`);
    }
    return images.map((name) => join(abs, name));
}

export async function resolveNewspicPublishInput(
    opts: NewspicPublishCliOptions,
): Promise<{ title: string; content: string; imagePaths: string[] }> {
    let title = opts.title?.trim() ?? "";
    let content = opts.content?.trim() ?? "";
    let imagePaths = [...opts.images];

    if (opts.fromDir) {
        const sourceDir = resolve(opts.fromDir);
        const postPath = join(sourceDir, "wechat_post.json");
        try {
            const post = await loadWechatPostJson(postPath);
            if (!title) title = (post.title ?? "").trim();
            if (!content) content = (post.description ?? "").trim();
        } catch (err) {
            if (!title || !content) {
                throw new Error(
                    `无法从 ${postPath} 读取标题/描述，请提供 --title 与 --content，或 --wechat-post`,
                );
            }
        }
        if (imagePaths.length === 0) {
            imagePaths = await collectPanelImages(sourceDir);
        }
    }

    if (opts.wechatPostFile) {
        const post = await loadWechatPostJson(resolve(opts.wechatPostFile));
        if (!title) title = (post.title ?? "").trim();
        if (!content) content = (post.description ?? "").trim();
    }

    if (opts.imagesDir && imagePaths.length === 0) {
        imagePaths = await collectImagesFromDir(opts.imagesDir);
    }

    if (!title) {
        throw new Error("缺少贴图标题（--title 或 wechat_post.json 中的 title）");
    }
    if (!content) {
        throw new Error("缺少贴图描述（--content 或 wechat_post.json 中的 description）");
    }
    if (imagePaths.length === 0) {
        throw new Error("缺少图片（--image、--images-dir 或 --from-dir）");
    }

    return { title, content, imagePaths: imagePaths.map((p) => resolve(p)) };
}

export async function runNewspicPublish(opts: NewspicPublishCliOptions): Promise<NewspicPublishResult> {
    const { title, content, imagePaths } = await resolveNewspicPublishInput(opts);
    const creds: WechatCredentials = { appId: opts.appId, appSecret: opts.appSecret };
    const token = await getWechatAccessToken(creds);
    return publishNewspicDraft(token, {
        title,
        content,
        imagePaths,
        needOpenComment: opts.needOpenComment,
        onlyFansCanComment: opts.onlyFansCanComment,
        maxTitleChars: opts.maxTitleChars,
    });
}
