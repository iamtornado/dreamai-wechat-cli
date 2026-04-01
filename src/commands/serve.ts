import express, { Request, Response, NextFunction } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { configDir } from "@wenyan-md/core/wrapper";
import multer from "multer";
import { publishToWechatDraft } from "@wenyan-md/core/publish";
import { getWechatAccessToken } from "../wechat/accessToken.js";
import { draftAdd, draftBatchGet, draftCount, draftDelete, draftGet, draftUpdate } from "../wechat/draftApi.js";

export interface ServeOptions {
    port?: number;
    version?: string;
    apiKey?: string;
}

interface RenderRequest {
    fileId: string;
    theme?: string;
    highlight?: string;
    customTheme?: string;
    macStyle?: boolean;
    footnote?: boolean;
}

class AppError extends Error {
    constructor(public message: string) {
        super(message);
        this.name = "AppError";
    }
}

const UPLOAD_TTL_MS = 10 * 60 * 1000; // 10 minutes
const UPLOAD_DIR = path.join(configDir, "uploads");

export async function serveCommand(options: ServeOptions) {
    // 确保临时目录存在
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // 服务启动时立即执行一次后台清理
    cleanupOldUploads();
    // 定期清理过期的上传文件
    setInterval(cleanupOldUploads, UPLOAD_TTL_MS).unref();

    const app = express();
    const port = options.port || 3000;
    const auth = createAuthHandler(options);

    app.use(express.json({ limit: "10mb" }));

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, UPLOAD_DIR);
        },
        filename: (req, file, cb) => {
            const fileId = crypto.randomUUID();
            const ext = file.originalname.split(".").pop() || "";
            cb(null, ext ? `${fileId}.${ext}` : fileId);
        },
    });

    const upload = multer({
        storage,
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB
        },
        fileFilter: (req, file, cb) => {
            const ext = file.originalname.split(".").pop()?.toLowerCase();

            // 1. 定义允许的图片类型
            const allowedImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
            const allowedImageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg"];

            // 2. 分别判断文件大类
            const isImage = allowedImageTypes.includes(file.mimetype) || (ext && allowedImageExts.includes(ext));
            const isMarkdown = ext === "md" || file.mimetype === "text/markdown" || file.mimetype === "text/plain";
            const isCss = ext === "css" || file.mimetype === "text/css";
            const isJson = ext === "json" || file.mimetype === "application/json";

            // 3. 综合放行逻辑
            if (isImage || isMarkdown || isCss || isJson) {
                cb(null, true);
            } else {
                cb(new AppError("不支持的文件类型，仅支持图片、Markdown、CSS 和 JSON 文件"));
            }
        },
    });

    // 健康检查
    app.get("/health", (_req: Request, res: Response) => {
        // service 须为 wenyan-cli：@wenyan-md/core 的 renderAndPublishToServer 会校验该字段
        res.json({ status: "ok", service: "wenyan-cli", version: options.version || "unknown" });
    });

    // 鉴权探针
    app.get("/verify", auth, (_req: Request, res: Response) => {
        res.json({ success: true, message: "Authorized" });
    });

    // 发布接口 - 读取 json 文件内容并发布
    app.post("/publish", auth, async (req: Request, res: Response) => {
        const body: RenderRequest = req.body;
        validateRequest(body);

        // 根据 fileId 去找刚上传的 json 文件并读取内容
        const files = await fs.readdir(UPLOAD_DIR);
        const matchedFile = files.find((f) => f === body.fileId);

        if (!matchedFile) {
            throw new AppError(`文件不存在或已过期，请重新上传 (ID: ${body.fileId})`);
        }

        // 简单的防呆校验，防止直接提交纯图片的 fileId 到发布接口
        const ext = path.extname(matchedFile).toLowerCase();
        if (ext !== ".json") {
            throw new AppError("请提供 JSON 文件的 fileId，不能直接发布图片文件");
        }

        // 找到上传文件并提取文本内容
        const filePath = path.join(UPLOAD_DIR, matchedFile);
        const fileContent = await fs.readFile(filePath, "utf-8");
        const gzhContent = JSON.parse(fileContent);

        if (!gzhContent.title) throw new AppError("未能找到文章标题");

        // 公共的 asset:// 替换逻辑
        const resolveAssetPath = (assetUrl: string) => {
            const assetFileId = assetUrl.replace("asset://", "");
            const matchedAsset = files.find((f) => f === assetFileId || path.parse(f).name === assetFileId);
            return matchedAsset ? path.join(UPLOAD_DIR, matchedAsset) : assetUrl;
        };

        // 替换 HTML 内容里的 asset://
        gzhContent.content = gzhContent.content.replace(
            /(<img\b[^>]*?\bsrc\s*=\s*["'])(asset:\/\/[^"']+)(["'])/gi,
            (_match: any, prefix: string, assetUrl: string, suffix: string) =>
                prefix + resolveAssetPath(assetUrl) + suffix,
        );

        // 替换封面里的 asset://
        if (gzhContent.cover && gzhContent.cover.startsWith("asset://")) {
            gzhContent.cover = resolveAssetPath(gzhContent.cover);
        }

        const data = await publishToWechatDraft({
            title: gzhContent.title,
            content: gzhContent.content,
            cover: gzhContent.cover,
            author: gzhContent.author,
            source_url: gzhContent.source_url,
        });

        if (data.media_id) {
            res.json({
                media_id: data.media_id,
            });
        } else {
            throw new AppError(`发布到微信公众号失败，\n${data}`);
        }
    });

    // --- 草稿箱原始 API（需配置 WECHAT_APP_* 环境变量）---
    app.get("/draft/count", auth, async (_req: Request, res: Response) => {
        const token = await getWechatAccessToken();
        const total_count = await draftCount(token);
        res.json({ total_count });
    });

    app.post("/draft/batchget", auth, async (req: Request, res: Response) => {
        const token = await getWechatAccessToken();
        const offset = typeof req.body?.offset === "number" ? req.body.offset : parseInt(String(req.body?.offset ?? "0"), 10);
        const count = typeof req.body?.count === "number" ? req.body.count : parseInt(String(req.body?.count ?? "20"), 10);
        const no_content =
            typeof req.body?.no_content === "number" ? req.body.no_content : parseInt(String(req.body?.no_content ?? "1"), 10);
        const data = await draftBatchGet(token, { offset, count, no_content });
        res.json(data);
    });

    app.post("/draft/get", auth, async (req: Request, res: Response) => {
        const media_id = req.body?.media_id as string | undefined;
        if (!media_id) throw new AppError("缺少 media_id");
        const token = await getWechatAccessToken();
        const data = await draftGet(token, media_id);
        res.json(data);
    });

    app.post("/draft/delete", auth, async (req: Request, res: Response) => {
        const media_id = req.body?.media_id as string | undefined;
        if (!media_id) throw new AppError("缺少 media_id");
        const token = await getWechatAccessToken();
        await draftDelete(token, media_id);
        res.json({ errcode: 0, errmsg: "ok" });
    });

    app.post("/draft/update", auth, async (req: Request, res: Response) => {
        const { media_id, index, articles } = req.body ?? {};
        if (!media_id || index === undefined || articles === null || typeof articles !== "object") {
            throw new AppError("缺少 media_id、index 或 articles");
        }
        const token = await getWechatAccessToken();
        await draftUpdate(token, {
            media_id: String(media_id),
            index: typeof index === "number" ? index : parseInt(String(index), 10),
            articles: articles as Record<string, unknown>,
        });
        res.json({ errcode: 0, errmsg: "ok" });
    });

    app.post("/draft/add", auth, async (req: Request, res: Response) => {
        const { articles } = req.body ?? {};
        if (!Array.isArray(articles)) throw new AppError("缺少 articles 数组");
        const token = await getWechatAccessToken();
        const { media_id } = await draftAdd(token, articles as Record<string, unknown>[]);
        res.json({ media_id });
    });

    // 上传接口
    app.post("/upload", auth, upload.single("file"), async (req: Request, res: Response) => {
        if (!req.file) {
            throw new AppError("未找到上传的文件");
        }

        const newFilename = req.file.filename;

        res.json({
            success: true,
            data: {
                fileId: newFilename,
                originalFilename: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
            },
        });
    });

    app.use(errorHandler);

    return new Promise<void>((resolve, reject) => {
        const server = app.listen(port, () => {
            console.log(`文颜 Server 已启动，监听端口 ${port}`);
            console.log(`健康检查：http://localhost:${port}/health`);
            console.log(`鉴权探针：http://localhost:${port}/verify`);
            console.log(`发布接口：POST http://localhost:${port}/publish`);
            console.log(`上传接口：POST http://localhost:${port}/upload`);
            console.log(`草稿：GET /draft/count · POST /draft/batchget · /draft/get · /draft/delete · /draft/update · /draft/add`);
        });

        server.on("error", (err: any) => {
            if (err.code === "EADDRINUSE") {
                console.error(`端口 ${port} 已被占用`);
                reject(new Error(`端口 ${port} 已被占用`));
            } else {
                reject(err);
            }
        });

        process.on("SIGINT", () => {
            console.log("\n正在关闭服务器...");
            server.close(() => {
                console.log("服务器已关闭");
                resolve();
            });
        });

        process.on("SIGTERM", () => {
            server.close(() => resolve());
        });
    });
}

