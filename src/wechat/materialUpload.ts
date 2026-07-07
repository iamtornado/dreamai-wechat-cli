import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { createWechatClient } from "@wenyan-md/core/wechat";
import { nodeHttpAdapter } from "./httpAdapter.js";

const { uploadMaterial } = createWechatClient(nodeHttpAdapter);

const MIME_BY_EXT: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
};

function mimeForPath(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/**
 * 上传本地图片为永久素材（官方 material/add_material，type=image）。
 * @see https://developers.weixin.qq.com/doc/subscription/api/material/permanent/api_addmaterial.html
 */
export async function uploadPermanentImage(
    accessToken: string,
    filePath: string,
): Promise<{ media_id: string; url?: string }> {
    const buf = await readFile(filePath);
    const filename = basename(filePath);
    const blob = new Blob([new Uint8Array(buf)], { type: mimeForPath(filePath) });
    const result = await uploadMaterial("image", blob, filename, accessToken);
    return { media_id: result.media_id, url: result.url };
}
