import { Readable } from "node:stream";
import type { HttpAdapter } from "@wenyan-md/core/http";
import { FormData } from "formdata-node";
import { FormDataEncoder } from "form-data-encoder";

/** Node.js 环境下供 @wenyan-md/core/wechat 上传永久素材使用。 */
export const nodeHttpAdapter: HttpAdapter = {
    fetch: globalThis.fetch.bind(globalThis),
    createMultipart(field: string, file: Blob, filename: string) {
        const form = new FormData();
        form.append(field, file, filename);
        const encoder = new FormDataEncoder(form);
        return {
            body: Readable.from(encoder) as unknown as BodyInit,
            headers: encoder.headers as Record<string, string>,
            duplex: "half",
        };
    },
};