function errorHandler(error: any, _req: Request, res: Response, next: NextFunction): void {
    if (res.headersSent) {
        return next(error);
    }

    const message = error instanceof Error ? error.message : String(error);

    // 修复：multer 抛出的文件限制错误（如超出大小），应判断为客户端 400 错误
    const isAppError = error instanceof AppError;
    const isMulterError = error.name === "MulterError";
    const statusCode = isAppError || isMulterError ? 400 : 500;

    if (statusCode === 500) {
        console.error("[Server Error]:", error);
    }

    res.status(statusCode).json({
        code: -1,
        desc: message,
    });
}

function createAuthHandler(config: { apiKey?: string }) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!config.apiKey) {
            return next();
        }

        const clientApiKey = req.headers["x-api-key"];
        if (clientApiKey === config.apiKey) {
            next();
        } else {
            res.status(401).json({
                code: -1,
                desc: "Unauthorized: Invalid API Key",
            });
        }
    };
}

function validateRequest(req: RenderRequest): void {
    if (!req.fileId) {
        throw new AppError("缺少必要参数：fileId");
    }
}

async function cleanupOldUploads() {
    try {
        const files = await fs.readdir(UPLOAD_DIR);
        const now = Date.now();
        for (const file of files) {
            const filePath = path.join(UPLOAD_DIR, file);
            try {
                const stats = await fs.stat(filePath);
                if (now - stats.mtimeMs > UPLOAD_TTL_MS) {
                    await fs.unlink(filePath);
                }
            } catch (e) {
                // 忽略单个文件处理错误
            }
        }
    } catch (e) {
        console.error("Cleanup task error:", e);
    }
}
